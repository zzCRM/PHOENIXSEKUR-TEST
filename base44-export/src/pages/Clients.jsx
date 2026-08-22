import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, MoreHorizontal, Pencil, Trash2, Plus, Filter, Settings, Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import EmptyState from '@/components/shared/EmptyState';
import ClientForm from '@/components/clients/ClientForm';
import { useCompany } from '@/lib/useCompany';
import { toast } from 'sonner';

const STATUS_COLORS = {
  actif: 'bg-green-100 text-green-700 border-green-200',
  inactif: 'bg-red-100 text-red-700 border-red-200',
  prospect: 'bg-yellow-100 text-yellow-700 border-yellow-200',
};
const STATUS_LABELS = { actif: 'Actif', inactif: 'Inactif', prospect: 'Prospect' };

export default function Clients() {
  const { companyId, loading: loadingCompany } = useCompany();
  const [showForm, setShowForm] = useState(false);
  const [editClient, setEditClient] = useState(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const qc = useQueryClient();

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients', companyId],
    queryFn: () => base44.entities.Client.filter({ company_id: companyId }, '-created_date'),
    enabled: !!companyId,
    staleTime: 30000,
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.Client.create({ ...data, company_id: companyId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients', companyId] }); setShowForm(false); toast.success('Client créé avec succès'); },
    onError: (e) => toast.error('Erreur : ' + e.message),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Client.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients', companyId] }); setEditClient(null); toast.success('Client modifié'); },
    onError: (e) => toast.error('Erreur : ' + e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Client.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients', companyId] }); toast.success('Client supprimé'); },
  });

  const filtered = useMemo(() => clients.filter(c => {
    const s = `${c.company_name} ${c.contact_name || ''} ${c.email || ''}`.toLowerCase();
    return s.includes(search.toLowerCase()) && (filterStatus === 'all' || c.status === filterStatus);
  }), [clients, search, filterStatus]);

  const toggleSelect = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = () => setSelected(selected.length === filtered.length ? [] : filtered.map(c => c.id));

  const getInitials = (name) => name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?';
  const getColor = (name) => {
    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-red-500', 'bg-teal-500', 'bg-indigo-500'];
    const i = name ? name.charCodeAt(0) % colors.length : 0;
    return colors[i];
  };

  const showSkeleton = loadingCompany || isLoading;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{!showSkeleton ? `${clients.length} clients enregistrés` : ''}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {selected.length > 0 && (
          <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive">
            Actions <Badge variant="secondary">{selected.length}</Badge>
          </Button>
        )}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <div className="flex gap-1 border rounded-lg p-1">
            {['all','actif','inactif','prospect'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)} className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${filterStatus === s ? 'bg-primary text-white' : 'hover:bg-muted'}`}>
                {s === 'all' ? 'Tous' : STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          <Button size="icon" variant="outline"><Filter className="w-4 h-4" /></Button>
          <Button size="icon" variant="outline"><Settings className="w-4 h-4" /></Button>
          <Button onClick={() => setShowForm(true)} className="gap-2 bg-primary hover:bg-primary/90 rounded-full w-9 h-9 p-0">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Table */}
      {showSkeleton ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Building2} title="Aucun client" description="Ajoutez votre premier client." actionLabel="Nouveau client" onAction={() => setShowForm(true)} />
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          {/* Table header */}
          <div className="grid grid-cols-[40px_40px_1fr_140px_200px_100px_80px_80px_50px] items-center px-4 py-2.5 border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <div className="flex items-center">
              <Checkbox checked={selected.length === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
            </div>
            <div />
            <div>Raison sociale ou Nom prénom</div>
            <div>N° identifiant</div>
            <div>Adresse</div>
            <div>Type</div>
            <div>Prospect</div>
            <div>Statut</div>
            <div />
          </div>

          {/* Rows */}
          {filtered.map(client => (
            <div key={client.id} className="grid grid-cols-[40px_40px_1fr_140px_200px_100px_80px_80px_50px] items-center px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors group">
              <div className="flex items-center">
                <Checkbox checked={selected.includes(client.id)} onCheckedChange={() => toggleSelect(client.id)} />
              </div>
              <div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${getColor(client.company_name)}`}>
                  {getInitials(client.company_name)}
                </div>
              </div>
              <div>
                <button onClick={() => setEditClient(client)} className="text-sm font-semibold hover:text-primary transition-colors text-left">{client.company_name}</button>
                {client.contact_name && <p className="text-xs text-muted-foreground">{client.contact_name}</p>}
              </div>
              <div className="text-xs text-muted-foreground font-mono">{client.siret ? client.siret.slice(0,5) + '-' + clients.indexOf(client) : `CLI-${clients.indexOf(client)+1}`}</div>
              <div className="text-xs text-muted-foreground">
                {client.address && <span>{client.address}<br /></span>}
                {client.postal_code && client.city && <span>{client.postal_code} - {client.city}</span>}
              </div>
              <div>
                <span className="px-2 py-0.5 text-xs rounded border bg-slate-100 text-slate-700 border-slate-200 font-medium">
                  {client.legal_form || 'Entreprise'}
                </span>
              </div>
              <div>
                <span className={`px-2 py-0.5 text-xs rounded border font-medium ${client.status === 'prospect' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                  {client.status === 'prospect' ? 'Oui' : 'Non'}
                </span>
              </div>
              <div>
                <span className={`px-2 py-0.5 text-xs rounded-full border font-medium ${STATUS_COLORS[client.status] || ''}`}>
                  {STATUS_LABELS[client.status] || client.status}
                </span>
              </div>
              <div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditClient(client)}>
                      <Pencil className="w-4 h-4 mr-2" /> Modifier
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => deleteMut.mutate(client.id)} className="text-destructive">
                      <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/20 border-t border-border text-xs text-muted-foreground">
            <span>Lignes par page : 25</span>
            <span>1-{filtered.length} sur {filtered.length}</span>
          </div>
        </div>
      )}

      <ClientForm
        open={showForm || !!editClient}
        onClose={() => { setShowForm(false); setEditClient(null); }}
        onSubmit={(data) => editClient ? updateMut.mutate({ id: editClient.id, data }) : createMut.mutate(data)}
        client={editClient}
      />
    </div>
  );
}