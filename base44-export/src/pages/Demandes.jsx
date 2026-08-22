import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Plus, Clock, CheckCircle2, AlertTriangle, User, Building2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import PageHeader from '@/components/shared/PageHeader';
import { useCompany } from '@/lib/useCompany';

const STATUS_CONFIG = {
  nouvelle: { label: 'Nouvelle', color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
  en_cours: { label: 'En cours', color: 'bg-amber-500/10 text-amber-600 border-amber-200' },
  resolue: { label: 'Résolue', color: 'bg-green-500/10 text-green-600 border-green-200' },
  fermee: { label: 'Fermée', color: 'bg-gray-500/10 text-gray-600 border-gray-200' },
};

const PRIORITY_CONFIG = {
  basse: { label: 'Basse', color: 'text-gray-500' },
  normale: { label: 'Normale', color: 'text-blue-500' },
  haute: { label: 'Haute', color: 'text-orange-500' },
  urgente: { label: 'Urgente', color: 'text-red-500' },
};

export default function Demandes() {
  const [showForm, setShowForm] = useState(false);
  const [selectedDemande, setSelectedDemande] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [response, setResponse] = useState('');
  const { companyId } = useCompany();
  const qc = useQueryClient();

  const [form, setForm] = useState({ subject: '', message: '', priority: 'normale', from_type: 'client', from_name: '', site_name: '' });

  const { data: demandes = [] } = useQuery({
    queryKey: ['demandes', companyId],
    queryFn: () => base44.entities.Demande.filter({ company_id: companyId }, '-created_date', 100),
    enabled: !!companyId,
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.Demande.create({ ...data, company_id: companyId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['demandes'] }); setShowForm(false); setForm({ subject: '', message: '', priority: 'normale', from_type: 'client', from_name: '', site_name: '' }); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Demande.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['demandes'] }); setSelectedDemande(null); setResponse(''); },
  });

  const filtered = demandes.filter(d => statusFilter === 'all' || d.status === statusFilter);
  const newCount = demandes.filter(d => d.status === 'nouvelle').length;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            Demandes
            {newCount > 0 && <Badge className="bg-blue-500 text-white">{newCount} nouvelles</Badge>}
          </h1>
          <p className="text-muted-foreground mt-1">Demandes des clients et collaborateurs</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2"><Plus className="w-4 h-4" />Nouvelle demande</Button>
      </div>

      <Tabs value={statusFilter} onValueChange={setStatusFilter} className="mb-6">
        <TabsList>
          <TabsTrigger value="all">Toutes ({demandes.length})</TabsTrigger>
          <TabsTrigger value="nouvelle">Nouvelles ({newCount})</TabsTrigger>
          <TabsTrigger value="en_cours">En cours</TabsTrigger>
          <TabsTrigger value="resolue">Résolues</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Aucune demande</p>
          </div>
        )}
        {filtered.map(demande => {
          const statusConf = STATUS_CONFIG[demande.status] || STATUS_CONFIG.nouvelle;
          const priorityConf = PRIORITY_CONFIG[demande.priority] || PRIORITY_CONFIG.normale;
          return (
            <Card key={demande.id} className="p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => { setSelectedDemande(demande); setResponse(demande.response || ''); }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`p-2 rounded-lg border shrink-0 ${demande.from_type === 'client' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-purple-50 border-purple-200 text-purple-600'}`}>
                    {demande.from_type === 'client' ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant="outline" className="text-xs">{demande.from_type === 'client' ? 'Client' : 'Agent'}</Badge>
                      {demande.from_name && <span className="text-xs text-muted-foreground">{demande.from_name}</span>}
                      <span className={`text-xs font-medium ${priorityConf.color}`}>● {priorityConf.label}</span>
                    </div>
                    <p className="font-medium truncate">{demande.subject}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{demande.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {demande.created_date && format(new Date(demande.created_date), 'dd/MM/yyyy HH:mm', { locale: fr })}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className={statusConf.color}>{statusConf.label}</Badge>
              </div>
            </Card>
          );
        })}
      </div>

      {/* New demande form */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nouvelle demande</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>De la part de</Label>
                <Select value={form.from_type} onValueChange={v => setForm(p => ({ ...p, from_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="agent">Agent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priorité</Label>
                <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basse">Basse</SelectItem>
                    <SelectItem value="normale">Normale</SelectItem>
                    <SelectItem value="haute">Haute</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input value={form.from_name} onChange={e => setForm(p => ({ ...p, from_name: e.target.value }))} placeholder="Nom du demandeur" />
            </div>
            <div className="space-y-2">
              <Label>Sujet *</Label>
              <Input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Message *</Label>
              <Textarea rows={4} value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
              <Button onClick={() => form.subject && form.message && createMut.mutate(form)} disabled={!form.subject || !form.message}>Envoyer</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail / response dialog */}
      <Dialog open={!!selectedDemande} onOpenChange={() => { setSelectedDemande(null); setResponse(''); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Demande : {selectedDemande?.subject}</DialogTitle></DialogHeader>
          {selectedDemande && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-muted/50">
                <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                  <span>{selectedDemande.from_type === 'client' ? 'Client' : 'Agent'}</span>
                  {selectedDemande.from_name && <span>• {selectedDemande.from_name}</span>}
                </div>
                <p className="text-sm">{selectedDemande.message}</p>
              </div>
              {selectedDemande.response && (
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <p className="text-xs font-semibold text-primary mb-1">Réponse de l'équipe</p>
                  <p className="text-sm">{selectedDemande.response}</p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Répondre / Mettre à jour</Label>
                <Textarea rows={3} value={response} onChange={e => setResponse(e.target.value)} placeholder="Votre réponse..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Statut</Label>
                  <Select value={selectedDemande.status} onValueChange={v => setSelectedDemande(p => ({ ...p, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nouvelle">Nouvelle</SelectItem>
                      <SelectItem value="en_cours">En cours</SelectItem>
                      <SelectItem value="resolue">Résolue</SelectItem>
                      <SelectItem value="fermee">Fermée</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => { setSelectedDemande(null); setResponse(''); }}>Fermer</Button>
                <Button onClick={() => updateMut.mutate({ id: selectedDemande.id, data: { status: selectedDemande.status, response, responded_at: new Date().toISOString() } })}>
                  Enregistrer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}