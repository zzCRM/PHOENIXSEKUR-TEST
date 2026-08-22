import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Plus, Pencil, Trash2, AlertTriangle, Shield, Phone, Key, FileText, Users, Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCompany } from '@/lib/useCompany';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const CATEGORY_CONFIG = {
  general: { label: 'Général', icon: FileText, color: 'text-gray-600 bg-gray-100' },
  securite: { label: 'Sécurité', icon: Shield, color: 'text-blue-600 bg-blue-100' },
  urgence: { label: 'Urgence', icon: AlertTriangle, color: 'text-red-600 bg-red-100' },
  acces: { label: 'Accès', icon: Key, color: 'text-amber-600 bg-amber-100' },
  procedures: { label: 'Procédures', icon: FileText, color: 'text-purple-600 bg-purple-100' },
  contacts: { label: 'Contacts', icon: Phone, color: 'text-green-600 bg-green-100' },
};

const PRIORITY_CONFIG = {
  normale: { label: 'Normale', color: 'bg-gray-100 text-gray-700' },
  importante: { label: 'Importante', color: 'bg-amber-100 text-amber-700' },
  critique: { label: 'Critique', color: 'bg-red-100 text-red-700' },
};

export default function CahierConsignesPage() {
  const { companyId, isAdmin } = useCompany();
  const qc = useQueryClient();
  const [selectedSite, setSelectedSite] = useState('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ title: '', content: '', category: 'general', priority: 'normale', site_id: '', site_name: '' });

  const { data: sites = [] } = useQuery({ queryKey: ['sites'], queryFn: () => base44.entities.Site.list() });
  const { data: consignes = [] } = useQuery({
    queryKey: ['cahier_consignes', companyId],
    queryFn: () => base44.entities.CahierConsignes.filter({ company_id: companyId }, '-updated_date', 200),
    enabled: !!companyId,
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.CahierConsignes.create({ ...data, company_id: companyId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cahier_consignes'] }); closeForm(); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.CahierConsignes.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cahier_consignes'] }); closeForm(); },
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.CahierConsignes.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cahier_consignes'] }),
  });

  const openCreate = () => {
    setEditItem(null);
    setForm({ title: '', content: '', category: 'general', priority: 'normale', site_id: '', site_name: '' });
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({ ...item });
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditItem(null); };

  const handleSubmit = () => {
    if (!form.title || !form.content || !form.site_id) return;
    if (editItem) {
      updateMut.mutate({ id: editItem.id, data: form });
    } else {
      createMut.mutate(form);
    }
  };

  const handleSiteChange = (siteId) => {
    const site = sites.find(s => s.id === siteId);
    setForm(prev => ({ ...prev, site_id: siteId, site_name: site?.name || '' }));
  };

  const filtered = consignes.filter(c => {
    const matchSite = selectedSite === 'all' || c.site_id === selectedSite;
    const matchSearch = !search || `${c.title} ${c.content}`.toLowerCase().includes(search.toLowerCase());
    return matchSite && matchSearch;
  });

  return (
    <div>
      <div className="mb-8 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cahiers de consignes</h1>
          <p className="text-muted-foreground mt-1">Consignes par site, accessibles aux agents en mission</p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" />Nouvelle consigne</Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-56" />
        </div>
        <Select value={selectedSite} onValueChange={setSelectedSite}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Tous les sites" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les sites</SelectItem>
            {sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Aucune consigne</p>
          <p className="text-sm mt-1">Créez des consignes pour vos sites.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(c => {
            const cat = CATEGORY_CONFIG[c.category] || CATEGORY_CONFIG.general;
            const prio = PRIORITY_CONFIG[c.priority] || PRIORITY_CONFIG.normale;
            const CatIcon = cat.icon;
            return (
              <Card key={c.id} className={`p-5 ${c.priority === 'critique' ? 'border-l-4 border-l-red-500' : c.priority === 'importante' ? 'border-l-4 border-l-amber-400' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${cat.color}`}>
                      <CatIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="font-semibold">{c.title}</p>
                        <Badge className={`text-xs ${prio.color}`}>{prio.label}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{c.site_name} • {cat.label}</p>
                      <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                      <p className="text-xs text-muted-foreground mt-3">
                        Mis à jour {c.updated_date && format(new Date(c.updated_date), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                      </p>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMut.mutate(c.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={closeForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Modifier la consigne' : 'Nouvelle consigne'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Site *</Label>
              <Select value={form.site_id} onValueChange={handleSiteChange}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un site" /></SelectTrigger>
                <SelectContent>
                  {sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Titre *</Label>
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Ex: Procédure d'ouverture" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priorité</Label>
                <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normale">Normale</SelectItem>
                    <SelectItem value="importante">Importante</SelectItem>
                    <SelectItem value="critique">Critique</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Contenu *</Label>
              <Textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} rows={6} placeholder="Détaillez les consignes..." />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={closeForm}>Annuler</Button>
              <Button onClick={handleSubmit} disabled={!form.title || !form.content || !form.site_id || createMut.isPending || updateMut.isPending}>
                {editItem ? 'Modifier' : 'Créer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}