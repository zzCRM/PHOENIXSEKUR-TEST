import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Search, MoreHorizontal, Pencil, Trash2, Building2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import SiteFormModal from '@/components/sites/SiteFormModal';
import { useCompany } from '@/lib/useCompany';
import { toast } from 'sonner';

const typeLabels = { gardiennage: 'Gardiennage', surveillance: 'Surveillance', intervention: 'Intervention', ronde: 'Ronde', evenementiel: 'Événementiel' };

export default function Sites() {
  const { companyId } = useCompany();
  const [showForm, setShowForm] = useState(false);
  const [editSite, setEditSite] = useState(null);
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  const { data: sites = [], isLoading } = useQuery({ queryKey: ['sites', companyId], queryFn: () => base44.entities.Site.filter({ company_id: companyId }, '-created_date'), enabled: !!companyId });
  const { data: clients = [] } = useQuery({ queryKey: ['clients', companyId], queryFn: () => base44.entities.Client.filter({ company_id: companyId }), enabled: !!companyId });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.Site.create({ ...data, company_id: companyId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sites', companyId] }); setShowForm(false); toast.success('Site créé avec succès'); },
    onError: (error) => { toast.error('Échec de la création : ' + (error.message || 'Erreur inconnue')); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Site.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sites', companyId] }); setEditSite(null); toast.success('Site modifié avec succès'); },
    onError: (error) => { toast.error('Échec de la modification : ' + (error.message || 'Erreur inconnue')); },
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Site.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sites', companyId] }); toast.success('Site supprimé avec succès'); },
    onError: (error) => { toast.error('Échec de la suppression : ' + (error.message || 'Erreur inconnue')); },
  });

  const filtered = sites.filter(s => `${s.name} ${s.client_name} ${s.city}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <PageHeader title="Sites" subtitle={`${sites.length} sites enregistrés`} actionLabel="Nouveau site" onAction={() => setShowForm(true)} />

      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Rechercher un site..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {filtered.length === 0 && !isLoading ? (
        <EmptyState icon={MapPin} title="Aucun site" description="Ajoutez votre premier site." actionLabel="Nouveau site" onAction={() => setShowForm(true)} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(site => (
            <Card key={site.id} className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold">{site.name}</p>
                  {site.client_name && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                      <Building2 className="w-3.5 h-3.5" />
                      {site.client_name}
                    </div>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditSite(site)}><Pencil className="w-4 h-4 mr-2" />Modifier</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => deleteMut.mutate(site.id)} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" />Supprimer</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge variant="outline" className="text-xs">{typeLabels[site.type] || site.type}</Badge>
                <StatusBadge status={site.status} />
              </div>
              {site.city && <p className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{site.address ? `${site.address}, ` : ''}{site.city} {site.postal_code}</p>}
            </Card>
          ))}
        </div>
      )}

      <SiteFormModal
        open={showForm || !!editSite}
        onClose={() => { setShowForm(false); setEditSite(null); }}
        onSubmit={(data) => editSite ? updateMut.mutate({ id: editSite.id, data }) : createMut.mutate(data)}
        site={editSite}
        clients={clients}
      />
    </div>
  );
}