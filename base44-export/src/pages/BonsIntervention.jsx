import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Plus, Search, Pencil, Trash2, Send, CheckCircle2, MoreHorizontal, Eye } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useCompany } from '@/lib/useCompany';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

const TYPE_LABELS = { gardiennage: 'Gardiennage', ronde: 'Ronde', intervention: 'Intervention', evenementiel: 'Événementiel', autre: 'Autre' };
const STATUS_CONFIG = {
  en_cours: { label: 'En cours', color: 'bg-amber-500/10 text-amber-600 border-amber-200' },
  termine: { label: 'Terminé', color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
  signe: { label: 'Signé', color: 'bg-green-500/10 text-green-700 border-green-200' },
};

const defaultForm = { client_id: '', client_name: '', site_id: '', site_name: '', agent_id: '', agent_name: '', date: format(new Date(), 'yyyy-MM-dd'), heure_debut: '', heure_fin: '', type_intervention: 'gardiennage', description: '', observations: '' };

export default function BonsIntervention() {
  const { companyId, isAdmin } = useCompany();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [tabFilter, setTabFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editBon, setEditBon] = useState(null);
  const [viewBon, setViewBon] = useState(null);
  const [form, setForm] = useState(defaultForm);

  const { data: bons = [] } = useQuery({
    queryKey: ['bons_intervention', companyId],
    queryFn: () => base44.entities.BonIntervention.filter({ company_id: companyId }, '-date', 100),
    enabled: !!companyId,
  });
  const { data: agents = [] } = useQuery({ queryKey: ['agents', companyId], queryFn: () => base44.entities.Agent.filter({ company_id: companyId }), enabled: !!companyId });
  const { data: clients = [] } = useQuery({ queryKey: ['clients', companyId], queryFn: () => base44.entities.Client.filter({ company_id: companyId }), enabled: !!companyId });
  const { data: sites = [] } = useQuery({ queryKey: ['sites', companyId], queryFn: () => base44.entities.Site.filter({ company_id: companyId }), enabled: !!companyId });

  const createMut = useMutation({
    mutationFn: (data) => {
      const numero = `BI-${Date.now().toString().slice(-6)}`;
      return base44.entities.BonIntervention.create({ ...data, company_id: companyId, numero });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bons_intervention'] }); closeForm(); toast.success('Bon créé'); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.BonIntervention.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bons_intervention'] }); closeForm(); toast.success('Bon mis à jour'); },
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.BonIntervention.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bons_intervention'] }); toast.success('Bon supprimé'); },
  });

  const closeForm = () => { setShowForm(false); setEditBon(null); setForm(defaultForm); };

  const openEdit = (b) => {
    setEditBon(b);
    setForm({ client_id: b.client_id || '', client_name: b.client_name || '', site_id: b.site_id || '', site_name: b.site_name || '', agent_id: b.agent_id || '', agent_name: b.agent_name || '', date: b.date || '', heure_debut: b.heure_debut || '', heure_fin: b.heure_fin || '', type_intervention: b.type_intervention || 'gardiennage', description: b.description || '', observations: b.observations || '' });
    setShowForm(true);
  };

  const handleSign = (bon) => {
    updateMut.mutate({ id: bon.id, data: { status: 'signe', signature_client: true, signature_at: new Date().toISOString() } });
  };

  const exportPDF = (bon) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('BON D\'INTERVENTION', 14, 20);
    doc.setFontSize(11);
    doc.text(`N° : ${bon.numero || bon.id.slice(-8)}`, 14, 32);
    doc.text(`Date : ${bon.date ? format(new Date(bon.date), 'dd/MM/yyyy', { locale: fr }) : ''}`, 14, 40);
    doc.text(`Client : ${bon.client_name || ''}`, 14, 50);
    doc.text(`Site : ${bon.site_name || ''}`, 14, 58);
    doc.text(`Agent : ${bon.agent_name || ''}`, 14, 66);
    doc.text(`Type : ${TYPE_LABELS[bon.type_intervention] || bon.type_intervention}`, 14, 74);
    doc.text(`Heure début : ${bon.heure_debut || ''} - Fin : ${bon.heure_fin || ''}`, 14, 82);
    if (bon.description) {
      doc.setFontSize(10);
      doc.text('Description :', 14, 95);
      const descLines = doc.splitTextToSize(bon.description, 170);
      doc.text(descLines, 14, 103);
    }
    if (bon.observations) {
      doc.setFontSize(10);
      doc.text('Observations :', 14, 130);
      const obsLines = doc.splitTextToSize(bon.observations, 170);
      doc.text(obsLines, 14, 138);
    }
    doc.text(`Statut : ${STATUS_CONFIG[bon.status]?.label || bon.status}`, 14, 175);
    if (bon.signature_at) doc.text(`Signé le : ${format(new Date(bon.signature_at), 'dd/MM/yyyy HH:mm', { locale: fr })}`, 14, 183);
    doc.save(`bon-intervention-${bon.numero || bon.id.slice(-8)}.pdf`);
  };

  const filtered = bons
    .filter(b => tabFilter === 'all' || b.status === tabFilter)
    .filter(b => `${b.client_name} ${b.site_name} ${b.agent_name}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-primary" /> Bons d'intervention
          </h1>
          <p className="text-muted-foreground mt-1">{bons.length} bon{bons.length > 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Nouveau bon
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Tabs value={tabFilter} onValueChange={setTabFilter}>
          <TabsList>
            <TabsTrigger value="all">Tous</TabsTrigger>
            <TabsTrigger value="en_cours">En cours</TabsTrigger>
            <TabsTrigger value="termine">Terminés</TabsTrigger>
            <TabsTrigger value="signe">Signés</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Aucun bon d'intervention</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(b => {
            const st = STATUS_CONFIG[b.status] || STATUS_CONFIG.en_cours;
            return (
              <Card key={b.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-sm">{b.client_name}</p>
                    <p className="text-xs text-muted-foreground">{b.site_name}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-3.5 h-3.5" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setViewBon(b)}><Eye className="w-4 h-4 mr-2" />Voir</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEdit(b)}><Pencil className="w-4 h-4 mr-2" />Modifier</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => exportPDF(b)}><Send className="w-4 h-4 mr-2" />Export PDF</DropdownMenuItem>
                      {b.status !== 'signe' && <DropdownMenuItem onClick={() => handleSign(b)}><CheckCircle2 className="w-4 h-4 mr-2" />Marquer signé</DropdownMenuItem>}
                      <DropdownMenuItem className="text-destructive" onClick={() => deleteMut.mutate(b.id)}><Trash2 className="w-4 h-4 mr-2" />Supprimer</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  <Badge variant="outline" className="text-xs">{TYPE_LABELS[b.type_intervention] || b.type_intervention}</Badge>
                  <Badge variant="outline" className={`text-xs ${st.color}`}>{st.label}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {b.date && format(new Date(b.date), 'dd/MM/yyyy', { locale: fr })}
                  {b.heure_debut && ` • ${b.heure_debut}${b.heure_fin ? ` - ${b.heure_fin}` : ''}`}
                </p>
                {b.agent_name && <p className="text-xs text-muted-foreground mt-1">Agent : {b.agent_name}</p>}
                {b.numero && <p className="text-xs text-muted-foreground font-mono mt-1">{b.numero}</p>}
              </Card>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={closeForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editBon ? 'Modifier le bon' : 'Nouveau bon d\'intervention'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Client</Label>
                <Select value={form.client_id} onValueChange={v => { const c = clients.find(i => i.id === v); setForm(p => ({ ...p, client_id: v, client_name: c?.company_name || '' })); }}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Site</Label>
                <Select value={form.site_id} onValueChange={v => { const s = sites.find(i => i.id === v); setForm(p => ({ ...p, site_id: v, site_name: s?.name || '' })); }}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>{sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Agent</Label>
                <Select value={form.agent_id} onValueChange={v => { const a = agents.find(i => i.id === v); setForm(p => ({ ...p, agent_id: v, agent_name: a ? `${a.first_name} ${a.last_name}` : '' })); }}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>{agents.map(a => <SelectItem key={a.id} value={a.id}>{a.first_name} {a.last_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type d'intervention</Label>
                <Select value={form.type_intervention} onValueChange={v => setForm(p => ({ ...p, type_intervention: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Heure début</Label>
                <Input type="time" value={form.heure_debut} onChange={e => setForm(p => ({ ...p, heure_debut: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Heure fin</Label>
                <Input type="time" value={form.heure_fin} onChange={e => setForm(p => ({ ...p, heure_fin: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description des prestations</Label>
              <Textarea rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Détail des prestations effectuées..." />
            </div>
            <div className="space-y-2">
              <Label>Observations / Incidents</Label>
              <Textarea rows={3} value={form.observations} onChange={e => setForm(p => ({ ...p, observations: e.target.value }))} placeholder="Observations, incidents notés pendant l'intervention..." />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={closeForm}>Annuler</Button>
              <Button onClick={() => editBon ? updateMut.mutate({ id: editBon.id, data: form }) : createMut.mutate(form)} disabled={createMut.isPending || updateMut.isPending}>
                {createMut.isPending || updateMut.isPending ? 'Enregistrement...' : (editBon ? 'Modifier' : 'Créer')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewBon} onOpenChange={() => setViewBon(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Bon d'intervention {viewBon?.numero}</DialogTitle></DialogHeader>
          {viewBon && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="font-medium">Client :</span> {viewBon.client_name}</div>
                <div><span className="font-medium">Site :</span> {viewBon.site_name}</div>
                <div><span className="font-medium">Agent :</span> {viewBon.agent_name}</div>
                <div><span className="font-medium">Type :</span> {TYPE_LABELS[viewBon.type_intervention]}</div>
                <div><span className="font-medium">Date :</span> {viewBon.date && format(new Date(viewBon.date), 'dd/MM/yyyy', { locale: fr })}</div>
                <div><span className="font-medium">Heures :</span> {viewBon.heure_debut} - {viewBon.heure_fin}</div>
              </div>
              {viewBon.description && <div className="p-3 bg-muted/50 rounded-xl text-sm"><p className="font-medium mb-1">Description :</p><p>{viewBon.description}</p></div>}
              {viewBon.observations && <div className="p-3 bg-amber-50 rounded-xl text-sm border border-amber-200"><p className="font-medium mb-1 text-amber-700">Observations :</p><p className="text-amber-800">{viewBon.observations}</p></div>}
              <div className="flex gap-3 pt-2">
                <Button className="flex-1" onClick={() => exportPDF(viewBon)}>Export PDF</Button>
                {viewBon.status !== 'signe' && (
                  <Button variant="outline" className="flex-1 border-green-300 text-green-700 hover:bg-green-50" onClick={() => { handleSign(viewBon); setViewBon(null); }}>
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Marquer signé
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}