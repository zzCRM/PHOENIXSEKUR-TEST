import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Search, MoreHorizontal, Pencil, Trash2, Phone, Mail } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import AgentForm from '@/components/agents/AgentForm';
import AgentDetailView from '@/components/agents/AgentDetailView';
import { useCompany } from '@/lib/useCompany';
import { toast } from 'sonner';

export default function Agents() {
  const { companyId, loading: loadingCompany } = useCompany();
  const [showForm, setShowForm] = useState(false);
  const [editAgent, setEditAgent] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['agents', companyId],
    queryFn: () => base44.entities.Agent.filter({ company_id: companyId }, '-created_date'),
    enabled: !!companyId,
    staleTime: 30000,
  });

  const createMut = useMutation({
    mutationFn: async (data) => {
      const { creer_compte_phoenix, ...agentData } = data;
      const created = await base44.entities.Agent.create({ ...agentData, company_id: companyId });
      let invite = null;
      if (creer_compte_phoenix && agentData.email) {
        invite = await base44.users.inviteUser(agentData.email, 'user');
      }
      return { created, invite };
    },
    onSuccess: ({ invite }) => {
      qc.invalidateQueries({ queryKey: ['agents', companyId] });
      setShowForm(false);
      if (invite?.email_sent) toast.success('Collaborateur créé — invitation envoyée par email');
      else if (invite?.invite_url) toast.warning('Collaborateur créé — invitation créée, email non envoyé (copiez le lien depuis Utilisateurs)');
      else if (invite?.already_registered) toast.success('Collaborateur créé — un compte existe déjà pour cet email');
      else toast.success('Collaborateur créé avec succès');
    },
    onError: (error) => { toast.error('Échec de la création : ' + (error.message || 'Erreur inconnue')); },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }) => {
      const { creer_compte_phoenix, ...agentData } = data;
      const updated = await base44.entities.Agent.update(id, agentData);
      let invite = null;
      if (creer_compte_phoenix && agentData.email) {
        invite = await base44.users.inviteUser(agentData.email, 'user');
      }
      return { updated, invite };
    },
    onSuccess: ({ invite }) => {
      qc.invalidateQueries({ queryKey: ['agents', companyId] });
      setEditAgent(null);
      if (invite?.email_sent) toast.success('Fiche enregistrée — invitation envoyée');
      else toast.success('Agent modifié avec succès');
    },
    onError: (error) => { toast.error('Échec de la modification : ' + (error.message || 'Erreur inconnue')); },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Agent.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agents', companyId] }); toast.success('Agent supprimé avec succès'); },
    onError: (error) => { toast.error('Échec de la suppression : ' + (error.message || 'Erreur inconnue')); },
  });

  const filtered = agents.filter(a =>
    `${a.first_name} ${a.last_name} ${a.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const showSkeleton = loadingCompany || isLoading;

  return (
    <div>
      {selectedAgent && (
        <AgentDetailView agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
      )}

      <PageHeader title="Collaborateurs" subtitle={!showSkeleton ? `${agents.length} collaborateurs enregistrés` : ''} actionLabel="Nouveau collaborateur" onAction={() => setShowForm(true)} />
      
      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Rechercher un collaborateur..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {showSkeleton ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-5 animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-full bg-muted" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-muted rounded w-32" />
                  <div className="h-3 bg-muted rounded w-16" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-muted rounded w-48" />
                <div className="h-3 bg-muted rounded w-32" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title="Aucun collaborateur" description="Ajoutez votre premier collaborateur pour commencer." actionLabel="Nouveau collaborateur" onAction={() => setShowForm(true)} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(agent => (
            <Card key={agent.id} className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">
                      {agent.first_name?.[0]}{agent.last_name?.[0]}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold">{agent.first_name} {agent.last_name}</p>
                    <StatusBadge status={agent.status} />
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                   <DropdownMenuItem onClick={() => setSelectedAgent(agent)}>
                     <Pencil className="w-4 h-4 mr-2" /> Voir la fiche
                   </DropdownMenuItem>
                   <DropdownMenuItem onClick={() => deleteMut.mutate(agent.id)} className="text-destructive">
                     <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                   </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="space-y-1.5 text-sm text-muted-foreground">
                {agent.email && <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" />{agent.email}</div>}
                {agent.phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" />{agent.phone}</div>}
                {agent.card_number && <div className="text-xs">Carte pro: {agent.card_number}</div>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <AgentForm
        open={showForm || !!editAgent}
        onClose={() => { setShowForm(false); setEditAgent(null); }}
        onSubmit={(data) => editAgent ? updateMut.mutate({ id: editAgent.id, data }) : createMut.mutate(data)}
        agent={editAgent}
      />
    </div>
  );
}