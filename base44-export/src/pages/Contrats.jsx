import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileSignature, Plus, Search, Pencil, Trash2, Send, CheckCircle2, MoreHorizontal, Download } from 'lucide-react';
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

const TYPE_LABELS = { cdi: 'CDI', cdd: 'CDD', apprentissage: 'Apprentissage', interim: 'Intérim', client: 'Contrat client' };
const STATUS_CONFIG = {
  brouillon: { label: 'Brouillon', color: 'bg-muted text-muted-foreground border-border' },
  envoye: { label: 'Envoyé', color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
  signe: { label: 'Signé', color: 'bg-green-500/10 text-green-700 border-green-200' },
  refuse: { label: 'Refusé', color: 'bg-red-500/10 text-red-600 border-red-200' },
  expire: { label: 'Expiré', color: 'bg-orange-500/10 text-orange-600 border-orange-200' },
};

const defaultForm = { type_contrat: 'cdi', target_type: 'agent', target_id: '', target_name: '', title: '', content: '', date_debut: '', date_fin: '', signataire_email: '', notes: '' };

export default function Contrats() {
  const { companyId, isAdmin } = useCompany();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [tabFilter, setTabFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editContrat, setEditContrat] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);

  const { data: contrats = [], isLoading } = useQuery({
    queryKey: ['contrats', companyId],
    queryFn: () => base44.entities.Contrat.filter({ company_id: companyId }, '-created_date', 100),
    enabled: !!companyId,
  });
  const { data: agents = [] } = useQuery({ queryKey: ['agents', companyId], queryFn: () => base44.entities.Agent.filter({ company_id: companyId }), enabled: !!companyId });
  const { data: clients = [] } = useQuery({ queryKey: ['clients', companyId], queryFn: () => base44.entities.Client.filter({ company_id: companyId }), enabled: !!companyId });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.Contrat.create({ ...data, company_id: companyId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contrats'] }); closeForm(); toast.success('Contrat créé'); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Contrat.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contrats'] }); closeForm(); toast.success('Contrat mis à jour'); },
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Contrat.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contrats'] }); toast.success('Contrat supprimé'); },
  });

  const closeForm = () => { setShowForm(false); setEditContrat(null); setForm(defaultForm); setFile(null); };

  const openEdit = (c) => {
    setEditContrat(c);
    setForm({ type_contrat: c.type_contrat, target_type: c.target_type, target_id: c.target_id || '', target_name: c.target_name || '', title: c.title, content: c.content || '', date_debut: c.date_debut || '', date_fin: c.date_fin || '', signataire_email: c.signataire_email || '', notes: c.notes || '' });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    let file_url = editContrat?.file_url;
    if (file) {
      setUploading(true);
      const res = await base44.integrations.Core.UploadFile({ file });
      file_url = res.file_url;
      setUploading(false);
    }
    const data = { ...form, file_url };
    if (editContrat) updateMut.mutate({ id: editContrat.id, data });
    else createMut.mutate(data);
  };

  const handleDemandeSignature = (contrat) => {
    updateMut.mutate({ id: contrat.id, data: { status: 'envoye', signature_demandee_at: new Date().toISOString() } });
    toast.info('Demande de signature enregistrée');
  };

  const handleMarkSigned = (contrat) => {
    updateMut.mutate({ id: contrat.id, data: { status: 'signe', signature_at: new Date().toISOString() } });
  };

  const filtered = contrats
    .filter(c => tabFilter === 'all' || c.status === tabFilter)
    .filter(c => `${c.title} ${c.target_name}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileSignature className="w-6 h-6 text-primary" /> Contrats
          </h1>
          <p className="text-muted-foreground mt-1">Contrats de travail et contrats clients</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Nouveau contrat
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Tabs value={tabFilter} onValueChange={setTabFilter}>
          <TabsList>
            <TabsTrigger value="all">Tous</TabsTrigger>
            <TabsTrigger value="brouillon">Brouillon</TabsTrigger>
            <TabsTrigger value="envoye">Envoyés</TabsTrigger>
            <TabsTrigger value="signe">Signés</TabsTrigger>
            <TabsTrigger value="expire">Expirés</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileSignature className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Aucun contrat trouvé</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(c => {
            const st = STATUS_CONFIG[c.status] || STATUS_CONFIG.brouillon;
            return (
              <Card key={c.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <FileSignature className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{c.title}</p>
                      <p className="text-xs text-muted-foreground">{c.target_name}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-3.5 h-3.5" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(c)}><Pencil className="w-4 h-4 mr-2" />Modifier</DropdownMenuItem>
                      {c.status === 'brouillon' && <DropdownMenuItem onClick={() => handleDemandeSignature(c)}><Send className="w-4 h-4 mr-2" />Demander signature</DropdownMenuItem>}
                      {c.status === 'envoye' && <DropdownMenuItem onClick={() => handleMarkSigned(c)}><CheckCircle2 className="w-4 h-4 mr-2" />Marquer signé</DropdownMenuItem>}
                      {c.file_url && <DropdownMenuItem asChild><a href={c.file_url} target="_blank" rel="noopener noreferrer"><Download className="w-4 h-4 mr-2" />Télécharger PDF</a></DropdownMenuItem>}
                      <DropdownMenuItem className="text-destructive" onClick={() => deleteMut.mutate(c.id)}><Trash2 className="w-4 h-4 mr-2" />Supprimer</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge variant="outline" className="text-xs">{TYPE_LABELS[c.type_contrat] || c.type_contrat}</Badge>
                  <Badge variant="outline" className={`text-xs ${st.color}`}>{st.label}</Badge>
                </div>
                {c.date_debut && (
                  <p className="text-xs text-muted-foreground">
                    Début : {format(new Date(c.date_debut), 'dd/MM/yyyy', { locale: fr })}
                    {c.date_fin && ` → ${format(new Date(c.date_fin), 'dd/MM/yyyy', { locale: fr })}`}
                  </p>
                )}
                {c.signature_at && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Signé le {format(new Date(c.signature_at), 'dd/MM/yyyy', { locale: fr })}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={closeForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editContrat ? 'Modifier le contrat' : 'Nouveau contrat'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type de contrat</Label>
                <Select value={form.type_contrat} onValueChange={v => setForm(p => ({ ...p, type_contrat: v, target_type: v === 'client' ? 'client' : 'agent' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{form.type_contrat === 'client' ? 'Client' : 'Agent'}</Label>
                <Select value={form.target_id} onValueChange={v => {
                  const list = form.type_contrat === 'client' ? clients : agents;
                  const item = list.find(i => i.id === v);
                  const name = form.type_contrat === 'client' ? item?.company_name : (item ? `${item.first_name} ${item.last_name}` : '');
                  setForm(p => ({ ...p, target_id: v, target_name: name || '' }));
                }}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {form.type_contrat === 'client'
                      ? clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)
                      : agents.map(a => <SelectItem key={a.id} value={a.id}>{a.first_name} {a.last_name}</SelectItem>)
                    }
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Titre du contrat *</Label>
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="ex: CDI Agent de sécurité" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date de début</Label>
                <Input type="date" value={form.date_debut} onChange={e => setForm(p => ({ ...p, date_debut: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Date de fin (vide = CDI)</Label>
                <Input type="date" value={form.date_fin} onChange={e => setForm(p => ({ ...p, date_fin: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email du signataire</Label>
              <Input type="email" value={form.signataire_email} onChange={e => setForm(p => ({ ...p, signataire_email: e.target.value }))} placeholder="email pour la signature électronique" />
            </div>
            <div className="space-y-2">
              <Label>Contenu / Clauses</Label>
              <Textarea rows={6} value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} placeholder="Saisir les clauses du contrat..." />
            </div>
            <div className="space-y-2">
              <Label>Document PDF (optionnel)</Label>
              <Input type="file" accept=".pdf,.doc,.docx" onChange={e => setFile(e.target.files[0])} />
              {editContrat?.file_url && !file && <p className="text-xs text-muted-foreground">Un fichier existe déjà. En uploader un nouveau remplacera l'ancien.</p>}
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={closeForm}>Annuler</Button>
              <Button onClick={handleSubmit} disabled={!form.title || uploading || createMut.isPending || updateMut.isPending}>
                {uploading || createMut.isPending || updateMut.isPending ? 'Enregistrement...' : (editContrat ? 'Modifier' : 'Créer')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}