import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/lib/useCompany';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Phone, Download, RefreshCw, Tag, SlidersHorizontal, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const STAGES = [
  { key: 'nouveau', label: 'Nouveau', dot: 'bg-blue-500' },
  { key: 'contacte', label: 'Leads', dot: 'bg-blue-500' },
  { key: 'qualification', label: 'En attente du CNAPS', dot: 'bg-slate-500' },
  { key: 'proposition', label: 'Documents en attente', dot: 'bg-red-500' },
  { key: 'negociation', label: 'Dormants', dot: 'bg-orange-400' },
  { key: 'gagne', label: 'Gagné', dot: 'bg-green-500' },
  { key: 'perdu', label: 'Refus', dot: 'bg-red-500' },
  { key: 'demande_accepte', label: 'Demande accepté', dot: 'bg-teal-500' },
];

const SOURCES = [
  { key: 'appel_entrant', label: 'Appel entrant' },
  { key: 'email', label: 'Email' },
  { key: 'site_web', label: 'Site web' },
  { key: 'recommandation', label: 'Recommandation' },
  { key: 'prospection', label: 'Prospection' },
  { key: 'autre', label: 'Autre' },
];

const SERVICES = [
  { key: 'gardiennage', label: 'Gardiennage' },
  { key: 'surveillance', label: 'Surveillance' },
  { key: 'intervention', label: 'Intervention' },
  { key: 'ronde', label: 'Ronde' },
  { key: 'evenementiel', label: 'Événementiel' },
  { key: 'autre', label: 'Autre' },
];

const EMPTY_FORM = {
  company_name: '', contact_name: '', email: '', phone: '',
  address: '', city: '', postal_code: '',
  source: 'appel_entrant', stage: 'nouveau',
  valeur_estimee: '', probabilite: '', notes: '',
  date_rappel: '', type_service: '', nb_heures_prevues: '',
};

