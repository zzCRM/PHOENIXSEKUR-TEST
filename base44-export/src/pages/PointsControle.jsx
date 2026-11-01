import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ScanLine, Pencil, Trash2, Search, MoreVertical, MapPin, Archive, Power, PowerOff, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import PageHeader from '@/components/shared/PageHeader';
import PointeauFormDialog from '@/components/pointeaux/PointeauFormDialog';
import { useCompany } from '@/lib/useCompany';
import { toast } from 'sonner';
import {
  POINTEAU_BADGE,
  POINTEAU_STATUTS,
  legacyPointsToResolve,
  normalizeNfcTag,
  rondesUsingPointeau,
  statutLabel,
} from '@/lib/pointeaux';

const ALL = '__all__';

export default function PointsControle() {
  const { companyId } = useCompany();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [siteFilter, setSiteFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [defaults, setDefaults] = useState(null);
  const [showLegacy, setShowLegacy] = useState(false);

  const enabled = !!companyId;
  const { data: sites = [] } = useQuery({ queryKey: ['sites', companyId], queryFn: () => base44.entities.Site.filter({ company_id: companyId }), enabled });
  const { data: rondes = [] } = useQuery({ queryKey: ['rondes', companyId], queryFn: () => base44.entities.Ronde.filter({ company_id: companyId }), enabled });
  const { data: pointeaux = [], isLoading } = useQuery({ queryKey: ['pointeaux', companyId], queryFn: () => base44.entities.Pointeau.filter({ company_id: companyId }), enabled });

  const refresh = () => qc.invalidateQueries({ queryKey: ['pointeaux'] });
  const fail = (action) => (error) => toast.error(`${action} : ${error.message || 'erreur inconnue'}`);

  const saveMut = useMutation({
    mutationFn: ({ id, data }) => (id ? base44.entities.Pointeau.update(id, data) : base44.entities.Pointeau.create({ ...data, company_id: companyId })),
    onSuccess: () => { refresh(); setFormOpen(false); setEditing(null); setDefaults(null); toast.success('Pointeau enregistré'); },
    onError: fail('Enregistrement impossible'),
  });
  const statusMut = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Pointeau.update(id, { status }),
    onSuccess: (_data, vars) => { refresh(); toast.success(`Pointeau ${statutLabel(vars.status).toLowerCase()}`); },
    onError: fail('Changement de statut impossible'),
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Pointeau.delete(id),
    onSuccess: () => { refresh(); toast.success('Pointeau supprimé'); },
    onError: fail('Suppression impossible'),
  });

  const rows = useMemo(() => pointeaux.map((pointeau) => ({
    ...pointeau,
    rondes: rondesUsingPointeau(rondes, pointeau.id),
  })), [pointeaux, rondes]);

  const filtered = rows.filter((row) => {
    if (siteFilter !== ALL && row.site_id !== siteFilter) return false;
    if (statusFilter !== ALL && row.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return [row.name, row.site_name, row.client_name, row.nfc_tag_id].some((value) => String(value || '').toLowerCase().includes(q));
  });

  const legacy = useMemo(() => legacyPointsToResolve(rondes, pointeaux), [rondes, pointeaux]);

  const openNew = () => { setEditing(null); setDefaults(null); setFormOpen(true); };
  const openEdit = (row) => { setEditing(row); setDefaults(null); setFormOpen(true); };
  const openFromLegacy = ({ ronde, point }) => {
    setEditing(null);
    setDefaults({
      name: point.name || '',
      description: point.description || '',
      site_id: ronde.site_id || '',
      nfc_tag_id: point.nfc_tag_id || '',
      status: normalizeNfcTag(point.nfc_tag_id) ? 'actif' : 'brouillon',
      latitude: point.latitude ?? '',
      longitude: point.longitude ?? '',
    });
    setFormOpen(true);
  };

  const confirmDelete = (row) => {
    if (window.confirm(`Supprimer définitivement « ${row.name} » ?\nSi ce pointeau est utilisé ou possède un historique, archivez-le plutôt.`)) {
      deleteMut.mutate(row.id);
    }
  };

  return (
    <div className="space-y-4 max-w-full overflow-x-hidden">
      <PageHeader
        title="Pointeaux NFC"
        subtitle="Chaque pointeau appartient à un site et porte un tag NFC unique. Les rondes d'un site n'utilisent que ses pointeaux."
        actionLabel="Nouveau pointeau"
        onAction={openNew}
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input placeholder="Rechercher un pointeau, un tag…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={siteFilter} onValueChange={setSiteFilter}>
          <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="Tous les sites" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous les sites</SelectItem>
            {sites.map((site) => <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Tous les statuts" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous les statuts</SelectItem>
            {POINTEAU_STATUTS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {legacy.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60">
          <button type="button" className="w-full flex items-center gap-2 p-3 text-left" onClick={() => setShowLegacy((v) => !v)}>
            {showLegacy ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-sm font-medium text-amber-900">
              {legacy.length} ancien(s) point(s) de ronde à rattacher à un pointeau
            </span>
          </button>
          {showLegacy && (
            <div className="border-t border-amber-200 divide-y divide-amber-100">
              <p className="p-3 text-xs text-amber-900">
                Ces points existent uniquement dans d'anciennes rondes. Ils ne sont pas convertis automatiquement : créez le pointeau correspondant
                (un point sans tag reste en brouillon). Les anciennes rondes et leur historique restent inchangés.
              </p>
              {legacy.map(({ ronde, point, sansTag, sansSite }, index) => (
                <div key={`${ronde.id}-${point.id}-${index}`} className="flex flex-wrap items-center gap-2 p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{point.name || 'Sans nom'}</p>
                    <p className="text-xs text-muted-foreground truncate">Ronde « {ronde.name} » · {ronde.site_name || 'Aucun site'}</p>
                  </div>
                  {sansSite && <Badge variant="outline" className="text-red-700 border-red-200">Ronde sans site</Badge>}
                  {sansTag && <Badge variant="outline" className="text-amber-800 border-amber-300">Sans tag</Badge>}
                  <Button size="sm" variant="outline" disabled={sansSite} onClick={() => openFromLegacy({ ronde, point })}>
                    Créer le pointeau
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-muted/30 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Pointeau</th>
                <th className="text-left px-3 py-3 font-medium text-muted-foreground">Client &amp; site</th>
                <th className="text-left px-3 py-3 font-medium text-muted-foreground">Tag NFC</th>
                <th className="text-left px-3 py-3 font-medium text-muted-foreground">Statut</th>
                <th className="text-left px-3 py-3 font-medium text-muted-foreground">Rondes</th>
                <th className="w-12 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Chargement…</td></tr>}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-muted-foreground">
                    <ScanLine className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Aucun pointeau. Créez-en un sur un site pour pouvoir l'ajouter à une ronde.</p>
                  </td>
                </tr>
              )}
              {filtered.map((row) => (
                <tr key={row.id} className="border-b hover:bg-muted/20 transition-colors" data-testid="pointeau-row">
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.name}</p>
                    {row.description && <p className="text-xs text-muted-foreground line-clamp-1">{row.description}</p>}
                    {row.latitude != null && row.longitude != null && (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />GPS enregistré</p>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-xs font-medium">{row.client_name}</p>
                    <p className="text-xs text-muted-foreground">{row.site_name}</p>
                  </td>
                  <td className="px-3 py-3">
                    {normalizeNfcTag(row.nfc_tag_id)
                      ? <span className="font-mono text-xs">{row.nfc_tag_id}</span>
                      : <span className="text-xs text-amber-700">Tag manquant</span>}
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant="outline" className={POINTEAU_BADGE[row.status] || ''}>{statutLabel(row.status)}</Badge>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    {row.rondes.length === 0 ? '—' : row.rondes.map((ronde) => ronde.name).join(', ')}
                  </td>
                  <td className="px-3 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Actions"><MoreVertical className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(row)}><Pencil className="w-4 h-4 mr-2" />Modifier</DropdownMenuItem>
                        {row.status !== 'actif' && normalizeNfcTag(row.nfc_tag_id) && row.status !== 'archive' && (
                          <DropdownMenuItem onClick={() => statusMut.mutate({ id: row.id, status: 'actif' })}><Power className="w-4 h-4 mr-2" />Activer</DropdownMenuItem>
                        )}
                        {row.status === 'actif' && (
                          <DropdownMenuItem onClick={() => statusMut.mutate({ id: row.id, status: 'inactif' })}><PowerOff className="w-4 h-4 mr-2" />Désactiver</DropdownMenuItem>
                        )}
                        {row.status !== 'archive' && (
                          <DropdownMenuItem onClick={() => statusMut.mutate({ id: row.id, status: 'archive' })}><Archive className="w-4 h-4 mr-2" />Archiver</DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="text-destructive" onClick={() => confirmDelete(row)}><Trash2 className="w-4 h-4 mr-2" />Supprimer</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t text-xs text-muted-foreground">{filtered.length} pointeau(x)</div>
        )}
      </div>

      <PointeauFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); setDefaults(null); }}
        onSave={(data) => saveMut.mutate({ id: editing?.id, data })}
        pointeau={editing}
        defaults={defaults}
        sites={sites}
        saving={saveMut.isPending}
      />
    </div>
  );
}
