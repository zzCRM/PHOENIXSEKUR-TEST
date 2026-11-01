import React, { useMemo, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, Calendar, Users, Route, FileText, Coffee, ShieldCheck, MapPin, Tag, Clock,
  Building2, Phone, Paperclip, Receipt, Package, Home,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCompany } from '@/lib/useCompany';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { checkAgentCompliance } from '@/lib/laborLaw';
import ComplianceAlerts from '@/components/planning/ComplianceAlerts';
import { expandRecurrenceDates } from '@/lib/recurrenceExpand';
import { buildJoursFeriesMap } from '@/lib/joursFeries';
import { qualifyService, serviceDurationHours } from '@/lib/serviceQualification';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const TABS = [
  { key: 'general', label: 'Général', icon: Home },
  { key: 'client', label: 'Client & contrat', icon: Building2 },
  { key: 'planification', label: 'Planification', icon: Calendar },
  { key: 'collaborateurs', label: 'Collaborateurs', icon: Users },
  { key: 'qualifications', label: 'Qualifications', icon: ShieldCheck },
  { key: 'rondes', label: 'Rondes', icon: Route },
  { key: 'instructions', label: 'Instructions', icon: FileText },
  { key: 'pauses', label: 'Pauses', icon: Coffee },
  { key: 'materiel', label: 'Matériel', icon: Package },
  { key: 'contacts', label: 'Contacts', icon: Phone },
  { key: 'facturation', label: 'Facturation', icon: Receipt },
  { key: 'documents', label: 'Documents', icon: Paperclip },
];

const SERVICE_TYPES = [
  ['gardiennage', 'Gardiennage & surveillance'],
  ['ssiap', 'SSIAP (Service de Sécurité incendie)'],
  ['evenementiel', 'Sécurité événementielle'],
  ['intervention', 'Contrôle d\'accès'],
  ['ronde', 'Rondier'],
  ['surveillance', 'Surveillance'],
];

const SPECIALITES = [
  'Surveillance générale',
  'Agent de sécurité',
  'Accueil / Contrôle',
  'SSIAP 1',
  'SSIAP 2',
  'SSIAP 3',
  'ADS',
  'Superviseur',
];

const QUALIFICATIONS = ['SSIAP 1', 'SSIAP 2', 'SSIAP 3', 'APS', 'SST'];
const MATERIEL = [
  ['pti', 'PTI'],
  ['radio', 'Radio'],
  ['cles', 'Clés'],
  ['vehicule', 'Véhicule'],
  ['uniforme', 'Uniforme'],
];
const RECURRENCE_TYPES = ['Quotidienne', 'Hebdomadaire', 'Mensuelle', 'Jours fériés'];
const JOURS_SEMAINE = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const emptyForm = {
  type: 'gardiennage',
  type_label: 'Gardiennage & surveillance',
  client_id: '',
  client_name: '',
  contrat_id: '',
  site_id: '',
  site_name: '',
  batiment: '',
  poste_ref: '',
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
  agent_ids: [],
  agent_id: '',
  agent_name: '',
  agent_email: '',
  remplacant_id: '',
  agents_required: 1,
  qualifications: [],
  habilitation_autre: '',
  ronde_id: '',
  ronde_frequence: 1,
  instructions: '',
  pause_minutes: '',
  pause_debut: '',
  pause_remuneree: false,
  materiel: { pti: false, radio: false, cles: false, vehicule: false, uniforme: false },
  document_ids: [],
  planifier_visible: true,
};

function pickContract(contrats, clientId) {
  const list = contrats.filter((item) => item.type_contrat === 'client' && item.target_id === clientId);
  return list.find((item) => item.status === 'signe')
    || list.find((item) => item.status !== 'refuse' && item.status !== 'expire')
    || list[0]
    || null;
}

function norm(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, '');
}

function agentHasQualification(agent, label) {
  const blob = norm(`${agent?.fonction || ''} ${agent?.notes || ''}`);
  return blob.includes(norm(label));
}

