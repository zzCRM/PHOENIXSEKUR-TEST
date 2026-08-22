import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Info, Calendar, Users, Route, FileText, Coffee, Plus, Copy, ShieldCheck, MapPin, Tag, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCompany } from '@/lib/useCompany';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { checkAgentCompliance } from '@/lib/laborLaw';
import ComplianceAlerts from '@/components/planning/ComplianceAlerts';

const TABS = [
  { key: 'general', label: 'Général', icon: Info },
  { key: 'collaborateurs', label: 'Collaborateurs', icon: Users },
  { key: 'rondes', label: 'Rondes', icon: Route },
  { key: 'instructions', label: 'Instructions', icon: FileText },
  { key: 'pauses', label: 'Pauses', icon: Coffee },
];

const SERVICE_TYPES = [
  'Gardiennage & Surveillance',
  'Intervention',
  'Ronde',
  'Événementiel',
  'SSIAP',
  'Autre',
];

const SPECIALITES = [
  'Agent de sécurité',
  'SSIAP 1',
  'SSIAP 2',
  'SSIAP 3',
  'ADS',
  'Superviseur',
];

const RECURRENCE_TYPES = ['Quotidienne', 'Hebdomadaire', 'Mensuelle', 'Jours fériés'];
const JOURS_SEMAINE = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const emptyForm = {
  type: 'gardiennage',
  type_label: 'Gardiennage & Surveillance',
  site_id: '',
  site_name: '',
  specialite: '',
  recurrence: false,
  recurrence_type: '',
  recurrence_frequence: 1,
  recurrence_jours: [],
  recurrence_jours_mois: [],
  recurrence_exclure_feries: false,
  recurrence_voir_feries: '',
  date: '',
  date_fin_recurrence: '',
  heure_debut: '',
  heure_fin: '',
  agent_id: '',
  agent_name: '',
  agents_required: 1,
  instructions: '',
  planifier_visible: false,
};

