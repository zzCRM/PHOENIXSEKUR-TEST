import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Plus, Check, X, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, differenceInCalendarDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useCompany } from '@/lib/useCompany';
import { toast } from 'sonner';

const TYPE_LABELS = {
  conge_paye: 'Congé payé',
  rtt: 'RTT',
  maladie: 'Maladie',
  sans_solde: 'Sans solde',
  autre: 'Autre',
};

const STATUS_CONFIG = {
  en_attente: { label: 'En attente', color: 'bg-amber-500/10 text-amber-600 border-amber-200', icon: Clock },
  approuve: { label: 'Approuvé', color: 'bg-green-500/10 text-green-600 border-green-200', icon: Check },
  refuse: { label: 'Refusé', color: 'bg-red-500/10 text-red-600 border-red-200', icon: X },
};

export default function Conges() {
  const [showForm, setShowForm] = useState(false);
  const [selectedConge, setSelectedConge] = useState(null);
  const [tabFilter, setTabFilter] = useState('all');
  const [reponse, setReponse] = useState('');
  const { user, companyId, isAdmin } = useCompany();
  const qc = useQueryClient();

  const agentName = user ? (user.full_name || '') : '';

  const [form, setForm] = useState({
    type: 'conge_paye',
    date_debut: '',
    date_fin: '',
    motif: '',
  });

  const { data: conges = [] } = useQuery({
    queryKey: ['conges', companyId],
    queryFn: () => base44.entities.Conge.filter({ company_id: companyId }, '-created_date', 100),
    enabled: !!companyId,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['agents', companyId],
    queryFn: () => base44.entities.Agent.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.Conge.create({
      ...data,
      company_id: companyId,
      agent_id: user?.id,
      agent_name: agentName,
      nb_jours: data.date_debut && data.date_fin
        ? differenceInCalendarDays(new Date(data.date_fin), new Date(data.date_debut)) + 1
        : 0,
      status: 'en_attente',
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['conges'] }); setShowForm(false); setForm({ type: 'conge_paye', date_debut: '', date_fin: '', motif: '' }); toast.success('Demande envoyée avec succès'); },
    onError: (error) => { toast.error('Échec de la demande : ' + (error.message || 'Erreur inconnue')); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Conge.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['conges'] }); setSelectedConge(null); setReponse(''); toast.success('Réponse enregistrée'); },
    onError: (error) => { toast.error('Échec de la réponse : ' + (error.message || 'Erreur inconnue')); },
  });

  const filtered = conges.filter(c => {
    if (tabFilter === 'all') return true;
    return c.status === tabFilter;
  });

  const enAttente = conges.filter(c => c.status === 'en_attente').length;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-primary" />
            Congés & Absences
            {enAttente > 0 && isAdmin && <Badge className="bg-amber-500 text-white">{enAttente} en attente</Badge>}
          </h1>
          <p className="text-muted-foreground mt-1">Gestion des demandes de congés</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Demander un congé
        </Button>
      </div>

      <Tabs value={tabFilter} onValueChange={setTabFilter} className="mb-6">
        <TabsList>
          <TabsTrigger value="all">Tous ({conges.length})</TabsTrigger>
          <TabsTrigger value="en_attente">En attente ({enAttente})</TabsTrigger>
          <TabsTrigger value="approuve">Approuvés</TabsTrigger>
          <TabsTrigger value="refuse">Refusés</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Aucune demande de congé</p>
          </div>
        )}
        {filtered.map(conge => {
          const st = STATUS_CONFIG[conge.status] || STATUS_CONFIG.en_attente;
          const StIcon = st.icon;
          return (
            <Card
              key={conge.id}
              className="p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => { setSelectedConge(conge); setReponse(conge.reponse || ''); }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <CalendarDays className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-sm">{conge.agent_name}</span>
                      <Badge variant="outline" className="text-xs">{TYPE_LABELS[conge.type] || conge.type}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Du <strong>{conge.date_debut && format(new Date(conge.date_debut), 'dd/MM/yyyy', { locale: fr })}</strong> au <strong>{conge.date_fin && format(new Date(conge.date_fin), 'dd/MM/yyyy', { locale: fr })}</strong>
                      {conge.nb_jours > 0 && <span className="ml-1">({conge.nb_jours} jour{conge.nb_jours > 1 ? 's' : ''})</span>}
                    </p>
                    {conge.motif && <p className="text-xs text-muted-foreground mt-1">{conge.motif}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      Déposée le {conge.created_date && format(new Date(conge.created_date), 'dd/MM/yyyy', { locale: fr })}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className={`${st.color} shrink-0 flex items-center gap-1`}>
                  <StIcon className="w-3 h-3" /> {st.label}
                </Badge>
              </div>
              {conge.reponse && (
                <div className="mt-3 p-2 rounded bg-primary/5 border border-primary/20 text-xs">
                  <span className="font-semibold text-primary">Réponse : </span>{conge.reponse}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Nouvelle demande */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Demande de congé</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type de congé</Label>
              <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date de début *</Label>
                <Input type="date" value={form.date_debut} onChange={e => setForm(p => ({ ...p, date_debut: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Date de fin *</Label>
                <Input type="date" value={form.date_fin} onChange={e => setForm(p => ({ ...p, date_fin: e.target.value }))} />
              </div>
            </div>
            {form.date_debut && form.date_fin && new Date(form.date_fin) >= new Date(form.date_debut) && (
              <p className="text-sm text-primary font-medium">
                Durée : {differenceInCalendarDays(new Date(form.date_fin), new Date(form.date_debut)) + 1} jour(s)
              </p>
            )}
            <div className="space-y-2">
              <Label>Motif</Label>
              <Textarea rows={3} value={form.motif} onChange={e => setForm(p => ({ ...p, motif: e.target.value }))} placeholder="Motif de la demande (optionnel)" />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
              <Button
                onClick={() => form.date_debut && form.date_fin && createMut.mutate(form)}
                disabled={!form.date_debut || !form.date_fin || createMut.isPending}
              >
                {createMut.isPending ? 'Envoi...' : 'Soumettre'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Détail / Réponse admin */}
      <Dialog open={!!selectedConge} onOpenChange={() => { setSelectedConge(null); setReponse(''); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Demande de {selectedConge?.agent_name}</DialogTitle>
          </DialogHeader>
          {selectedConge && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-muted/50 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">{TYPE_LABELS[selectedConge.type]}</span>
                  <Badge variant="outline" className={STATUS_CONFIG[selectedConge.status]?.color}>
                    {STATUS_CONFIG[selectedConge.status]?.label}
                  </Badge>
                </div>
                <p className="text-sm">
                  Du <strong>{selectedConge.date_debut && format(new Date(selectedConge.date_debut), 'dd/MM/yyyy', { locale: fr })}</strong> au <strong>{selectedConge.date_fin && format(new Date(selectedConge.date_fin), 'dd/MM/yyyy', { locale: fr })}</strong>
                  {selectedConge.nb_jours > 0 && <span className="ml-1 text-muted-foreground">({selectedConge.nb_jours} jours)</span>}
                </p>
                {selectedConge.motif && <p className="text-sm text-muted-foreground">{selectedConge.motif}</p>}
              </div>

              {isAdmin && (
                <>
                  <div className="space-y-2">
                    <Label>Réponse / Commentaire</Label>
                    <Textarea rows={3} value={reponse} onChange={e => setReponse(e.target.value)} placeholder="Votre réponse..." />
                  </div>
                  <div className="flex gap-3">
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
                      onClick={() => updateMut.mutate({ id: selectedConge.id, data: { status: 'approuve', reponse } })}
                    >
                      <Check className="w-4 h-4" /> Approuver
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1 gap-2"
                      onClick={() => updateMut.mutate({ id: selectedConge.id, data: { status: 'refuse', reponse } })}
                    >
                      <X className="w-4 h-4" /> Refuser
                    </Button>
                  </div>
                </>
              )}
              <Button variant="outline" className="w-full" onClick={() => { setSelectedConge(null); setReponse(''); }}>Fermer</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}