function money(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function capitalize(value) {
  const text = String(value || '');
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

export default function AjoutServiceModal({ open, onClose, defaultDate, editMission }) {
  const { companyId, isAdmin } = useCompany();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('general');
  const [form, setForm] = useState({ ...emptyForm, materiel: { ...emptyForm.materiel } });
  const patch = (partial) => setForm((current) => ({ ...current, ...partial }));
  const openedFor = React.useRef(null);

  useEffect(() => {
    if (!open) {
      openedFor.current = null;
      setForm({ ...emptyForm, materiel: { ...emptyForm.materiel } });
      setActiveTab('general');
      return;
    }
    const key = editMission?.id || 'create';
    if (openedFor.current === key) return;
    openedFor.current = key;
    if (editMission) {
      const ids = Array.isArray(editMission.agent_ids) && editMission.agent_ids.length
        ? editMission.agent_ids
        : (editMission.agent_id ? [editMission.agent_id] : []);
      setForm({
        ...emptyForm,
        materiel: { ...emptyForm.materiel, ...(editMission.materiel || {}) },
        type: editMission.type || 'gardiennage',
        type_label: SERVICE_TYPES.find((item) => item[0] === editMission.type)?.[1] || editMission.title?.split(' - ')[0] || SERVICE_TYPES[0][1],
        client_id: editMission.client_id || '',
        client_name: editMission.client_name || '',
        contrat_id: editMission.contrat_id || '',
        site_id: editMission.site_id || '',
        site_name: editMission.site_name || '',
        batiment: editMission.batiment || '',
        poste_ref: editMission.poste_ref || '',
        specialite: editMission.specialite || '',
        date: editMission.date ? editMission.date.split('T')[0] : (defaultDate || ''),
        heure_debut: editMission.start_time || '',
        heure_fin: editMission.end_time || '',
        agent_ids: ids,
        agent_id: ids[0] || '',
        agent_name: editMission.agent_name || '',
        agent_email: editMission.agent_email || '',
        remplacant_id: editMission.remplacant_id || '',
        agents_required: editMission.agents_required || 1,
        qualifications: editMission.qualifications || [],
        habilitation_autre: editMission.habilitation_autre || '',
        ronde_id: editMission.ronde_id || '',
        ronde_frequence: editMission.ronde_frequence || 1,
        instructions: editMission.notes || '',
        pause_minutes: editMission.pause_minutes || '',
        pause_debut: editMission.pause_debut || '',
        pause_remuneree: !!editMission.pause_remuneree,
        document_ids: editMission.document_ids || [],
        planifier_visible: editMission.visible_agent !== false,
      });
      return;
    }
    setForm({
      ...emptyForm,
      materiel: { ...emptyForm.materiel },
      date: defaultDate || '',
    });
  }, [open, editMission, defaultDate]);

  const { data: sites = [] } = useQuery({
    queryKey: ['sites', companyId],
    queryFn: () => base44.entities.Site.filter({ company_id: companyId }),
    enabled: !!companyId && open,
  });
  const { data: clients = [] } = useQuery({
    queryKey: ['clients', companyId],
    queryFn: () => base44.entities.Client.filter({ company_id: companyId }),
    enabled: !!companyId && open,
  });
  const { data: agents = [] } = useQuery({
    queryKey: ['agents', companyId],
    queryFn: () => base44.entities.Agent.filter({ company_id: companyId }),
    enabled: !!companyId && open,
  });
  const { data: contrats = [] } = useQuery({
    queryKey: ['contrats', companyId],
    queryFn: () => base44.entities.Contrat.filter({ company_id: companyId }),
    enabled: !!companyId && open,
  });
  const { data: rondes = [] } = useQuery({
    queryKey: ['rondes', companyId],
    queryFn: () => base44.entities.Ronde.filter({ company_id: companyId }),
    enabled: !!companyId && open,
  });
  const { data: documents = [] } = useQuery({
    queryKey: ['documents', companyId],
    queryFn: () => base44.entities.Document.filter({ company_id: companyId }),
    enabled: !!companyId && open,
  });
  const { data: settings = [] } = useQuery({
    queryKey: ['companySettings', companyId],
    queryFn: () => base44.entities.CompanySettings.filter({ company_id: companyId }),
    enabled: !!companyId && open,
  });
  const { data: allMissions = [] } = useQuery({
    queryKey: ['missions', companyId],
    queryFn: () => base44.entities.Mission.filter({ company_id: companyId }, '-date', 500),
    enabled: !!companyId && open,
  });

  const client = clients.find((item) => item.id === form.client_id);
  const site = sites.find((item) => item.id === form.site_id);
  const contract = contrats.find((item) => item.id === form.contrat_id) || pickContract(contrats, form.client_id);
  const clientContracts = contrats.filter((item) => item.type_contrat === 'client' && item.target_id === form.client_id);
  const visibleSites = form.client_id
    ? sites.filter((item) => !item.client_id || item.client_id === form.client_id)
    : sites;
  const siteRondes = rondes.filter((item) => !form.site_id || item.site_id === form.site_id);
  const selectedRonde = rondes.find((item) => item.id === form.ronde_id);
  const company = settings[0];
  const feries = useMemo(() => {
    const year = form.date ? Number(form.date.slice(0, 4)) : new Date().getFullYear();
    return { ...buildJoursFeriesMap(year - 1), ...buildJoursFeriesMap(year), ...buildJoursFeriesMap(year + 1) };
  }, [form.date]);
  const holidayName = form.date ? feries[form.date] : '';
  const hours = serviceDurationHours(form.heure_debut, form.heure_fin);
  const durLabel = hours
    ? `${Math.floor(hours)} h${Math.round((hours % 1) * 60) ? String(Math.round((hours % 1) * 60)).padStart(2, '0') : ''}`.trim()
    : '';
  const assigned = agents.filter((agent) => form.agent_ids.includes(agent.id));
  const rate = money(client?.tarification?.taux_horaire_base);
  const quote = form.date && form.heure_debut && form.heure_fin
    ? qualifyService(new Date(`${form.date}T12:00:00`), form.heure_debut, form.heure_fin, feries)
    : null;
  const majoration = quote?.isFerie
    ? money(client?.tarification?.majoration_ferie) || 0
    : quote?.isSunday
      ? money(client?.tarification?.majoration_dimanche) || 0
      : quote?.isNight
        ? money(client?.tarification?.majoration_nuit) || 0
        : 0;
  const estimate = rate == null ? null : rate * hours * (Number(form.agents_required) || 1) * (1 + majoration / 100);

  const chooseClient = (id) => {
    const next = clients.find((item) => item.id === id);
    const nextContract = pickContract(contrats, id);
    const keepSite = sites.find((item) => item.id === form.site_id)?.client_id === id;
    patch({
      client_id: id,
      client_name: next?.company_name || '',
      contrat_id: nextContract?.id || '',
      site_id: keepSite ? form.site_id : '',
      site_name: keepSite ? form.site_name : '',
    });
  };

  const chooseSite = (id) => {
    const next = sites.find((item) => item.id === id);
    const nextClient = clients.find((item) => item.id === next?.client_id);
    const nextContract = nextClient ? pickContract(contrats, nextClient.id) : null;
    patch({
      site_id: id,
      site_name: next?.name || '',
      client_id: nextClient?.id || form.client_id,
      client_name: nextClient?.company_name || form.client_name,
      contrat_id: nextContract?.id || (nextClient ? '' : form.contrat_id),
      batiment: '',
    });
  };

  const toggleAgent = (id) => {
    const nextIds = form.agent_ids.includes(id)
      ? form.agent_ids.filter((item) => item !== id)
      : [...form.agent_ids, id];
    const first = agents.find((agent) => agent.id === nextIds[0]);
    patch({
      agent_ids: nextIds,
      agent_id: first?.id || '',
      agent_name: first ? `${first.first_name || ''} ${first.last_name || ''}`.trim() : '',
      agent_email: first?.email || '',
      remplacant_id: nextIds.includes(form.remplacant_id) ? '' : form.remplacant_id,
    });
  };

  const complianceViolations = (() => {
    if (!form.agent_id || !form.date || !form.heure_debut || !form.heure_fin) return [];
    const agentMissions = allMissions.filter((mission) => mission.agent_id === form.agent_id && mission.status !== 'annulee');
    return checkAgentCompliance(agentMissions, {
      date: form.date, start_time: form.heure_debut, end_time: form.heure_fin,
    });
  })();

  const createMut = useMutation({
    mutationFn: async (payloads) => {
      const list = Array.isArray(payloads) ? payloads : [payloads];
      const results = [];
      for (const data of list) results.push(await base44.entities.Mission.create({ ...data, company_id: companyId }));
      return results;
    },
    onSuccess: (results) => {
      qc.invalidateQueries({ queryKey: ['missions'] });
      toast.success(results.length > 1 ? `${results.length} vacations planifiées` : 'Vacation enregistrée');
      onClose();
    },
    onError: (error) => toast.error(error.message || 'Impossible de planifier'),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Mission.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['missions'] });
      toast.success('Vacation modifiée');
      onClose();
    },
    onError: (error) => toast.error(error.message || 'Impossible de modifier'),
  });

  const handleSave = (draft) => {
    if (!form.date) { toast.error('La date du service est requise'); return; }
    if (form.recurrence && !form.date_fin_recurrence) { toast.error('Indiquez une date de fin de récurrence'); return; }
    if (form.recurrence && !form.recurrence_type) { toast.error('Choisissez un type de récurrence'); return; }
    const dates = expandRecurrenceDates(form);
    if (!dates.length) { toast.error('Aucune date générée pour cette récurrence'); return; }
    if (dates.length > 200) { toast.error('Trop de dates (max 200). Réduisez la période.'); return; }
    const missing = (form.qualifications || []).filter((label) => assigned.some((agent) => !agentHasQualification(agent, label)));
    if (missing.length && assigned.length) {
      toast.message(`Qualification absente de la fiche agent : ${missing.join(', ')}`);
    }
    const base = {
      company_id: companyId,
      title: `${form.type_label} - ${form.site_name || 'Sans site'}`,
      type: form.type,
      site_id: form.site_id || undefined,
      site_name: form.site_name || undefined,
      client_id: form.client_id || site?.client_id || undefined,
      client_name: form.client_name || site?.client_name || client?.company_name || undefined,
      contrat_id: contract?.id || undefined,
      contrat_title: contract?.title || undefined,
      batiment: form.batiment || undefined,
      poste_ref: form.poste_ref || undefined,
      specialite: form.specialite || undefined,
      agent_id: form.agent_id || undefined,
      agent_ids: form.agent_ids,
      agent_name: form.agent_name || undefined,
      agent_email: form.agent_email || undefined,
      remplacant_id: form.remplacant_id || undefined,
      remplacant_name: agents.find((agent) => agent.id === form.remplacant_id)
        ? `${agents.find((agent) => agent.id === form.remplacant_id).first_name} ${agents.find((agent) => agent.id === form.remplacant_id).last_name}`
        : undefined,
      agents_required: Number(form.agents_required) || 1,
      qualifications: form.qualifications,
      habilitation_autre: form.habilitation_autre || undefined,
      ronde_id: form.ronde_id || undefined,
      ronde_name: selectedRonde?.name || undefined,
      ronde_frequence: Number(form.ronde_frequence) || undefined,
      start_time: form.heure_debut,
      end_time: form.heure_fin,
      notes: form.instructions,
      pause_minutes: form.pause_minutes || undefined,
      pause_debut: form.pause_debut || undefined,
      pause_remuneree: !!form.pause_remuneree,
      materiel: form.materiel,
      document_ids: form.document_ids,
      status: 'planifiee',
      draft: !!draft,
      visible_agent: draft ? false : form.planifier_visible !== false,
      recurrence: !!form.recurrence,
      recurrence_type: form.recurrence ? form.recurrence_type : undefined,
      recurrence_group_id: form.recurrence ? `rec-${Date.now()}` : undefined,
    };
    if (editMission) {
      updateMut.mutate({ id: editMission.id, data: { ...base, date: form.date } });
      return;
    }
    createMut.mutate(dates.map((date) => ({ ...base, date })));
  };

  if (!open) return null;

  const covered = assigned.length >= (Number(form.agents_required) || 1) && assigned.length > 0;
  const clientDocs = documents.filter((item) => !form.client_id || item.target_id === form.client_id || item.target_type === 'tous' || !item.target_id);
  const zoneOptions = site?.specialites?.map((item) => item.name).filter(Boolean) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 sm:py-4 px-0 sm:px-4 overflow-y-auto">
      <div className="bg-[#f7f8fb] sm:rounded-3xl shadow-2xl w-full max-w-6xl flex flex-col h-[100dvh] sm:h-auto sm:max-h-[94vh] overflow-hidden">
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-5 py-4 bg-[#10192b] text-white">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-xl bg-[#e4b54a] text-[#1c1403] flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold truncate">{editMission ? 'Modifier la vacation' : 'Créer une vacation'}</h2>
              <p className="text-xs text-white/60">Définissez les paramètres de la vacation de sécurité</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="shrink-0 grid grid-cols-2 xl:grid-cols-4 gap-px bg-slate-200 border-b">
          <Chip icon={MapPin} kicker="Site" value={site?.name || 'Sans site'} />
          <Chip icon={Tag} kicker="Spécialité" value={form.specialite || form.type_label} />
          <Chip icon={Clock} kicker="Horaires" value={form.heure_debut && form.heure_fin ? `${form.heure_debut} – ${form.heure_fin}${durLabel ? ` (${durLabel})` : ''}` : '—'} />
          <Chip icon={Users} kicker="Effectif" value={`${form.agents_required} agent${Number(form.agents_required) > 1 ? 's' : ''}`} />
        </div>

        <div className="flex flex-1 min-h-0 flex-col xl:flex-row">
          <div className="xl:hidden flex overflow-x-auto border-b bg-white shrink-0">
            {TABS.map((tab, index) => (
              <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={cn('shrink-0 px-3 py-2 text-xs border-b-2', activeTab === tab.key ? 'border-[#e4b54a] text-[#1c1403] font-semibold' : 'border-transparent text-slate-500')}>
                {index + 1}. {tab.label}
              </button>
            ))}
          </div>
          <nav className="hidden xl:flex w-56 shrink-0 flex-col gap-0.5 bg-white border-r py-3 overflow-y-auto">
            {TABS.map((tab, index) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={cn('mx-2 flex items-center gap-2 px-2.5 py-2 rounded-xl text-sm text-left', active ? 'bg-[#f6e7c3] text-[#1c1403] font-semibold' : 'text-slate-600 hover:bg-slate-50')}>
                  <span className="w-5 text-xs text-slate-400">{index + 1}</span>
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5 min-w-0">
            {activeTab === 'general' && (
              <Section icon={Home} title="Général" text="Site, bâtiment et référence du poste">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Type de prestation *">
                    <Select value={form.type} onValueChange={(value) => patch({ type: value, type_label: SERVICE_TYPES.find((item) => item[0] === value)?.[1] || value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{SERVICE_TYPES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Spécialité">
                    <Select value={form.specialite} onValueChange={(value) => patch({ specialite: value })}>
                      <SelectTrigger><SelectValue placeholder="Surveillance générale" /></SelectTrigger>
                      <SelectContent>
                        {(form.specialite && !SPECIALITES.includes(form.specialite) ? [form.specialite, ...SPECIALITES] : SPECIALITES).map((name) => (
                          <SelectItem key={name} value={name}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Site *">
                    <Select value={form.site_id} onValueChange={chooseSite}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner un site" /></SelectTrigger>
                      <SelectContent>{visibleSites.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Bâtiment / zone">
                    {zoneOptions.length ? (
                      <Select value={form.batiment} onValueChange={(value) => patch({ batiment: value })}>
                        <SelectTrigger><SelectValue placeholder="Zone du site" /></SelectTrigger>
                        <SelectContent>{zoneOptions.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : (
                      <Input value={form.batiment} onChange={(event) => patch({ batiment: event.target.value })} placeholder="Accueil, parking, étage…" />
                    )}
                  </Field>
                  <Field label="Référence du poste">
                    <Input value={form.poste_ref} onChange={(event) => patch({ poste_ref: event.target.value })} placeholder="Ex. POSTE-ACC-01" />
                  </Field>
                  <Field label="Effectif requis *">
                    <div className="inline-flex items-center gap-2">
                      <button type="button" className="w-8 h-8 rounded-lg border" onClick={() => patch({ agents_required: Math.max(1, Number(form.agents_required) - 1) })}>-</button>
                      <span className="w-8 text-center font-semibold">{form.agents_required}</span>
                      <button type="button" className="w-8 h-8 rounded-lg border" onClick={() => patch({ agents_required: Math.min(50, Number(form.agents_required) + 1) })}>+</button>
                    </div>
                  </Field>
                </div>
              </Section>
            )}

            {activeTab === 'client' && (
              <Section icon={Building2} title="Client & contrat" text="Le contrat, le tarif et les conditions sont repris de la fiche">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Client *">
                    <Select value={form.client_id} onValueChange={chooseClient}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                      <SelectContent>{clients.map((item) => <SelectItem key={item.id} value={item.id}>{item.company_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Contrat">
                    {clientContracts.length > 1 ? (
                      <Select value={contract?.id || ''} onValueChange={(value) => patch({ contrat_id: value })}>
                        <SelectTrigger><SelectValue placeholder="Contrat du client" /></SelectTrigger>
                        <SelectContent>{clientContracts.map((item) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : (
                      <Input readOnly value={contract?.title || (form.client_id ? 'Aucun contrat client' : 'Choisissez un client')} />
                    )}
                  </Field>
                </div>
                {client && (
                  <div className="rounded-xl border bg-slate-50 p-3 text-sm space-y-1">
                    <p className="font-medium">{client.company_name}</p>
                    <p className="text-slate-500">{[client.address, client.postal_code, client.city].filter(Boolean).join(' ') || 'Adresse non renseignée'}</p>
                    <p className="text-slate-500">{client.contact_name || 'Contact non renseigné'}{client.phone ? ` · ${client.phone}` : ''}</p>
                    {client.siret && <p className="text-slate-500">SIRET {client.siret}</p>}
                  </div>
                )}
                {contract?.content && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Conditions contractuelles</p>
                    <p className="text-sm whitespace-pre-wrap rounded-xl border p-3 max-h-40 overflow-y-auto">{contract.content}</p>
                  </div>
                )}
                <p className="text-xs text-slate-500">Le tarif horaire reste celui de la fiche client. Il se consulte dans Facturation et ne se modifie pas ici.</p>
              </Section>
            )}

            {activeTab === 'planification' && (
              <Section icon={Calendar} title="Planification" text="Date, horaires, récurrence et jours fériés">
                <PlanificationFields form={form} patch={patch} holidayName={holidayName} datesCount={form.date && form.recurrence ? expandRecurrenceDates(form).length : 0} durLabel={durLabel} />
              </Section>
            )}

            {activeTab === 'collaborateurs' && (
              <Section icon={Users} title="Collaborateurs" text="Effectif requis, agents affectés et remplaçant">
                <Field label="Effectif requis *">
                  <div className="inline-flex items-center gap-2">
                    <button type="button" className="w-8 h-8 rounded-lg border" onClick={() => patch({ agents_required: Math.max(1, Number(form.agents_required) - 1) })}>-</button>
                    <span className="w-8 text-center font-semibold">{form.agents_required}</span>
                    <button type="button" className="w-8 h-8 rounded-lg border" onClick={() => patch({ agents_required: Math.min(50, Number(form.agents_required) + 1) })}>+</button>
                  </div>
                </Field>
                <div className="space-y-2">
                  {agents.filter((agent) => agent.status !== 'inactif').map((agent) => {
                    const on = form.agent_ids.includes(agent.id);
                    const missing = (form.qualifications || []).filter((label) => !agentHasQualification(agent, label));
                    return (
                      <label key={agent.id} className={cn('flex items-center gap-3 rounded-xl border px-3 py-2', on && 'border-[#e4b54a] bg-[#fffaf0]')}>
                        <input type="checkbox" checked={on} onChange={() => toggleAgent(agent.id)} />
                        <span className="flex-1">
                          <span className="block text-sm font-medium">{agent.first_name} {agent.last_name}</span>
                          <span className="block text-[11px] text-slate-400">{agent.fonction || 'Fonction non renseignée'}{on && missing.length ? ` · manque ${missing.join(', ')}` : ''}</span>
                        </span>
                      </label>
                    );
                  })}
                  {agents.length === 0 && <p className="text-sm text-slate-400">Aucun agent dans la société.</p>}
                </div>
                <Field label="Remplaçant">
                  <Select value={form.remplacant_id || 'none'} onValueChange={(value) => patch({ remplacant_id: value === 'none' ? '' : value })}>
                    <SelectTrigger><SelectValue placeholder="Aucun remplaçant" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun</SelectItem>
                      {agents.filter((agent) => !form.agent_ids.includes(agent.id)).map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>{agent.first_name} {agent.last_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                {form.agent_id && form.date && form.heure_debut && form.heure_fin && (
                  <div>
                    <ComplianceAlerts violations={complianceViolations} />
                    {complianceViolations.length === 0 && (
                      <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-2.5 inline-flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5" /> Planification conforme au Code du travail et à la CCN EPS
                      </p>
                    )}
                  </div>
                )}
              </Section>
            )}

            {activeTab === 'qualifications' && (
              <Section icon={ShieldCheck} title="Qualifications" text="Diplômes et habilitations exigés pour cette vacation">
                <div className="grid sm:grid-cols-2 gap-2">
                  {QUALIFICATIONS.map((label) => {
                    const on = form.qualifications.includes(label);
                    return (
                      <label key={label} className={cn('flex items-center gap-2 rounded-xl border px-3 py-2 text-sm', on && 'border-emerald-300 bg-emerald-50')}>
                        <input type="checkbox" checked={on} onChange={() => patch({ qualifications: on ? form.qualifications.filter((item) => item !== label) : [...form.qualifications, label] })} />
                        {label}
                      </label>
                    );
                  })}
                </div>
                <Field label="Autre habilitation">
                  <Input value={form.habilitation_autre} onChange={(event) => patch({ habilitation_autre: event.target.value })} placeholder="Habilitation électrique, cynophile…" />
                </Field>
                <p className="text-xs text-slate-500">La comparaison se fait avec la fonction inscrite sur la fiche agent. Un diplôme absent de la fiche est signalé, il n’est pas inventé.</p>
              </Section>
            )}

            {activeTab === 'rondes' && (
              <Section icon={Route} title="Rondes" text="Parcours déjà créé pour le site">
                {!form.site_id && <p className="text-sm text-slate-400">Choisissez un site pour voir ses rondes.</p>}
                {form.site_id && siteRondes.length === 0 && <p className="text-sm text-slate-400">Aucune ronde enregistrée sur ce site.</p>}
                {siteRondes.length > 0 && (
                  <Field label="Parcours">
                    <Select value={form.ronde_id || 'none'} onValueChange={(value) => patch({ ronde_id: value === 'none' ? '' : value })}>
                      <SelectTrigger><SelectValue placeholder="Choisir une ronde" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucune</SelectItem>
                        {siteRondes.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
                {selectedRonde && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-2">Points de contrôle</p>
                    <ul className="space-y-1">
                      {(selectedRonde.checkpoints || []).map((point) => (
                        <li key={point.id || point.name} className="text-sm rounded-lg border px-3 py-2">{point.order ? `${point.order}. ` : ''}{point.name}</li>
                      ))}
                      {(selectedRonde.checkpoints || []).length === 0 && <li className="text-sm text-slate-400">Cette ronde n’a pas encore de point.</li>}
                    </ul>
                  </div>
                )}
                <Field label="Fréquence sur la vacation">
                  <Input type="number" min={1} value={form.ronde_frequence} onChange={(event) => patch({ ronde_frequence: event.target.value })} />
                </Field>
              </Section>
            )}

            {activeTab === 'instructions' && (
              <Section icon={FileText} title="Instructions" text="Consignes du site et consignes particulières">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Consignes générales du site</p>
                  <p className="text-sm rounded-xl border bg-slate-50 p-3 whitespace-pre-wrap">{site?.instructions || 'Aucune consigne générale sur la fiche du site.'}</p>
                </div>
                <Field label="Consignes particulières">
                  <Textarea value={form.instructions} onChange={(event) => patch({ instructions: event.target.value })} className="min-h-[140px]" placeholder="Consigne propre à cette vacation" />
                </Field>
              </Section>
            )}

            {activeTab === 'pauses' && (
              <Section icon={Coffee} title="Pauses" text="Durée, horaire et rémunération">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Durée (minutes)">
                    <Input type="number" min={0} value={form.pause_minutes} onChange={(event) => patch({ pause_minutes: event.target.value })} />
                  </Field>
                  <Field label="Horaire de pause">
                    <Input type="time" value={form.pause_debut} onChange={(event) => patch({ pause_debut: event.target.value })} />
                  </Field>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={form.pause_remuneree} onCheckedChange={(value) => patch({ pause_remuneree: value })} />
                  Pause rémunérée
                </label>
              </Section>
            )}

            {activeTab === 'materiel' && (
              <Section icon={Package} title="Matériel" text="Équipements obligatoires pour cette vacation">
                <div className="grid sm:grid-cols-2 gap-2">
                  {MATERIEL.map(([key, label]) => (
                    <label key={key} className={cn('flex items-center gap-2 rounded-xl border px-3 py-2 text-sm', form.materiel[key] && 'border-emerald-300 bg-emerald-50')}>
                      <input type="checkbox" checked={!!form.materiel[key]} onChange={(event) => patch({ materiel: { ...form.materiel, [key]: event.target.checked } })} />
                      {label}
                    </label>
                  ))}
                </div>
                {site?.cles?.length > 0 && (
                  <p className="text-xs text-slate-500">Clés connues sur le site : {site.cles.map((item) => item.name).filter(Boolean).join(', ') || 'sans nom'}.</p>
                )}
              </Section>
            )}

            {activeTab === 'contacts' && (
              <Section icon={Phone} title="Contacts" text="Interlocuteurs déjà présents sur les fiches">
                <ContactLine label="Responsable du site" value={client?.contact_name} />
                <ContactLine label="Téléphone" value={client?.phone} />
                <ContactLine label="Urgence client" value={client?.urgence_phone} />
                <ContactLine label="Urgences du site" value={(site?.urgences || []).filter(Boolean).join(', ')} />
                <ContactLine label="Responsable d'exploitation" value={company?.company_name} />
                <ContactLine label="Téléphone exploitation" value={company?.phone} />
                <ContactLine label="Email société" value={company?.email} />
              </Section>
            )}

            {activeTab === 'facturation' && (
              <Section icon={Receipt} title="Facturation" text="Coût prévisionnel, sans modification du tarif">
                {!isAdmin && <p className="text-sm text-slate-500">Le tarif est visible par les administrateurs. Il est repris de la fiche client.</p>}
                {isAdmin && !client && <p className="text-sm text-slate-500">Sélectionnez un client pour afficher son tarif.</p>}
                {isAdmin && client && rate == null && <p className="text-sm text-slate-500">Aucun tarif horaire n’est renseigné sur la fiche de {client.company_name}.</p>}
                {isAdmin && rate != null && (
                  <div className="grid sm:grid-cols-2 gap-3 text-sm">
                    <Readonly label="Tarif horaire HT" value={`${rate.toLocaleString('fr-FR')} €`} />
                    <Readonly label="Majoration nuit" value={`${money(client.tarification?.majoration_nuit) || 0} %`} />
                    <Readonly label="Majoration dimanche" value={`${money(client.tarification?.majoration_dimanche) || 0} %`} />
                    <Readonly label="Majoration jour férié" value={`${money(client.tarification?.majoration_ferie) || 0} %`} />
                    <Readonly label="Heures" value={hours ? `${hours.toLocaleString('fr-FR')} h` : '—'} />
                    <Readonly label="Estimation" value={estimate == null || !hours ? '—' : `${estimate.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} € HT`} />
                  </div>
                )}
                {isAdmin && rate != null && (
                  <p className="text-xs text-slate-500">
                    Ce tarif est repris de la fiche client. Il n’est pas modifiable depuis la vacation.
                    {quote ? ` L’estimation applique la majoration du créneau « ${quote.label} ».` : ''}
                  </p>
                )}
              </Section>
            )}

            {activeTab === 'documents' && (
              <Section icon={Paperclip} title="Documents" text="Pièces déjà rangées sur le client ou le site">
                {clientDocs.length === 0 && !(site?.pieces_jointes || []).length && (
                  <p className="text-sm text-slate-400">Aucun document sur la fiche client ou le site.</p>
                )}
                <div className="space-y-2">
                  {clientDocs.map((item) => {
                    const on = form.document_ids.includes(item.id);
                    return (
                      <label key={item.id} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                        <input type="checkbox" checked={on} onChange={() => patch({ document_ids: on ? form.document_ids.filter((id) => id !== item.id) : [...form.document_ids, item.id] })} />
                        <span className="flex-1 truncate">{item.name || 'Document'}</span>
                        {item.file_url && <a href={item.file_url} target="_blank" rel="noreferrer" className="text-xs text-amber-700">Ouvrir</a>}
                      </label>
                    );
                  })}
                  {(site?.pieces_jointes || []).map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer" className="block text-sm rounded-xl border px-3 py-2 text-amber-800">Pièce du site</a>
                  ))}
                </div>
              </Section>
            )}
          </div>

          <aside className="hidden xl:block w-72 shrink-0 border-l bg-[#10192b] text-white p-4 overflow-y-auto">
            <p className="text-sm font-semibold mb-1">Récapitulatif</p>
            <p className="text-[11px] text-white/50 mb-4">Aperçu de la vacation</p>
            <Recap label="Site" value={site?.name || '—'} />
            <Recap label="Client" value={client?.company_name || '—'} />
            <Recap label="Contrat" value={contract?.title || '—'} />
            <Recap label="Date" value={form.date ? capitalize(format(new Date(`${form.date}T12:00:00`), 'EEEE d MMMM yyyy', { locale: fr })) : '—'} />
            <Recap label="Horaires" value={form.heure_debut && form.heure_fin ? `${form.heure_debut} – ${form.heure_fin}` : '—'} />
            <Recap label="Effectif requis" value={String(form.agents_required)} />
            <div className="mt-4 rounded-xl bg-white/5 px-3 py-2 flex items-center justify-between text-sm">
              <span>Couverture</span>
              <span className={cn('text-xs font-semibold px-2 py-1 rounded-full', covered ? 'bg-emerald-500/20 text-emerald-200' : 'bg-amber-400/20 text-amber-100')}>
                {covered ? 'Poste couvert' : `${assigned.length}/${form.agents_required} affecté${assigned.length > 1 ? 's' : ''}`}
              </span>
            </div>
            <p className="text-[11px] text-white/50 mt-4">La vacation sera créée à partir des fiches client, contrat, site et agents. Le tarif n’est pas recopié comme un prix modifiable.</p>
          </aside>
        </div>

        <div className="shrink-0 flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 border-t bg-white">
          <label className="flex items-center gap-2 text-sm text-slate-600 mr-auto">
            <input type="checkbox" checked={form.planifier_visible} onChange={(event) => patch({ planifier_visible: event.target.checked })} className="accent-[#c9a227]" />
            Publier dans le planning après validation
          </label>
          <Button type="button" variant="outline" onClick={() => handleSave(true)} disabled={createMut.isPending || updateMut.isPending}>Enregistrer en brouillon</Button>
          <Button type="button" onClick={() => handleSave(false)} disabled={createMut.isPending || updateMut.isPending} className="bg-[#e4b54a] hover:bg-[#d7a63a] text-[#1c1403]">
            {createMut.isPending || updateMut.isPending ? 'Enregistrement…' : (editMission ? 'Enregistrer' : 'Créer la vacation')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PlanificationFields({ form, patch, holidayName, datesCount, durLabel }) {
  return (
    <div className="space-y-4">
      <label className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border">
        <Switch checked={form.recurrence} onCheckedChange={(value) => patch({ recurrence: value })} />
        <span className="text-sm">Récurrence</span>
      </label>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Date de début *"><Input type="date" value={form.date} onChange={(event) => patch({ date: event.target.value })} /></Field>
        {form.recurrence && <Field label="Date de fin *"><Input type="date" value={form.date_fin_recurrence} onChange={(event) => patch({ date_fin_recurrence: event.target.value })} /></Field>}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
        <Field label="Heure de début"><Input type="time" value={form.heure_debut} onChange={(event) => patch({ heure_debut: event.target.value })} /></Field>
        <span className="pb-2 text-slate-400">→</span>
        <Field label="Heure de fin"><Input type="time" value={form.heure_fin} onChange={(event) => patch({ heure_fin: event.target.value })} /></Field>
      </div>
      {holidayName && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">Jour férié : {holidayName}</p>}
      {durLabel && <p className="text-xs text-emerald-700">Durée : {durLabel}</p>}
      {form.recurrence && (
        <div className="border rounded-xl p-4 space-y-3">
          <Field label="Type">
            <Select value={form.recurrence_type} onValueChange={(value) => patch({ recurrence_type: value })}>
              <SelectTrigger><SelectValue placeholder="Récurrence" /></SelectTrigger>
              <SelectContent>{RECURRENCE_TYPES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          {['Quotidienne', 'Hebdomadaire', 'Mensuelle'].includes(form.recurrence_type) && (
            <div className="flex flex-wrap items-center gap-3">
              <Input type="number" min={1} className="w-20" value={form.recurrence_frequence} onChange={(event) => patch({ recurrence_frequence: Number(event.target.value) || 1 })} />
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.recurrence_exclure_feries} onCheckedChange={(value) => patch({ recurrence_exclure_feries: value })} />
                Exclure les jours fériés
              </label>
            </div>
          )}
          {form.recurrence_type === 'Hebdomadaire' && (
            <div className="flex flex-wrap gap-3">
              {JOURS_SEMAINE.map((day) => {
                const selected = (form.recurrence_jours || []).includes(day);
                return (
                  <label key={day} className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" checked={selected} onChange={() => patch({ recurrence_jours: selected ? form.recurrence_jours.filter((item) => item !== day) : [...form.recurrence_jours, day] })} />
                    {day}
                  </label>
                );
              })}
            </div>
          )}
          {form.recurrence_type === 'Mensuelle' && (
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => {
                const selected = (form.recurrence_jours_mois || []).includes(day);
                return (
                  <button key={day} type="button" onClick={() => patch({ recurrence_jours_mois: selected ? form.recurrence_jours_mois.filter((item) => item !== day) : [...(form.recurrence_jours_mois || []), day] })} className={cn('h-8 rounded-lg border text-sm', selected ? 'bg-slate-900 text-white' : 'bg-white')}>{day}</button>
                );
              })}
            </div>
          )}
          {datesCount > 0 && <p className="text-xs text-emerald-700">{datesCount} vacation(s) seront créées.</p>}
        </div>
      )}
    </div>
  );
}

function Section({ icon: Icon, title, text, children }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-full bg-[#f6e7c3] text-[#1c1403] flex items-center justify-center"><Icon className="w-4 h-4" /></span>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-xs text-slate-500">{text}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Chip({ icon: Icon, kicker, value }) {
  return (
    <div className="bg-white px-4 py-3 flex items-center gap-2 min-w-0">
      <Icon className="w-4 h-4 text-emerald-600 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-slate-400">{kicker}</p>
        <p className="text-sm font-semibold truncate">{value}</p>
      </div>
    </div>
  );
}

function Recap({ label, value }) {
  return (
    <div className="mb-3">
      <p className="text-[10px] uppercase tracking-wide text-white/40">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

function ContactLine({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-right">{value || 'Non renseigné'}</span>
    </div>
  );
}

function Readonly({ label, value }) {
  return (
    <div className="rounded-xl border bg-slate-50 px-3 py-2">
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
