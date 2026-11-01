import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Pencil, Trash2, ChevronDown, ChevronRight, CheckCircle2, ScanLine, Camera, Settings, FileText, ArrowUp, ArrowDown, AlertTriangle, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/useCompany';
import {
  findPointeauForLegacyPoint,
  isPointeauUtilisable,
  normalizeNfcTag,
  rondePointCount,
  rondeUsesPoints,
} from '@/lib/pointeaux';

const SENS_RONDE = ['Les deux sens', 'Sens horaire uniquement', 'Sens anti-horaire uniquement'];

export default function Rondes() {
  const { companyId } = useCompany();
  const [showForm, setShowForm] = useState(false);
  const [editRonde, setEditRonde] = useState(null);
  const [expanded, setExpanded] = useState({});
  const qc = useQueryClient();

  const enabled = !!companyId;
  const { data: rondes = [] } = useQuery({ queryKey: ['rondes', companyId], queryFn: () => base44.entities.Ronde.filter({ company_id: companyId }), enabled });
  const { data: sites = [] } = useQuery({ queryKey: ['sites', companyId], queryFn: () => base44.entities.Site.filter({ company_id: companyId }), enabled });
  const { data: pointeaux = [] } = useQuery({ queryKey: ['pointeaux', companyId], queryFn: () => base44.entities.Pointeau.filter({ company_id: companyId }), enabled });

  const pointeauxById = useMemo(() => new Map(pointeaux.map((p) => [p.id, p])), [pointeaux]);

  const onError = (label) => (error) => toast.error(`${label} : ${error.message || 'Erreur inconnue'}`);
  const createMut = useMutation({
    mutationFn: (data) => base44.entities.Ronde.create({ ...data, company_id: companyId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rondes'] }); setShowForm(false); toast.success('Ronde créée avec succès'); },
    onError: onError('Échec de la création'),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Ronde.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rondes'] }); setEditRonde(null); toast.success('Ronde modifiée avec succès'); },
    onError: onError('Échec de la modification'),
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Ronde.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rondes'] }); toast.success('Ronde supprimée avec succès'); },
    onError: onError('Suppression impossible'),
  });

  const confirmDelete = (ronde) => {
    if (window.confirm(`Supprimer la ronde « ${ronde.name} » ?\nSi elle a déjà été effectuée, passez-la en inactive pour conserver son historique.`)) {
      deleteMut.mutate(ronde.id);
    }
  };

  const toggle = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const detailPoints = (ronde) => {
    if (rondeUsesPoints(ronde)) {
      return [...ronde.points]
        .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))
        .map((entry, index) => {
          const pointeau = pointeauxById.get(entry.pointeau_id);
          return { key: entry.pointeau_id, order: index + 1, name: pointeau?.name || 'Pointeau introuvable', description: pointeau?.description, tag: pointeau?.nfc_tag_id, usable: isPointeauUtilisable(pointeau) };
        });
    }
    return (ronde.checkpoints || []).map((cp, index) => ({ key: `${cp.id}-${index}`, order: cp.order || index + 1, name: cp.name, description: cp.description, tag: cp.nfc_tag_id, usable: Boolean(normalizeNfcTag(cp.nfc_tag_id)), legacy: true }));
  };

  return (
    <div>
      <PageHeader title="Rondes" subtitle="Tournées de sécurité par site, avec les pointeaux NFC du site" actionLabel="Nouvelle ronde" onAction={() => setShowForm(true)} />

      <div className="space-y-4">
        {rondes.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Aucune ronde définie. Créez d'abord les pointeaux d'un site, puis votre première tournée.</p>
          </div>
        )}
        {rondes.map((ronde) => (
          <Card key={ronde.id} className="overflow-hidden" data-testid="ronde-card">
            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors gap-2" onClick={() => toggle(ronde.id)}>
              <div className="flex items-center gap-3 min-w-0">
                {expanded[ronde.id] ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                <div className="min-w-0">
                  <p className="font-semibold truncate">{ronde.name}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {ronde.site_id ? <>{ronde.site_name} {ronde.client_name && `• ${ronde.client_name}`}</> : <span className="text-red-600">Aucun site : à rattacher</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!rondeUsesPoints(ronde) && (ronde.checkpoints || []).length > 0 && (
                  <Badge variant="outline" className="text-amber-800 border-amber-300 hidden sm:inline-flex">Ancien format</Badge>
                )}
                <Badge variant="outline">{rondePointCount(ronde)} points</Badge>
                <StatusBadge status={ronde.status} />
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Modifier" onClick={(e) => { e.stopPropagation(); setEditRonde(ronde); }}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label="Supprimer" onClick={(e) => { e.stopPropagation(); confirmDelete(ronde); }}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {expanded[ronde.id] && (
              <div className="border-t border-border px-4 py-3 bg-muted/20">
                {ronde.description && <p className="text-sm text-muted-foreground mb-3">{ronde.description}</p>}
                <div className="space-y-2">
                  {detailPoints(ronde).length === 0 && <p className="text-sm text-muted-foreground">Aucun point de contrôle défini</p>}
                  {detailPoints(ronde).map((point) => (
                    <div key={point.key} className="flex items-center gap-3 p-2 rounded-lg bg-background border border-border">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">{point.order}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{point.name}</p>
                        {point.description && <p className="text-xs text-muted-foreground">{point.description}</p>}
                      </div>
                      {point.usable
                        ? <ScanLine className="w-4 h-4 text-primary shrink-0" title={point.tag ? `NFC : ${point.tag}` : 'NFC'} />
                        : <Badge variant="outline" className="text-amber-800 border-amber-300">{point.legacy ? 'Sans tag' : 'Inutilisable'}</Badge>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      <RondeFormDialog
        open={showForm || !!editRonde}
        onClose={() => { setShowForm(false); setEditRonde(null); }}
        onSubmit={(data) => (editRonde ? updateMut.mutate({ id: editRonde.id, data }) : createMut.mutate(data))}
        saving={createMut.isPending || updateMut.isPending}
        ronde={editRonde}
        sites={sites}
        pointeaux={pointeaux}
      />
    </div>
  );
}

const emptyForm = () => ({
  name: '', site_id: '', site_name: '', client_id: '', client_name: '', description: '', consignes: '', photo_url: '',
  allow_skip: false, sens_ronde: 'Les deux sens', status: 'actif',
});

function RondeFormDialog({ open, onClose, onSubmit, saving, ronde, sites, pointeaux = [] }) {
  const [activeTab, setActiveTab] = useState('general');
  const [form, setForm] = useState(emptyForm());
  const [pointIds, setPointIds] = useState([]);
  const [pointsTouched, setPointsTouched] = useState(false);
  const [unresolved, setUnresolved] = useState([]);

  useEffect(() => {
    if (!open) return;
    setActiveTab('general');
    setPointsTouched(false);
    if (!ronde) {
      setForm(emptyForm());
      setPointIds([]);
      setUnresolved([]);
      return;
    }
    setForm({ ...emptyForm(), ...ronde });
    if (rondeUsesPoints(ronde)) {
      setPointIds([...ronde.points].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0)).map((entry) => entry.pointeau_id));
      setUnresolved([]);
    } else {
      const ids = [];
      const missing = [];
      for (const point of ronde.checkpoints || []) {
        const match = findPointeauForLegacyPoint(pointeaux, ronde, point);
        if (match && isPointeauUtilisable(match) && !ids.includes(match.id)) ids.push(match.id);
        else missing.push(point);
      }
      setPointIds(ids);
      setUnresolved(missing);
    }
  }, [ronde, open, pointeaux]);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const pointeauxById = useMemo(() => new Map(pointeaux.map((p) => [p.id, p])), [pointeaux]);

  const handleSiteChange = (siteId) => {
    const site = sites.find((item) => item.id === siteId);
    setForm((prev) => ({ ...prev, site_id: siteId, site_name: site?.name || '', client_id: site?.client_id || '', client_name: site?.client_name || '' }));
    const kept = pointIds.filter((id) => pointeauxById.get(id)?.site_id === siteId);
    if (kept.length !== pointIds.length) {
      setPointIds(kept);
      setPointsTouched(true);
    }
  };

  const sitePointeaux = useMemo(
    () => pointeaux.filter((p) => p.site_id === form.site_id && p.status !== 'archive'),
    [pointeaux, form.site_id],
  );

  const addPoint = (id) => { setPointIds((prev) => (prev.includes(id) ? prev : [...prev, id])); setPointsTouched(true); };
  const removePoint = (id) => { setPointIds((prev) => prev.filter((value) => value !== id)); setPointsTouched(true); };
  const movePoint = (index, delta) => {
    setPointIds((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setPointsTouched(true);
  };

  const canSave = form.name.trim() && form.site_id && !saving;

  const submit = () => {
    const { points: _points, checkpoints: _checkpoints, id: _id, created_date: _c, updated_date: _u, ...rest } = form;
    const payload = { ...rest, name: form.name.trim() };
    if (!ronde || rondeUsesPoints(ronde) || pointsTouched) {
      payload.points = pointIds.map((pointeau_id) => ({ pointeau_id }));
    }
    onSubmit(payload);
  };

  const TABS = [
    { key: 'general', label: 'Général' },
    { key: 'points', label: `Points de contrôle (${pointIds.length})` },
  ];
  const legacyWarning = ronde && !rondeUsesPoints(ronde) && unresolved.length > 0;

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="w-[calc(100vw-0.75rem)] max-w-3xl max-h-[100dvh] sm:max-h-[92vh] overflow-hidden p-0 flex flex-col gap-0">
        <div className="flex items-center justify-between px-3 sm:px-5 py-3 border-b shrink-0 gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold min-w-0">
            <div className="w-5 h-5 rounded bg-muted flex items-center justify-center shrink-0"><FileText className="w-3 h-3" /></div>
            <span className="truncate">{ronde ? 'Modifier la ronde' : "Ajout d'une ronde"}</span>
          </div>
        </div>

        <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
          <div className="md:hidden flex border-b bg-muted/20 shrink-0">
            {TABS.map((tab) => (
              <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
                className={cn('flex-1 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors', activeTab === tab.key ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-muted-foreground')}>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="hidden md:block w-52 shrink-0 border-r bg-muted/10 py-3">
            {TABS.map((tab) => (
              <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
                className={cn('w-full text-left px-4 py-2.5 text-sm transition-colors', activeTab === tab.key ? 'border-l-2 border-primary bg-primary/5 text-primary font-medium' : 'text-muted-foreground hover:bg-muted/30')}>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5 space-y-6 min-w-0">
            {activeTab === 'general' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs mb-1.5 block">Client</Label>
                    <Input value={form.client_name} readOnly placeholder="— auto via le site —" className="bg-muted/30" />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">Site *</Label>
                    <Select value={form.site_id} onValueChange={handleSiteChange}>
                      <SelectTrigger data-testid="ronde-site"><SelectValue placeholder="Sélectionner un site" /></SelectTrigger>
                      <SelectContent>{sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                {!form.site_id && <p className="text-xs text-amber-700 -mt-3">Une ronde appartient obligatoirement à un site. Elle ne peut utiliser que les pointeaux de ce site.</p>}

                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><FileText className="w-4 h-4 text-muted-foreground" /></div>
                    <h3 className="font-semibold">Description</h3>
                  </div>
                  <div className="space-y-3">
                    <Input data-testid="ronde-name" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Nom de la ronde * (ex : Ouverture, Fermeture, Parking)" />
                    <Textarea rows={3} value={form.consignes || ''} onChange={(e) => update('consignes', e.target.value)} placeholder="Consignes agents" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><Settings className="w-4 h-4 text-muted-foreground" /></div>
                    <h3 className="font-semibold">Options d'exécution</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Switch checked={form.status !== 'inactif'} onCheckedChange={(value) => update('status', value ? 'actif' : 'inactif')} />
                      <Label className="text-sm">Ronde active (inactive : conservée avec son historique, non proposée aux agents)</Label>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Switch checked={!!form.allow_skip} onCheckedChange={(value) => update('allow_skip', value)} />
                        <Label className="text-sm">Autoriser le collaborateur à sauter des points de contrôle</Label>
                      </div>
                      <div className="min-w-[200px]">
                        <Select value={form.sens_ronde} onValueChange={(value) => update('sens_ronde', value)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{SENS_RONDE.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-2 border-dashed rounded-xl p-6 text-center text-sm text-muted-foreground bg-muted/10">
                  <Camera className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Vous pourrez associer une photo à cette ronde prochainement
                </div>
              </>
            )}

            {activeTab === 'points' && (
              <div className="space-y-3">
                {legacyWarning && (
                  <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Ancienne ronde : {unresolved.length} point(s) ne correspondent à aucun pointeau.</p>
                      <p className="mt-0.5">
                        Ils restent dans l'historique. Si vous modifiez les points de cette ronde, seuls les pointeaux listés ci-dessous seront conservés.
                        Créez d'abord les pointeaux manquants dans <Link to="/points-controle" className="underline font-medium">Pointeaux NFC</Link>.
                      </p>
                      <ul className="list-disc pl-4 mt-1">{unresolved.map((point, index) => <li key={`${point.id}-${index}`}>{point.name || 'Sans nom'}{normalizeNfcTag(point.nfc_tag_id) ? '' : ' (sans tag)'}</li>)}</ul>
                    </div>
                  </div>
                )}

                {!form.site_id ? (
                  <p className="text-sm text-muted-foreground text-center py-10">Sélectionnez d'abord le site de la ronde (onglet Général).</p>
                ) : (
                  <div className="flex flex-col lg:flex-row border rounded-lg overflow-hidden min-h-[300px]">
                    <div className="w-full lg:w-1/2 lg:border-r border-b lg:border-b-0 flex flex-col">
                      <div className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b">Parcours ({pointIds.length})</div>
                      <div className="flex-1 overflow-y-auto" data-testid="ronde-parcours">
                        {pointIds.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">Ajoutez des pointeaux depuis la liste</p>}
                        {pointIds.map((id, index) => {
                          const pointeau = pointeauxById.get(id);
                          return (
                            <div key={id} className="flex items-center gap-2 p-3 border-b">
                              <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">{index + 1}</div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{pointeau?.name || 'Pointeau introuvable'}</p>
                                <p className="text-[11px] font-mono text-muted-foreground truncate">{pointeau?.nfc_tag_id}</p>
                              </div>
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="Monter" disabled={index === 0} onClick={() => movePoint(index, -1)}><ArrowUp className="w-3.5 h-3.5" /></Button>
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="Descendre" disabled={index === pointIds.length - 1} onClick={() => movePoint(index, 1)}><ArrowDown className="w-3.5 h-3.5" /></Button>
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" aria-label="Retirer" onClick={() => removePoint(id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="w-full lg:w-1/2 flex flex-col">
                      <div className="p-3 flex items-center justify-between border-b gap-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pointeaux du site</p>
                        <Link to="/points-controle" className="text-xs text-primary inline-flex items-center gap-1 hover:underline"><Plus className="w-3 h-3" />Gérer</Link>
                      </div>
                      <div className="flex-1 overflow-y-auto" data-testid="ronde-pointeaux-site">
                        {sitePointeaux.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-8 px-3">
                            Aucun pointeau sur ce site.<br />Créez-les dans <Link to="/points-controle" className="underline">Pointeaux NFC</Link>.
                          </p>
                        )}
                        {sitePointeaux.map((pointeau) => {
                          const already = pointIds.includes(pointeau.id);
                          const usable = isPointeauUtilisable(pointeau);
                          return (
                            <button key={pointeau.id} type="button" disabled={already || !usable}
                              onClick={() => addPoint(pointeau.id)}
                              className={cn('w-full flex items-center gap-3 p-3 border-b text-left transition-colors', already || !usable ? 'opacity-60 cursor-default bg-muted/10' : 'hover:bg-muted/20')}>
                              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 text-sm font-bold text-muted-foreground border">{pointeau.name?.[0]?.toUpperCase()}</div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{pointeau.name}</p>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {usable ? pointeau.nfc_tag_id : (pointeau.status === 'actif' ? 'Tag manquant' : `${pointeau.status === 'brouillon' ? 'Brouillon' : 'Inactif'} : inutilisable`)}
                                </p>
                              </div>
                              {already && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2 sm:gap-3 px-3 sm:px-5 py-3 border-t bg-muted/10 shrink-0">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Annuler</Button>
          <Button data-testid="ronde-save" onClick={submit} disabled={!canSave} className="bg-gray-700 hover:bg-gray-800 text-white sm:px-8 w-full sm:w-auto">
            {saving ? 'ENREGISTREMENT…' : 'ENREGISTRER'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