export default function Leads() {
  const { companyId } = useCompany();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [filterStage, setFilterStage] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads', companyId],
    queryFn: () => base44.entities.Lead.filter({ company_id: companyId }, '-created_date'),
    enabled: !!companyId,
    staleTime: 30000,
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.Lead.create({ ...data, company_id: companyId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leads', companyId] }); closeForm(); toast.success('Lead créé'); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Lead.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leads', companyId] }); closeForm(); toast.success('Lead modifié'); },
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Lead.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leads', companyId] }); toast.success('Lead supprimé'); },
  });

  const openNew = () => { setForm(EMPTY_FORM); setEditLead(null); setShowForm(true); };
  const openEdit = (lead) => { setForm({ ...lead }); setEditLead(lead); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditLead(null); };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...form,
      valeur_estimee: form.valeur_estimee ? Number(form.valeur_estimee) : undefined,
      probabilite: form.probabilite ? Number(form.probabilite) : undefined,
      nb_heures_prevues: form.nb_heures_prevues ? Number(form.nb_heures_prevues) : undefined,
    };
    editLead ? updateMut.mutate({ id: editLead.id, data }) : createMut.mutate(data);
  };

  const filtered = useMemo(() => leads.filter(l => {
    const matchSearch = `${l.company_name} ${l.contact_name} ${l.email}`.toLowerCase().includes(search.toLowerCase());
    const matchPhone = !phoneSearch || (l.phone || '').includes(phoneSearch);
    const matchStage = filterStage === 'all' || l.stage === filterStage;
    return matchSearch && matchPhone && matchStage;
  }), [leads, search, phoneSearch, filterStage]);

  const gagnes = leads.filter(l => l.stage === 'gagne').length;

  // Stats par stage
  const stageCounts = STAGES.reduce((acc, s) => {
    acc[s.key] = leads.filter(l => l.stage === s.key).length;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Leads & Prospects</h1>
          <p className="text-muted-foreground text-sm">{leads.length} leads — {gagnes} gagnés</p>
        </div>
        <Button onClick={openNew} size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Nouveau
        </Button>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <RefreshCw className="w-3.5 h-3.5" /> Relances auto
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <Download className="w-3.5 h-3.5" /> Exporter
        </Button>
      </div>

      {/* Filter buttons */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <Tag className="w-3.5 h-3.5" /> Statuts
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <SlidersHorizontal className="w-3.5 h-3.5" /> Critères
        </Button>
      </div>

      {/* Stats grid 2 colonnes */}
      <div className="grid grid-cols-2 gap-3">
        {STAGES.map(s => (
          <button
            key={s.key}
            onClick={() => setFilterStage(filterStage === s.key ? 'all' : s.key)}
            className={`bg-card border rounded-xl p-4 text-left transition-all ${filterStage === s.key ? 'border-blue-400 ring-1 ring-blue-300' : 'border-border hover:border-muted-foreground/30'}`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`w-2 h-2 rounded-full ${s.dot}`} />
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            <p className="text-2xl font-bold">{stageCounts[s.key] || 0}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, email, entreprise..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Numéro de tél..."
            value={phoneSearch}
            onChange={e => setPhoneSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStage} onValueChange={setFilterStage}>
          <SelectTrigger>
            <SelectValue placeholder="Tous les statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {STAGES.map(s => (
              <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List header */}
      <div className="flex text-xs text-muted-foreground font-medium px-1 border-b pb-2">
        <span className="flex-1">Contact</span>
        <span className="w-32 text-right">Entreprise</span>
        <span className="w-6" />
      </div>

      {/* Lead list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Aucun lead trouvé</div>
      ) : (
        <div className="space-y-0 divide-y divide-border">
          {filtered.map(lead => {
            const stage = STAGES.find(s => s.key === lead.stage);
            return (
              <div
                key={lead.id}
                className="flex items-center gap-3 py-3 px-1 hover:bg-muted/40 cursor-pointer group transition-colors"
                onClick={() => openEdit(lead)}
              >
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary">
                    {(lead.contact_name || lead.company_name || '?')[0].toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{lead.contact_name || lead.company_name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {stage && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${stage.dot}`} />}
                    <span className="text-xs text-muted-foreground truncate">{stage?.label || lead.stage}</span>
                    {lead.phone && <span className="text-xs text-muted-foreground">· {lead.phone}</span>}
                  </div>
                </div>

                {/* Company */}
                <div className="w-28 text-right">
                  <p className="text-xs text-muted-foreground truncate">{lead.company_name}</p>
                  {lead.valeur_estimee && <p className="text-xs font-semibold text-green-600">{lead.valeur_estimee.toLocaleString('fr-FR')} €</p>}
                </div>

                {/* Actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                    <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-opacity">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={e => { e.stopPropagation(); openEdit(lead); }}>
                      <Pencil className="w-3.5 h-3.5 mr-2" />Modifier
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={e => { e.stopPropagation(); deleteMut.mutate(lead.id); }} className="text-destructive">
                      <Trash2 className="w-3.5 h-3.5 mr-2" />Supprimer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={closeForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editLead ? 'Modifier le lead' : 'Nouveau lead'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Société *</Label>
                <Input value={form.company_name} onChange={e => setForm(p => ({ ...p, company_name: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Contact</Label>
                <Input value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Téléphone</Label>
                <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Source</Label>
                <Select value={form.source} onValueChange={v => setForm(p => ({ ...p, source: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SOURCES.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Statut</Label>
                <Select value={form.stage} onValueChange={v => setForm(p => ({ ...p, stage: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STAGES.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Valeur estimée (€)</Label>
                <Input type="number" value={form.valeur_estimee} onChange={e => setForm(p => ({ ...p, valeur_estimee: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Probabilité (%)</Label>
                <Input type="number" min="0" max="100" value={form.probabilite} onChange={e => setForm(p => ({ ...p, probabilite: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Type de service</Label>
                <Select value={form.type_service} onValueChange={v => setForm(p => ({ ...p, type_service: v }))}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                  <SelectContent>{SERVICES.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Date de rappel</Label>
                <Input type="date" value={form.date_rappel} onChange={e => setForm(p => ({ ...p, date_rappel: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Ville</Label>
                <Input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={closeForm}>Annuler</Button>
              <Button type="submit">{editLead ? 'Modifier' : 'Créer le lead'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}