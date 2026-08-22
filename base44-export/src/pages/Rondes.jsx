import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, Pencil, Trash2, ChevronDown, ChevronRight, CheckCircle2, ScanLine, Camera, Settings, FileText, Info } from 'lucide-react';
import NfcCheckpointCapture from '@/components/rondes/NfcCheckpointCapture';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/useCompany';

const SENS_RONDE = ['Les deux sens', 'Sens horaire uniquement', 'Sens anti-horaire uniquement'];

export default function Rondes() {
  const { companyId } = useCompany();
  const [showForm, setShowForm] = useState(false);
  const [editRonde, setEditRonde] = useState(null);
  const [expanded, setExpanded] = useState({});
  const qc = useQueryClient();

  const { data: rondes = [] } = useQuery({ queryKey: ['rondes', companyId], queryFn: () => base44.entities.Ronde.filter({ company_id: companyId }), enabled: !!companyId });
  const { data: sites = [] } = useQuery({ queryKey: ['sites', companyId], queryFn: () => base44.entities.Site.filter({ company_id: companyId }), enabled: !!companyId });

  // All checkpoints from all rondes, available to pick when building a new ronde
  const allNfcCheckpoints = useMemo(() => {
    const list = [];
    rondes.forEach(r => (r.checkpoints || []).forEach(cp => {
      list.push({ ...cp, ronde_id: r.id, ronde_name: r.name, site_name: r.site_name, site_id: r.site_id });
    }));
    return list;
  }, [rondes]);

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.Ronde.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rondes'] }); setShowForm(false); toast.success('Ronde créée avec succès'); },
    onError: (error) => { toast.error('Échec de la création : ' + (error.message || 'Erreur inconnue')); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Ronde.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rondes'] }); setEditRonde(null); toast.success('Ronde modifiée avec succès'); },
    onError: (error) => { toast.error('Échec de la modification : ' + (error.message || 'Erreur inconnue')); },
  });
  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Ronde.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rondes'] }); toast.success('Ronde supprimée avec succès'); },
    onError: (error) => { toast.error('Échec de la suppression : ' + (error.message || 'Erreur inconnue')); },
  });

  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div>
      <PageHeader title="Rondes" subtitle="Gestion des tournées de sécurité" actionLabel="Nouvelle ronde" onAction={() => setShowForm(true)} />

      <div className="space-y-4">
        {rondes.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Aucune ronde définie. Créez votre première tournée.</p>
          </div>
        )}
        {rondes.map(ronde => (
          <Card key={ronde.id} className="overflow-hidden">
            <div
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => toggle(ronde.id)}
            >
              <div className="flex items-center gap-3">
                {expanded[ronde.id] ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                <div>
                  <p className="font-semibold">{ronde.name}</p>
                  <p className="text-sm text-muted-foreground">{ronde.site_name} {ronde.client_name && `• ${ronde.client_name}`}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{(ronde.checkpoints || []).length} points</Badge>
                <StatusBadge status={ronde.status} />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => { e.stopPropagation(); setEditRonde(ronde); }}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={e => { e.stopPropagation(); deleteMut.mutate(ronde.id); }}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {expanded[ronde.id] && (
              <div className="border-t border-border px-4 py-3 bg-muted/20">
                {ronde.description && <p className="text-sm text-muted-foreground mb-3">{ronde.description}</p>}
                <div className="space-y-2">
                  {(ronde.checkpoints || []).length === 0 && <p className="text-sm text-muted-foreground">Aucun point de contrôle défini</p>}
                  {(ronde.checkpoints || []).map((cp, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-background border border-border">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {cp.order || i + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{cp.name}</p>
                        {cp.description && <p className="text-xs text-muted-foreground">{cp.description}</p>}
                      </div>
                      {cp.nfc_tag_id && <ScanLine className="w-4 h-4 text-primary shrink-0" title={`NFC: ${cp.nfc_tag_id}`} />}
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
        onSubmit={(data) => editRonde ? updateMut.mutate({ id: editRonde.id, data }) : createMut.mutate(data)}
        ronde={editRonde}
        sites={sites}
        allNfcCheckpoints={allNfcCheckpoints}
      />
    </div>
  );
}

function RondeFormDialog({ open, onClose, onSubmit, ronde, sites, allNfcCheckpoints = [] }) {
  const [activeTab, setActiveTab] = useState('general');
  const [form, setForm] = useState(getEmptyForm());
  const [showAddCp, setShowAddCp] = useState(false);
  const [editCpIdx, setEditCpIdx] = useState(null);

  function getEmptyForm() {
    return { name: '', site_id: '', site_name: '', client_id: '', client_name: '', description: '', consignes: '', photo_url: '', allow_skip: false, sens_ronde: 'Les deux sens', checkpoints: [], status: 'actif' };
  }

  useEffect(() => {
    if (ronde) setForm({ ...getEmptyForm(), ...ronde });
    else setForm(getEmptyForm());
    setActiveTab('general');
  }, [ronde, open]);

  const update = (f, v) => setForm(prev => ({ ...prev, [f]: v }));

  const handleSiteChange = (siteId) => {
    const site = sites.find(s => s.id === siteId);
    setForm(prev => ({ ...prev, site_id: siteId, site_name: site?.name || '', client_id: site?.client_id || '', client_name: site?.client_name || '' }));
  };

  // Checkpoints du site sélectionné (depuis toutes les rondes existantes de ce site)
  const siteCheckpoints = useMemo(() => {
    if (!form.site_id) return allNfcCheckpoints;
    return allNfcCheckpoints.filter(cp => cp.site_id === form.site_id);
  }, [allNfcCheckpoints, form.site_id]);

  const addNfcCheckpoint = (nfcCp) => {
    const already = (form.checkpoints || []).some(c => c.id === nfcCp.id || (c.nfc_tag_id && c.nfc_tag_id === nfcCp.nfc_tag_id));
    if (already) return;
    const cp = {
      id: nfcCp.id || Date.now().toString(),
      name: nfcCp.name,
      description: nfcCp.description || '',
      nfc_tag_id: nfcCp.nfc_tag_id || '',
      photo_url: nfcCp.photo_url || '',
      latitude: nfcCp.latitude,
      longitude: nfcCp.longitude,
      order: (form.checkpoints || []).length + 1,
    };
    update('checkpoints', [...(form.checkpoints || []), cp]);
  };

  const removeCheckpoint = (i) => {
    update('checkpoints', (form.checkpoints || []).filter((_, idx) => idx !== i));
  };

  const saveCheckpoint = (cp) => {
    const cps = [...(form.checkpoints || [])];
    if (editCpIdx !== null) {
      cps[editCpIdx] = cp;
    } else {
      cps.push({ ...cp, order: cps.length + 1 });
    }
    update('checkpoints', cps);
    setShowAddCp(false);
    setEditCpIdx(null);
  };

  const TABS = [
    { key: 'general', label: 'Général' },
    { key: 'points', label: 'Points de contrôle' },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-hidden p-0 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <div className="w-5 h-5 rounded bg-muted flex items-center justify-center">
              <FileText className="w-3 h-3" />
            </div>
            {ronde ? 'Modifier la ronde' : "Ajout d'une ronde"}
            <Info className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-44 shrink-0 border-r bg-muted/10 py-3">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'w-full text-left px-4 py-2.5 text-sm transition-colors',
                  activeTab === tab.key
                    ? 'border-l-2 border-primary bg-primary/5 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted/30'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {activeTab === 'general' && (
              <>
                {/* Site / Client */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs mb-1.5 block">Client</Label>
                    <Input value={form.client_name} readOnly placeholder="— auto via site —" className="bg-muted/30" />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">Site *</Label>
                    <Select value={form.site_id} onValueChange={handleSiteChange}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner un site" /></SelectTrigger>
                      <SelectContent>{sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold">Description</h3>
                  </div>
                  <div className="space-y-3">
                    <Input value={form.name} onChange={e => update('name', e.target.value)} placeholder="Titre *" />
                    <Textarea rows={3} value={form.consignes} onChange={e => update('consignes', e.target.value)} placeholder="Consignes agents" />
                    <div className="flex items-center gap-2 border rounded-md px-3 py-2 text-sm text-muted-foreground bg-muted/20 cursor-pointer hover:bg-muted/40">
                      <span className="flex-1">Pièces jointes</span>
                      <span className="text-lg">📎</span>
                    </div>
                  </div>
                </div>

                {/* Options d'exécution */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <Settings className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold">Options d'exécution</h3>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Switch checked={form.allow_skip} onCheckedChange={v => update('allow_skip', v)} />
                      <Label className="text-sm">Autoriser le collaborateur à sauter des points de contrôle</Label>
                    </div>
                    <div className="min-w-[200px]">
                      <Select value={form.sens_ronde} onValueChange={v => update('sens_ronde', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SENS_RONDE.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Prendre une photo */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <Camera className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold">Prendre une photo</h3>
                  </div>
                  <div className="border-2 border-dashed rounded-xl p-6 text-center text-sm text-muted-foreground bg-muted/10 cursor-pointer hover:bg-muted/20">
                    <Camera className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Vous pouvez associer une photo à cette ronde
                  </div>
                </div>
              </>
            )}

            {activeTab === 'points' && (
              <div className="flex gap-0 -mx-5 -mb-5" style={{ minHeight: 400 }}>
                {/* LEFT: selected checkpoints in this ronde */}
                <div className="w-1/2 border-r flex flex-col">
                  {/* 3 tabs: RONDE / LISTE / CARTE */}
                  <div className="flex border-b">
                    {['RONDE', 'LISTE', 'CARTE'].map(t => (
                      <button key={t} className="flex-1 py-2.5 text-xs font-semibold text-center border-b-2 border-primary text-primary first-of-type:border-b-2 transition-colors"
                        style={{ borderBottomColor: t === 'LISTE' ? 'hsl(var(--primary))' : 'transparent', color: t === 'LISTE' ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <div className="p-3 text-xs text-muted-foreground border-b">
                    {(form.checkpoints || []).length} élément(s)
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {(form.checkpoints || []).length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">La liste est vide</p>
                    ) : (
                      (form.checkpoints || []).map((cp, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 border-b hover:bg-muted/20 group">
                          {cp.photo_url ? (
                            <img src={cp.photo_url} alt={cp.name} className="w-10 h-10 rounded-full object-cover shrink-0 border" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 text-sm font-bold text-muted-foreground border">
                              {cp.name?.[0]?.toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{cp.name}</p>
                            {cp.description && <p className="text-xs text-muted-foreground truncate">{cp.description}</p>}
                          </div>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100" onClick={() => removeCheckpoint(i)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* RIGHT: available checkpoints from site */}
                <div className="w-1/2 flex flex-col">
                  <div className="p-3 border-b">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Points disponibles{form.site_id ? '' : ' (sélectionnez un site)'}</p>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {/* Add custom point button */}
                    <button
                      type="button"
                      onClick={() => { setEditCpIdx(null); setShowAddCp(true); }}
                      className="w-full flex items-center gap-3 p-3 border-b hover:bg-muted/20 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0">
                        <Plus className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-sm text-muted-foreground">Ajouter un point personnalisé</span>
                    </button>

                    {siteCheckpoints.length === 0 && form.site_id && (
                      <p className="text-xs text-muted-foreground text-center py-8">Aucun point de contrôle créé pour ce site.<br/>Créez-en dans l'onglet "Points de contrôle".</p>
                    )}

                    {siteCheckpoints.map((cp, i) => {
                      const already = (form.checkpoints || []).some(c => c.id === cp.id || (c.nfc_tag_id && cp.nfc_tag_id && c.nfc_tag_id === cp.nfc_tag_id));
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => !already && addNfcCheckpoint(cp)}
                          disabled={already}
                          className={`w-full flex items-center gap-3 p-3 border-b text-left transition-colors ${already ? 'opacity-50 cursor-default bg-muted/10' : 'hover:bg-muted/20 cursor-pointer'}`}
                        >
                          {cp.photo_url ? (
                            <img src={cp.photo_url} alt={cp.name} className="w-10 h-10 rounded-full object-cover shrink-0 border" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 text-sm font-bold text-muted-foreground border">
                              {cp.name?.[0]?.toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{cp.name}</p>
                            {cp.description && <p className="text-xs text-muted-foreground truncate">{cp.description}</p>}
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
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t bg-muted/10">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            onClick={() => form.name && onSubmit(form)}
            disabled={!form.name}
            className="bg-gray-700 hover:bg-gray-800 text-white px-8"
          >
            ENREGISTRER
          </Button>
        </div>
      </DialogContent>

      {showAddCp && (
        <CheckpointFormDialog
          checkpoint={editCpIdx !== null ? (form.checkpoints || [])[editCpIdx] : null}
          onClose={() => { setShowAddCp(false); setEditCpIdx(null); }}
          onSave={saveCheckpoint}
        />
      )}
    </Dialog>
  );
}

function CheckpointFormDialog({ checkpoint, onClose, onSave }) {
  const [form, setForm] = useState(checkpoint || {
    name: '', description: '', nfc_tag_id: '', latitude: '', longitude: '',
    batiment: '', etage: '', numero_clef: '',
    debut_mission: false, fin_mission: false,
  });

  useEffect(() => {
    setForm(checkpoint || {
      name: '', description: '', nfc_tag_id: '', latitude: '', longitude: '',
      batiment: '', etage: '', numero_clef: '',
      debut_mission: false, fin_mission: false,
    });
  }, [checkpoint]);

  const update = (f, v) => setForm(prev => ({ ...prev, [f]: v }));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden p-0 flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-3 border-b">
          <Pencil className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">{checkpoint ? 'Modifier le point de contrôle' : "Ajout d'un point de contrôle"}</span>
          <Info className="w-4 h-4 text-muted-foreground ml-1" />
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left panel */}
          <div className="w-1/2 border-r overflow-y-auto p-5 space-y-4">
            {/* NFC + Géolocalisation */}
            <NfcCheckpointCapture
              initialNfc={form.nfc_tag_id}
              initialLat={form.latitude?.toString()}
              initialLng={form.longitude?.toString()}
              onCapture={({ nfc_tag_id, latitude, longitude }) => {
                setForm(prev => ({
                  ...prev,
                  nfc_tag_id: nfc_tag_id || prev.nfc_tag_id,
                  latitude: latitude || prev.latitude,
                  longitude: longitude || prev.longitude,
                }));
              }}
            />

            {/* Description section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-semibold">Description</h3>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="border rounded-md px-3 py-2 bg-muted/20">
                    <Input value={form.name} onChange={e => update('name', e.target.value)} placeholder="Titre" className="border-0 p-0 h-auto text-sm shadow-none focus-visible:ring-0 bg-transparent" />
                  </div>
                  <div className="border rounded-md px-3 py-2 bg-muted/20">
                    <Input value={form.description} onChange={e => update('description', e.target.value)} placeholder="Description et consignes" className="border-0 p-0 h-auto text-sm shadow-none focus-visible:ring-0 bg-transparent" />
                  </div>
                </div>
                <div className="flex items-center gap-2 border rounded-md px-3 py-2.5 text-sm text-muted-foreground bg-muted/20">
                  <span className="flex-1">Pièces jointes</span>
                  <span className="text-base opacity-50">📎</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-muted/20">
                    <span className="text-muted-foreground">⊞</span>
                    <Input value={form.batiment} onChange={e => update('batiment', e.target.value)} placeholder="Batiment" className="border-0 p-0 h-auto text-sm shadow-none focus-visible:ring-0 bg-transparent" />
                  </div>
                  <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-muted/20">
                    <span className="text-muted-foreground text-xs">≡</span>
                    <Input value={form.etage} onChange={e => update('etage', e.target.value)} placeholder="Étage" className="border-0 p-0 h-auto text-sm shadow-none focus-visible:ring-0 bg-transparent" />
                  </div>
                  <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-muted/20">
                    <span className="text-muted-foreground">⚙</span>
                    <Input value={form.numero_clef} onChange={e => update('numero_clef', e.target.value)} placeholder="Numéro de clef" className="border-0 p-0 h-auto text-sm shadow-none focus-visible:ring-0 bg-transparent" />
                  </div>
                </div>
              </div>
            </div>

            {/* Attributs */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full border-2 border-white" />
                </div>
                <h3 className="font-semibold">Attributs</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={form.debut_mission} onCheckedChange={v => update('debut_mission', v)} />
                  <Label className="text-sm">Point de contrôle de début de mission</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.fin_mission} onCheckedChange={v => update('fin_mission', v)} />
                  <Label className="text-sm">Point de contrôle de fin de mission</Label>
                </div>
              </div>
            </div>
          </div>

          {/* Right panel — map */}
          <div className="w-1/2 bg-muted/10 flex flex-col items-center justify-center gap-3 p-4">
            {form.latitude && form.longitude ? (
              <>
                <div className="w-full h-48 rounded-xl overflow-hidden border bg-white flex items-center justify-center">
                  <img
                    src={`https://maps.googleapis.com/maps/api/staticmap?center=${form.latitude},${form.longitude}&zoom=16&size=400x200&markers=color:red%7C${form.latitude},${form.longitude}&key=AIzaSyD-placeholder`}
                    alt="carte"
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.style.display='none'; }}
                  />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-xs font-mono text-muted-foreground">{form.latitude}, {form.longitude}</p>
                  <a
                    href={`https://maps.google.com/?q=${form.latitude},${form.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary underline flex items-center gap-1 justify-center"
                  >
                    <MapPin className="w-3 h-3" /> Voir sur Google Maps
                  </a>
                </div>
              </>
            ) : (
              <div className="text-center text-muted-foreground space-y-2">
                <MapPin className="w-12 h-12 mx-auto opacity-20" />
                <p className="text-sm">Position GPS non capturée</p>
                <p className="text-xs opacity-60">La géolocalisation se lance<br/>automatiquement à l'ouverture</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-5 py-3 border-t bg-muted/10">
          <Button
            onClick={() => form.name && onSave(form)}
            disabled={!form.name}
            className="bg-gray-700 hover:bg-gray-800 text-white px-8 uppercase tracking-wide"
          >
            Enregistrer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}