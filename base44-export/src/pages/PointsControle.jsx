import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ScanLine, Pencil, Trash2, Search, MoreVertical, Image as ImageIcon, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import PageHeader from '@/components/shared/PageHeader';
import { useCompany } from '@/lib/useCompany';
import { toast } from 'sonner';
import CheckpointFormDialog from '@/components/checkpoints/CheckpointFormDialog';

export default function PointsControle() {
  const { companyId } = useCompany();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editCp, setEditCp] = useState(null);
  const [selected, setSelected] = useState([]);

  const { data: sites = [] } = useQuery({
    queryKey: ['sites', companyId],
    queryFn: () => base44.entities.Site.filter({ company_id: companyId }),
    enabled: !!companyId,
  });
  const { data: clients = [] } = useQuery({
    queryKey: ['clients', companyId],
    queryFn: () => base44.entities.Client.filter({ company_id: companyId }),
    enabled: !!companyId,
  });
  const { data: rondes = [], isLoading } = useQuery({
    queryKey: ['rondes', companyId],
    queryFn: () => base44.entities.Ronde.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const allCheckpoints = useMemo(() => {
    const list = [];
    rondes.forEach((r) => {
      (r.checkpoints || []).forEach((cp) => {
        list.push({
          id: `${r.id}_${cp.id}`,
          cp_id: cp.id,
          ronde_id: r.id,
          name: cp.name,
          description: cp.description,
          nfc_tag_id: cp.nfc_tag_id,
          site_name: r.site_name,
          client_name: r.client_name,
          photo_url: cp.photo_url,
        });
      });
    });
    return list;
  }, [rondes]);

  const filtered = allCheckpoints.filter((cp) =>
    !search
    || cp.name?.toLowerCase().includes(search.toLowerCase())
    || cp.site_name?.toLowerCase().includes(search.toLowerCase())
    || cp.client_name?.toLowerCase().includes(search.toLowerCase()),
  );

  const toggleSelect = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const toggleAll = () => {
    setSelected(selected.length === filtered.length ? [] : filtered.map((c) => c.id));
  };

  const updateRondeMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Ronde.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rondes'] }); },
  });

  const handleSave = (cpData) => {
    const ronde = rondes.find((r) => r.id === cpData.ronde_id);
    if (!ronde) return;
    const cps = [...(ronde.checkpoints || [])];
    if (cpData.cp_id) {
      const idx = cps.findIndex((c) => c.id === cpData.cp_id);
      if (idx >= 0) cps[idx] = { ...cps[idx], ...cpData };
    } else {
      cps.push({
        id: Date.now().toString(),
        name: cpData.name,
        description: cpData.description,
        nfc_tag_id: cpData.nfc_tag_id,
        photo_url: cpData.photo_url,
        latitude: cpData.latitude,
        longitude: cpData.longitude,
        batiment: cpData.batiment,
        etage: cpData.etage,
        numero_clef: cpData.numero_clef,
        is_start: cpData.is_start,
        is_end: cpData.is_end,
        order: cps.length + 1,
      });
    }
    updateRondeMut.mutate({ id: ronde.id, data: { ...ronde, checkpoints: cps } }, {
      onSuccess: () => {
        toast.success('Point de contrôle enregistré');
        setShowForm(false);
        setEditCp(null);
      },
    });
  };

  const handleDelete = (cp) => {
    const ronde = rondes.find((r) => r.id === cp.ronde_id);
    if (!ronde) return;
    const cps = (ronde.checkpoints || []).filter((c) => c.id !== cp.cp_id);
    updateRondeMut.mutate({ id: ronde.id, data: { ...ronde, checkpoints: cps } }, {
      onSuccess: () => toast.success('Point de contrôle supprimé'),
    });
  };

  return (
    <div className="space-y-4 max-w-full overflow-x-hidden">
      <PageHeader
        title="Points de contrôle"
        subtitle="Gestion des checkpoints NFC des rondes"
        actionLabel="Nouveau point"
        onAction={() => { setEditCp(null); setShowForm(true); }}
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        {selected.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 w-full sm:w-auto justify-center">
                ACTIONS
                <span className="text-xs bg-primary text-primary-foreground rounded-full px-1.5">{selected.length}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem className="text-destructive" onClick={() => setSelected([])}>
                <Trash2 className="w-4 h-4 mr-2" />
                Vider la sélection
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {isLoading && (
          <p className="text-center py-10 text-sm text-muted-foreground">Chargement...</p>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="rounded-xl border bg-card px-4 py-12 text-center text-muted-foreground">
            <ScanLine className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm leading-relaxed">
              Aucun point de contrôle.
              <br />
              Créez-en un ou ajoutez des checkpoints dans les rondes.
            </p>
            <Button
              className="mt-4 gap-2"
              onClick={() => { setEditCp(null); setShowForm(true); }}
            >
              <Plus className="w-4 h-4" />
              Nouveau point
            </Button>
          </div>
        )}
        {filtered.map((cp) => (
          <div key={cp.id} className="rounded-xl border bg-card p-3 shadow-sm">
            <div className="flex items-start gap-3">
              <Checkbox
                checked={selected.includes(cp.id)}
                onCheckedChange={() => toggleSelect(cp.id)}
                className="mt-1"
              />
              {cp.photo_url ? (
                <img src={cp.photo_url} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground shrink-0">
                  {cp.name?.[0]?.toUpperCase() || <ImageIcon className="w-4 h-4" />}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{cp.name || 'Sans nom'}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {[cp.client_name, cp.site_name].filter(Boolean).join(' · ') || 'Site non renseigné'}
                </p>
                {cp.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{cp.description}</p>
                )}
                {cp.nfc_tag_id && (
                  <p className="text-[11px] font-mono text-muted-foreground mt-1 truncate">
                    NFC {cp.nfc_tag_id}
                  </p>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => { setEditCp(cp); setShowForm(true); }}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Modifier
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(cp)}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Supprimer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-muted/30 border-b">
              <tr>
                <th className="w-10 px-4 py-3">
                  <Checkbox
                    checked={selected.length === filtered.length && filtered.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </th>
                <th className="w-10 px-2 py-3" />
                <th className="text-left px-3 py-3 font-medium text-muted-foreground">Nom</th>
                <th className="text-left px-3 py-3 font-medium text-muted-foreground">Client &amp; Site</th>
                <th className="text-left px-3 py-3 font-medium text-muted-foreground">Description</th>
                <th className="w-12 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground">Chargement...</td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-muted-foreground">
                    <ScanLine className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Aucun point de contrôle. Créez-en un ou ajoutez des checkpoints dans les rondes.</p>
                  </td>
                </tr>
              )}
              {filtered.map((cp) => (
                <tr key={cp.id} className="border-b hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={selected.includes(cp.id)}
                      onCheckedChange={() => toggleSelect(cp.id)}
                    />
                  </td>
                  <td className="px-2 py-3">
                    {cp.photo_url ? (
                      <img src={cp.photo_url} alt={cp.name} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground">
                        {cp.name?.[0]?.toUpperCase() || <ImageIcon className="w-4 h-4" />}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 font-medium">{cp.name}</td>
                  <td className="px-3 py-3">
                    <p className="font-medium text-xs">{cp.client_name}</p>
                    <p className="text-xs text-muted-foreground">{cp.site_name}</p>
                  </td>
                  <td className="px-3 py-3 text-sm text-muted-foreground max-w-xs truncate">{cp.description}</td>
                  <td className="px-3 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditCp(cp); setShowForm(true); }}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(cp)}>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-xs text-muted-foreground">
            <span>{filtered.length} point(s)</span>
          </div>
        )}
      </div>

      {showForm && (
        <CheckpointFormDialog
          open={showForm}
          onClose={() => { setShowForm(false); setEditCp(null); }}
          onSave={handleSave}
          checkpoint={editCp}
          rondes={rondes}
          clients={clients}
          sites={sites}
        />
      )}
    </div>
  );
}