export default function AjoutServiceModal({ open, onClose, defaultDate, editMission }) {
  const { companyId } = useCompany();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('general');
  const [form, setForm] = useState({ ...emptyForm });

  useEffect(() => {
    if (defaultDate) setForm(f => ({ ...f, date: defaultDate }));
  }, [defaultDate]);

  useEffect(() => {
    if (!open) { setForm({ ...emptyForm }); setActiveTab('general'); return; }
    if (editMission) {
      setForm({
        ...emptyForm,
        type: editMission.type || 'gardiennage',
        type_label: editMission.title ? editMission.title.split(' - ')[0] : SERVICE_TYPES[0],
        site_id: editMission.site_id || '',
        site_name: editMission.site_name || '',
        date: editMission.date ? editMission.date.split('T')[0] : '',
        heure_debut: editMission.start_time || '',
        heure_fin: editMission.end_time || '',
        agent_id: editMission.agent_id || '',
        agent_name: editMission.agent_name || '',
        agents_required: editMission.agents_required || 1,
        instructions: editMission.notes || '',
      });
    }
  }, [open, editMission]);

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

  const { data: agents = [] } = useQuery({
    queryKey: ['agents', companyId],
    queryFn: () => base44.entities.Agent.filter({ company_id: companyId }),
    enabled: !!companyId,
  });
  const { data: allMissions = [] } = useQuery({
    queryKey: ['missions', companyId],
    queryFn: () => base44.entities.Mission.filter({ company_id: companyId }, '-date', 500),
    enabled: !!companyId,
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.Mission.create({ ...data, company_id: companyId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['missions'] });
      qc.invalidateQueries({ queryKey: ['missions', companyId] });
      toast.success('Service planifié avec succès');
      onClose();
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Mission.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['missions'] });
      qc.invalidateQueries({ queryKey: ['missions', companyId] });
      toast.success('Service modifié avec succès');
      onClose();
    },
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const complianceViolations = (() => {
    if (!form.agent_id || !form.date || !form.heure_debut || !form.heure_fin) return [];
    const agentMissions = allMissions.filter(m => m.agent_id === form.agent_id && m.status !== 'annulee');
    return checkAgentCompliance(agentMissions, {
      date: form.date, start_time: form.heure_debut, end_time: form.heure_fin,
    });
  })();

  const handleSave = () => {
    if (!form.date) { toast.error('La date du service est requise'); return; }
    const dur = form.heure_debut && form.heure_fin
      ? (() => {
          const [h1, m1] = form.heure_debut.split(':').map(Number);
          const [h2, m2] = form.heure_fin.split(':').map(Number);
          let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
          if (diff < 0) diff += 24 * 60;
          return `(${Math.floor(diff / 60)}h${diff % 60 > 0 ? String(diff % 60).padStart(2, '0') : '00'})`;
        })()
      : '';
    const selectedSiteObj = sites.find(s => s.id === form.site_id);
    const clientId = selectedSiteObj?.client_id || undefined;
    const clientName = selectedSiteObj?.client_name || (clientId ? (clients.find(c => c.id === clientId)?.company_name) : undefined) || undefined;
    const payload = {
      company_id: companyId,
      title: `${form.type_label} - ${form.site_name || 'Sans site'}`,
      type: form.type,
      site_id: form.site_id || undefined,
      site_name: form.site_name || undefined,
      client_id: clientId,
      client_name: clientName,
      agent_id: form.agent_id || undefined,
      agent_name: form.agent_name || undefined,
      agents_required: Number(form.agents_required) || 1,
      date: form.date,
      start_time: form.heure_debut,
      end_time: form.heure_fin,
      notes: form.instructions,
      status: 'planifiee',
    };
    if (editMission) {
      updateMut.mutate({ id: editMission.id, data: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  if (!open) return null;

  let durLabel = '';
  if (form.heure_debut && form.heure_fin) {
    const [h1, m1] = form.heure_debut.split(':').map(Number);
    const [h2, m2] = form.heure_fin.split(':').map(Number);
    let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diff < 0) diff += 24 * 60;
    durLabel = `${Math.floor(diff / 60)}h${diff % 60 > 0 ? String(diff % 60).padStart(2, '0') : '00'}`;
  }

  const selectedSite = sites.find(s => s.id === form.site_id);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-start justify-center bg-black/40 backdrop-blur-sm sm:pt-6 sm:pb-6 px-0 sm:px-4 overflow-y-auto">
      <div className="bg-white sm:rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col h-[100dvh] sm:h-auto sm:max-h-[92vh] overflow-hidden ring-1 ring-black/5">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-md shadow-emerald-600/20">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-bold text-slate-800">{editMission ? "Modification d'un service" : "Ajout d'un service"}</h2>
                <Info className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-xs text-slate-400">Création d'une vacation de sécurité</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-header info chips */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-slate-100 border-b border-slate-100">
          <div className="bg-white px-5 py-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Site</p>
              <p className="text-sm font-semibold text-slate-700 truncate">{selectedSite ? selectedSite.name : 'Sans site'}</p>
            </div>
          </div>
          <div className="bg-white px-5 py-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
              <Tag className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Spécialité</p>
              <p className="text-sm font-semibold text-slate-700 truncate">{form.specialite || 'Sans spécialité'}</p>
            </div>
          </div>
          <div className="bg-white px-5 py-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Horaires</p>
              <p className="text-sm font-semibold text-slate-700 truncate">
                {form.heure_debut && form.heure_fin ? `${form.heure_debut} - ${form.heure_fin} (${durLabel})` : '—'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
          {/* Tabs mobiles */}
          <div className="md:hidden flex overflow-x-auto border-b bg-emerald-50/50 shrink-0">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2',
                    active ? 'border-emerald-600 text-emerald-700 bg-white' : 'border-transparent text-slate-500'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Sidebar tabs desktop */}
          <div className="hidden md:flex w-48 shrink-0 bg-emerald-50/40 border-r border-slate-100 py-4 flex-col gap-1">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              const count = tab.key === 'collaborateurs'
                ? (form.agent_id ? '1' : '0')
                : tab.key === 'rondes' || tab.key === 'pauses' ? '0' : null;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'mx-2 flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all',
                    active
                      ? 'bg-white text-emerald-700 font-semibold shadow-sm ring-1 ring-emerald-100'
                      : 'text-slate-500 hover:bg-white/60 hover:text-slate-700'
                  )}
                >
                  <Icon className={cn('w-4 h-4', active ? 'text-emerald-600' : 'text-slate-400')} />
                  <span className="flex-1 text-left">{tab.label}</span>
                  {count !== null && (
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                      active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200/70 text-slate-500'
                    )}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-6 space-y-6 bg-white min-w-0">
            {activeTab === 'general' && (
              <>
                <div className="flex justify-end gap-2">
                  <button className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/30 hover:bg-emerald-700 transition-colors">
                    <Plus className="w-5 h-5" />
                  </button>
                  <button className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/30 hover:bg-emerald-700 transition-colors">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>

                {/* Section: Infos générales */}
                <div>
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                      <Info className="w-4 h-4 text-emerald-600" />
                    </div>
                    <h3 className="font-semibold text-slate-800">Informations générales du service</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs mb-1.5 block text-slate-500 font-medium">Type *</Label>
                      <Select value={form.type_label} onValueChange={v => set('type_label', v)}>
                        <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SERVICE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs mb-1.5 block text-slate-500 font-medium">Site *</Label>
                      <Select value={form.site_id} onValueChange={v => {
                        const s = sites.find(x => x.id === v);
                        set('site_id', v);
                        set('site_name', s?.name || '');
                      }}>
                        <SelectTrigger className="rounded-lg">
                          <SelectValue placeholder="Sélectionner un site" />
                        </SelectTrigger>
                        <SelectContent>
                          {sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs mb-1.5 block text-slate-500 font-medium">Spécialité *</Label>
                      <Select value={form.specialite} onValueChange={v => set('specialite', v)}>
                        <SelectTrigger className="rounded-lg"><SelectValue placeholder="Sélectionner une spécialité" /></SelectTrigger>
                        <SelectContent>
                          {SPECIALITES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Section: Planification */}
                <div>
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-emerald-600" />
                    </div>
                    <h3 className="font-semibold text-slate-800">Planification</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                      <Switch checked={form.recurrence} onCheckedChange={v => set('recurrence', v)} />
                      <Label className="text-sm text-slate-600">Récurrence</Label>
                    </div>

                    {form.recurrence ? (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs mb-1.5 block text-slate-500 font-medium flex items-center gap-1.5">
                              <Calendar className="w-3 h-3" /> Date de début *
                            </Label>
                            <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="rounded-lg" />
                          </div>
                          <div>
                            <Label className="text-xs mb-1.5 block text-slate-500 font-medium flex items-center gap-1.5">
                              <Calendar className="w-3 h-3" /> Date de fin de récurrence *
                            </Label>
                            <Input type="date" value={form.date_fin_recurrence} onChange={e => set('date_fin_recurrence', e.target.value)} className="rounded-lg" />
                          </div>
                        </div>
                        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
                          <div>
                            <Label className="text-xs mb-1.5 block text-slate-500 font-medium">Heure de début *</Label>
                            <Input type="time" value={form.heure_debut} onChange={e => set('heure_debut', e.target.value)} className="rounded-lg" />
                          </div>
                          <span className="text-slate-400 pb-2.5 text-lg leading-none">→</span>
                          <div>
                            <Label className="text-xs mb-1.5 block text-slate-500 font-medium">Heure de fin *</Label>
                            <Input type="time" value={form.heure_fin} onChange={e => set('heure_fin', e.target.value)} className="rounded-lg" />
                          </div>
                        </div>

                        <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50">
                          <div className="flex items-center gap-2 mb-1">
                            <Calendar className="w-4 h-4 text-emerald-600" />
                            <span className="font-semibold text-sm text-slate-700">Récurrence</span>
                          </div>

                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="min-w-[160px]">
                              <Label className="text-xs mb-1 block text-slate-500">Récurrence</Label>
                              <Select value={form.recurrence_type} onValueChange={v => set('recurrence_type', v)}>
                                <SelectTrigger className="rounded-lg"><SelectValue placeholder="Récurrence" /></SelectTrigger>
                                <SelectContent>
                                  {RECURRENCE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>

                            {(form.recurrence_type === 'Quotidienne' || form.recurrence_type === 'Hebdomadaire' || form.recurrence_type === 'Mensuelle') && (
                              <div className="flex items-center gap-2">
                                <div>
                                  <Label className="text-xs mb-1 block text-slate-500">Fréquence</Label>
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-slate-400 whitespace-nowrap">
                                      {form.recurrence_type === 'Quotidienne' ? 'Tous les' : form.recurrence_type === 'Hebdomadaire' ? 'Toutes les' : 'Tous les'}
                                    </span>
                                    <Input
                                      type="number" min={1} max={99}
                                      value={form.recurrence_frequence}
                                      onChange={e => set('recurrence_frequence', parseInt(e.target.value) || 1)}
                                      className="w-16 h-8 text-center rounded-lg"
                                    />
                                    <span className="text-xs text-slate-400 whitespace-nowrap">
                                      {form.recurrence_type === 'Quotidienne' ? 'jour(s)' : form.recurrence_type === 'Hebdomadaire' ? 'semaine(s)' : 'mois'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {form.recurrence_type === 'Jours fériés' && (
                              <div className="min-w-[180px]">
                                <Label className="text-xs mb-1 block text-slate-500">Voir les jours fériés</Label>
                                <Select value={form.recurrence_voir_feries} onValueChange={v => set('recurrence_voir_feries', v)}>
                                  <SelectTrigger className="rounded-lg"><SelectValue placeholder="Voir les jours fériés" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="france">France métropolitaine</SelectItem>
                                    <SelectItem value="alsace">Alsace-Moselle</SelectItem>
                                    <SelectItem value="martinique">Martinique</SelectItem>
                                    <SelectItem value="guadeloupe">Guadeloupe</SelectItem>
                                    <SelectItem value="reunion">La Réunion</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            {(form.recurrence_type === 'Quotidienne' || form.recurrence_type === 'Hebdomadaire' || form.recurrence_type === 'Mensuelle') && (
                              <div className="flex items-center gap-2 ml-auto">
                                <Switch checked={form.recurrence_exclure_feries} onCheckedChange={v => set('recurrence_exclure_feries', v)} />
                                <Label className="text-sm whitespace-nowrap text-slate-600">Exclure les jours fériés</Label>
                              </div>
                            )}
                          </div>

                          {form.recurrence_type === 'Hebdomadaire' && (
                            <div className="flex flex-wrap gap-3 pt-1">
                              {JOURS_SEMAINE.map(j => {
                                const selected = (form.recurrence_jours || []).includes(j);
                                return (
                                  <label key={j} className="flex items-center gap-1.5 cursor-pointer text-sm select-none text-slate-600">
                                    <input
                                      type="checkbox"
                                      checked={selected}
                                      onChange={() => {
                                        const cur = form.recurrence_jours || [];
                                        set('recurrence_jours', selected ? cur.filter(x => x !== j) : [...cur, j]);
                                      }}
                                      className="rounded w-4 h-4 accent-emerald-600"
                                    />
                                    {j}
                                  </label>
                                );
                              })}
                            </div>
                          )}

                          {form.recurrence_type === 'Mensuelle' && (
                            <div className="pt-1">
                              <div className="grid grid-cols-7 gap-1.5">
                                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => {
                                  const sel = (form.recurrence_jours_mois || []).includes(d);
                                  return (
                                    <button
                                      key={d}
                                      type="button"
                                      onClick={() => {
                                        const cur = form.recurrence_jours_mois || [];
                                        set('recurrence_jours_mois', sel ? cur.filter(x => x !== d) : [...cur, d]);
                                      }}
                                      className={cn(
                                        'h-8 w-full rounded-lg text-sm font-medium border transition-colors',
                                        sel ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                      )}
                                    >
                                      {d}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <Label className="text-xs mb-1.5 block text-slate-500 font-medium">Date du service *</Label>
                          <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="rounded-lg" />
                        </div>
                        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
                          <div>
                            <Label className="text-xs mb-1.5 block text-slate-500 font-medium">Heure début</Label>
                            <Input type="time" value={form.heure_debut} onChange={e => set('heure_debut', e.target.value)} className="rounded-lg" />
                          </div>
                          <span className="text-slate-400 pb-2.5 text-lg leading-none">→</span>
                          <div>
                            <Label className="text-xs mb-1.5 block text-slate-500 font-medium">Heure fin</Label>
                            <Input type="time" value={form.heure_fin} onChange={e => set('heure_fin', e.target.value)} className="rounded-lg" />
                          </div>
                        </div>
                      </>
                    )}
                    {durLabel && (
                      <div className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1.5 font-medium">
                        <Clock className="w-3.5 h-3.5" /> Durée : {durLabel}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'collaborateurs' && (
              <div className="space-y-5">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Users className="w-4 h-4 text-emerald-600" />
                  </div>
                  <h3 className="font-semibold text-slate-800">Collaborateurs</h3>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block text-slate-500 font-medium">Nombre de collaborateurs nécessaires *</Label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={form.agents_required}
                    onChange={e => set('agents_required', parseInt(e.target.value) || 1)}
                    className="w-32 rounded-lg"
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block text-slate-500 font-medium">Assigner un collaborateur</Label>
                  <Select value={form.agent_id} onValueChange={v => {
                    const a = agents.find(x => x.id === v);
                    set('agent_id', v);
                    set('agent_name', a ? `${a.first_name} ${a.last_name}` : '');
                  }}>
                    <SelectTrigger className="rounded-lg"><SelectValue placeholder="Sélectionner un collaborateur" /></SelectTrigger>
                    <SelectContent>
                      {agents.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.first_name} {a.last_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {form.agent_name && (
                  <div className="flex items-center gap-3 p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-sm font-bold text-white shadow-sm">
                      {form.agent_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </div>
                    <span className="font-medium text-sm text-slate-700">{form.agent_name}</span>
                  </div>
                )}
                {form.agent_id && form.date && form.heure_debut && form.heure_fin && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Conformité réglementaire</span>
                    </div>
                    <ComplianceAlerts violations={complianceViolations} />
                    {complianceViolations.length === 0 && (
                      <div className="text-xs text-emerald-700 flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 font-medium">
                        <ShieldCheck className="w-3.5 h-3.5" /> Planification conforme au Code du travail et à la CCN EPS
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'instructions' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-emerald-600" />
                  </div>
                  <h3 className="font-semibold text-slate-800">Instructions</h3>
                </div>
                <Textarea
                  placeholder="Instructions spécifiques pour ce service..."
                  value={form.instructions}
                  onChange={e => set('instructions', e.target.value)}
                  className="min-h-[140px] rounded-lg"
                />
              </div>
            )}

            {(activeTab === 'rondes' || activeTab === 'pauses') && (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
                  {activeTab === 'rondes' ? <Route className="w-8 h-8 text-slate-300" /> : <Coffee className="w-8 h-8 text-slate-300" />}
                </div>
                <p className="text-sm font-medium text-slate-500">Aucun(e) {activeTab === 'rondes' ? 'ronde' : 'pause'} configuré(e)</p>
                <p className="text-xs text-slate-400 mt-1">Ajoutez des éléments depuis cet onglet</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-3 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
          <label htmlFor="planifier-visible" className="flex items-center gap-2 cursor-pointer min-w-0">
            <input
              type="checkbox"
              id="planifier-visible"
              checked={form.planifier_visible}
              onChange={e => set('planifier_visible', e.target.checked)}
              className="rounded w-4 h-4 accent-emerald-600 shrink-0"
            />
            <span className="text-xs text-slate-600 font-medium leading-snug">Planifier — afficher aux collaborateurs</span>
          </label>
          <Button
            onClick={handleSave}
            disabled={createMut.isPending}
            className="bg-slate-800 hover:bg-slate-900 text-white sm:px-8 py-2.5 rounded-lg font-semibold shadow-md transition-colors w-full sm:w-auto"
          >
            {createMut.isPending ? 'Enregistrement...' : 'ENREGISTRER'}
          </Button>
        </div>
      </div>
    </div>
  );
}