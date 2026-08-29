import React, { useState, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield, Clock, AlertTriangle, CheckCircle2, Download, MapPin, Navigation,
  BookOpen, Bell, Calendar, Lock, Phone, Mail, CreditCard, Building2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useCompany } from '@/lib/useCompany';
import { useGeolocation } from '@/lib/useGeolocation';
import { usePtiTimer } from '@/lib/usePtiTimer';
import { useFallDetection } from '@/lib/useFallDetection';
import PtiModernScreen from '@/components/agent/PtiModernScreen';
import PtiCheckOverlay from '@/components/agent/PtiCheckOverlay';
import { toast } from 'sonner';
import PriseDeServiceNFC from '@/components/agent/PriseDeServiceNFC';
import FinDeServicePhoto from '@/components/agent/FinDeServicePhoto';
import RondeNFC from '@/components/agent/RondeNFC';
import ServiceChrono from '@/components/agent/ServiceChrono';
import ServiceNonPlanifie from '@/components/agent/ServiceNonPlanifie';
import ServiceEnCours from '@/components/agent/ServiceEnCours';
import { normalizeDateKey, isMissionVisibleToAgent } from '@/lib/recurrenceExpand';
import { mergeAgentDroits, assignedSiteIds, accountDisplayName } from '@/lib/agentPortal';
import PlanningMapView from '@/components/planning/PlanningMapView';
import { canStartPlannedService } from '@/lib/serviceStartRules';

const CATEGORY_CONFIG = {
  general: { label: 'Général', color: 'bg-gray-100 text-gray-700' },
  securite: { label: 'Sécurité', color: 'bg-blue-100 text-blue-700' },
  urgence: { label: 'Urgence', color: 'bg-red-100 text-red-700' },
  acces: { label: 'Accès', color: 'bg-amber-100 text-amber-700' },
  procedures: { label: 'Procédures', color: 'bg-purple-100 text-purple-700' },
  contacts: { label: 'Contacts', color: 'bg-green-100 text-green-700' },
};

function AccessDenied({ label }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Lock className="w-12 h-12 text-muted-foreground/40 mb-3" />
      <p className="font-semibold text-muted-foreground">Accès non autorisé</p>
      <p className="text-sm text-muted-foreground/70 mt-1">Vous n'avez pas accès au module <strong>{label}</strong>. Contactez votre responsable.</p>
    </div>
  );
}

function MissionCard({ mission, today, trailing }) {
  const day = normalizeDateKey(mission.date);
  const dateObj = day ? new Date(`${day}T12:00:00`) : null;
  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <div className="text-center w-12 shrink-0">
          <p className="text-lg font-bold text-primary">{dateObj ? format(dateObj, 'd', { locale: fr }) : '—'}</p>
          <p className="text-xs text-muted-foreground uppercase">{dateObj ? format(dateObj, 'MMM', { locale: fr }) : ''}</p>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{mission.title}</p>
          <p className="text-sm text-muted-foreground">{mission.site_name} • {mission.start_time} - {mission.end_time}</p>
        </div>
        {trailing || (
          <Badge variant="outline" className="shrink-0">
            {day === today ? "Aujourd'hui" : dateObj ? format(dateObj, 'EEE', { locale: fr }) : ''}
          </Badge>
        )}
      </div>
    </Card>
  );
}

export default function EspaceAgent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'accueil';
  const setActiveTab = (tab) => {
    if (tab === 'accueil') setSearchParams({});
    else setSearchParams({ tab });
  };
  const [showPriseForm, setShowPriseForm] = useState(false);
  const [showFinService, setShowFinService] = useState(false);
  const [selectedMission, setSelectedMission] = useState(null);
  const [showRondeDialog, setShowRondeDialog] = useState(false);
  const [selectedRonde, setSelectedRonde] = useState(null);
  const [selectedConsigne, setSelectedConsigne] = useState(null);
  const [showDemandeForm, setShowDemandeForm] = useState(false);
  const [demandeForm, setDemandeForm] = useState({ subject: '', message: '' });
  const [planDay, setPlanDay] = useState(() => new Date());
  const [lastSeenConsignes, setLastSeenConsignes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('last_seen_consignes') || '{}'); } catch { return {}; }
  });
  const { user, companyId } = useCompany();
  const qc = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: agentFiche } = useQuery({
    queryKey: ['ma_fiche_agent', user?.email, companyId],
    queryFn: async () => {
      const agents = await base44.entities.Agent.filter({ company_id: companyId });
      const email = String(user?.email || '').toLowerCase();
      const byEmail = agents.find((a) => String(a.email || '').toLowerCase() === email);
      if (byEmail) return byEmail;
      const full = String(user?.full_name || `${user?.first_name || ''} ${user?.last_name || ''}`).toLowerCase();
      return agents.find((a) => {
        const n = `${a.first_name || ''} ${a.last_name || ''}`.toLowerCase();
        return full && n && (full.includes(String(a.last_name || '').toLowerCase()) || n.includes(full));
      }) || null;
    },
    enabled: !!companyId && !!user,
  });

  const droits = mergeAgentDroits(agentFiche);
  const agentName = accountDisplayName(user, agentFiche);

  const { data: missions = [] } = useQuery({
    queryKey: ['missions', companyId, agentFiche?.id],
    queryFn: () => base44.entities.Mission.filter({ company_id: companyId }, '-date', 800),
    enabled: !!companyId,
  });
  const { data: sites = [] } = useQuery({
    queryKey: ['sites', companyId],
    queryFn: () => base44.entities.Site.filter({ company_id: companyId }),
    enabled: !!companyId,
  });
  const { data: settingsRows = [] } = useQuery({
    queryKey: ['company_settings', companyId],
    queryFn: () => base44.entities.CompanySettings.filter({ company_id: companyId }),
    enabled: !!companyId,
  });
  const companySettings = settingsRows[0] || {};
  const { data: services = [] } = useQuery({
    queryKey: ['prises_service', companyId],
    queryFn: () => base44.entities.PriseDeService.filter({ company_id: companyId }, '-date', 80),
    enabled: !!companyId,
  });
  const { data: rondes = [] } = useQuery({
    queryKey: ['rondes_agent', agentFiche?.id],
    queryFn: () => base44.entities.Ronde.filter({ company_id: companyId }),
    enabled: !!companyId && !!droits.acces_rondes,
  });
  const { data: mainCouranteData = [] } = useQuery({
    queryKey: ['mc_agent', companyId],
    queryFn: () => base44.entities.MainCourante.filter({ company_id: companyId }, '-date', 100),
    enabled: !!companyId && !!droits.acces_main_courante,
  });
  const { data: ecarts = [] } = useQuery({
    queryKey: ['ecarts_agent', user?.email, companyId],
    queryFn: () => base44.entities.PriseDeService.filter({ company_id: companyId }, '-date', 50),
    enabled: !!companyId && !!droits.acces_ecarts,
  });
  const { data: fiches = [] } = useQuery({
    queryKey: ['fiches_paie', companyId],
    queryFn: () => base44.entities.FicheDePaie.filter({ company_id: companyId }, '-year', 24),
    enabled: !!companyId && !!droits.acces_documents,
  });
  const { data: demandes = [] } = useQuery({
    queryKey: ['mes_demandes'],
    queryFn: () => base44.entities.Demande.filter({ from_type: 'agent', company_id: companyId }, '-created_date', 20),
    enabled: !!companyId && !!droits.acces_conges,
  });
  const { data: docs = [] } = useQuery({
    queryKey: ['mes_docs'],
    queryFn: () => base44.entities.Document.filter({ company_id: companyId }, '-created_date', 50),
    enabled: !!companyId && !!droits.acces_documents,
  });
  const { data: consignesRaw = [] } = useQuery({
    queryKey: ['cahier_consignes', companyId],
    queryFn: () => base44.entities.CahierConsignes.filter({ company_id: companyId, active: true }, '-updated_date', 100),
    enabled: !!companyId && !!droits.acces_consignes,
  });

  const visibility = {
    agentId: agentFiche?.id,
    userId: user?.id,
    agentEmail: user?.email || agentFiche?.email,
    agentName,
    firstName: agentFiche?.first_name || user?.first_name,
    lastName: agentFiche?.last_name || user?.last_name,
  };

  const myMissions = useMemo(
    () => missions
      .filter((m) => isMissionVisibleToAgent(m, visibility))
      .sort((a, b) => `${normalizeDateKey(a.date)} ${a.start_time || ''}`.localeCompare(`${normalizeDateKey(b.date)} ${b.start_time || ''}`)),
    [missions, agentFiche?.id, user?.id, user?.email, agentName],
  );

  const todayMissions = myMissions.filter((m) => normalizeDateKey(m.date) === today);
  const futureMissions = myMissions.filter((m) => normalizeDateKey(m.date) >= today);
  const siteIdSet = assignedSiteIds({ missions: myMissions, sites, agentId: agentFiche?.id });
  const assignedSites = sites.filter((s) => siteIdSet.includes(s.id));
  const consignes = consignesRaw.filter((c) => !c.site_id || siteIdSet.includes(c.site_id));
  const currentService = services.find((s) => {
    if (normalizeDateKey(s.date) !== today || s.status !== 'en_service') return false;
    if (s.agent_id && (s.agent_id === user?.id || s.agent_id === agentFiche?.id)) return true;
    if (s.agent_name && visibility.lastName && String(s.agent_name).toLowerCase().includes(String(visibility.lastName).toLowerCase())) return true;
    if (!s.agent_id) return true;
    return false;
  });

  const { data: currentSite } = useQuery({
    queryKey: ['site_geofence', currentService?.site_id],
    queryFn: () => base44.entities.Site.get(currentService.site_id),
    enabled: !!currentService?.site_id,
  });

  const mcCreateMut = useMutation({ mutationFn: (data) => base44.entities.MainCourante.create(data) });
  const alerteMut = useMutation({ mutationFn: (data) => base44.entities.Alerte.create(data) });
  const demandeMut = useMutation({
    mutationFn: (data) => base44.entities.Demande.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mes_demandes'] });
      setShowDemandeForm(false);
      setDemandeForm({ subject: '', message: '' });
      toast.success('Demande envoyée à la société');
    },
  });

  const geofenceAlertRef = useRef(false);

  const handleGeofenceViolation = useCallback(async ({ latitude, longitude }) => {
    if (!currentService || geofenceAlertRef.current) return;
    geofenceAlertRef.current = true;
    const now = format(new Date(), 'HH:mm');
    await alerteMut.mutateAsync({
      company_id: companyId,
      type: 'geofence',
      agent_id: user?.id,
      agent_name: agentName,
      site_id: currentService.site_id,
      site_name: currentService.site_name,
      client_name: currentService.client_name,
      message: `⚠️ ${agentName} hors zone autorisée sur ${currentService.site_name} (${now})`,
      latitude,
      longitude,
      date: today,
      time: now,
      severity: 'urgent',
    });
    await mcCreateMut.mutateAsync({
      company_id: companyId,
      site_id: currentService.site_id,
      site_name: currentService.site_name,
      client_name: currentService.client_name,
      agent_id: user?.id,
      agent_name: agentName,
      mission_id: currentService.mission_id,
      service_id: currentService.id,
      date: today,
      time: now,
      type: 'geofence',
      content: `Sortie de périmètre détectée — rayon ${currentSite?.geofence_radius || 200} m`,
      latitude,
      longitude,
      severity: 'urgent',
    });
    toast.error('Hors zone — alerte envoyée au centre');
    qc.invalidateQueries({ queryKey: ['alertes'] });
    setTimeout(() => { geofenceAlertRef.current = false; }, 120000);
  }, [currentService, companyId, user, agentName, today, currentSite, alerteMut, mcCreateMut, qc]);

  const { position, outsideZone } = useGeolocation({
    active: !!currentService,
    agentId: user?.id,
    agentName,
    serviceId: currentService?.id,
    siteId: currentService?.site_id,
    siteName: currentService?.site_name,
    companyId,
    siteLatitude: currentSite?.latitude,
    siteLongitude: currentSite?.longitude,
    geofenceRadius: currentSite?.geofence_radius ?? 200,
    onGeofenceViolation: handleGeofenceViolation,
  });

  const triggerPtiAlerte = useCallback(async (reason) => {
    if (!currentService) return;
    const now = format(new Date(), 'HH:mm');
    await mcCreateMut.mutateAsync({
      company_id: companyId,
      site_id: currentService.site_id,
      site_name: currentService.site_name,
      client_name: currentService.client_name,
      agent_id: user?.id,
      agent_name: agentName,
      mission_id: currentService.mission_id,
      service_id: currentService.id,
      date: today,
      time: now,
      type: 'pti_alerte',
      content: reason || `⚠️ ALERTE PTI déclenchée à ${now}`,
      latitude: position?.latitude,
      longitude: position?.longitude,
      severity: 'urgent',
    });
    await alerteMut.mutateAsync({
      company_id: companyId,
      type: 'pti_alerte',
      agent_id: user?.id,
      agent_name: agentName,
      site_id: currentService.site_id,
      site_name: currentService.site_name,
      client_name: currentService.client_name,
      message: `⚠️ ALERTE PTI - ${agentName} sur ${currentService.site_name} à ${now}`,
      latitude: position?.latitude,
      longitude: position?.longitude,
      date: today,
      time: now,
      severity: 'urgent',
    });
    qc.invalidateQueries({ queryKey: ['alertes'] });
  }, [currentService, companyId, user, agentName, today, position, mcCreateMut, alerteMut, qc]);

  const ptiMissedRef = useRef(false);
  const { timeLabel, overdue, resetTimer, secondsLeft, intervalMinutes } = usePtiTimer({
    active: !!currentService && droits.acces_pti,
    serviceId: currentService?.id,
    intervalMinutes: 30,
    onWarning: () => toast.warning('PTI : confirmez votre présence dans 1 minute'),
    onMissedDeadline: () => {
      if (ptiMissedRef.current) return;
      ptiMissedRef.current = true;
      triggerPtiAlerte('⚠️ ALERTE PTI automatique — absence de confirmation');
      toast.error('PTI : alerte automatique déclenchée');
    },
  });

  const handlePtiAlerte = async (reason) => {
    await triggerPtiAlerte(reason || `⚠️ ALERTE PTI manuelle à ${format(new Date(), 'HH:mm')}`);
    toast.error('Alerte PTI envoyée');
  };

  const { pending: fallPending, cancelLeft: fallCancelLeft, cancelFall, requestArm } = useFallDetection({
    active: !!currentService && droits.acces_pti,
    onFallConfirmed: () => {
      handlePtiAlerte('⚠️ ALERTE PTI — chute détectée (smartphone)');
    },
  });

  const agentSiteIds = siteIdSet;
  const mcFiltered = mainCouranteData.filter((mc) => agentSiteIds.includes(mc.site_id));
  const rondesFiltrees = rondes.filter((r) => agentSiteIds.includes(r.site_id));
  const checkpoints = rondesFiltrees.flatMap((r) => (r.checkpoints || []).map((cp) => ({
    ...cp,
    ronde_name: r.name,
    site_name: r.site_name,
    site_id: r.site_id,
  })));

  const newConsignes = consignes.filter((c) => {
    const lastSeen = lastSeenConsignes[c.id];
    if (!lastSeen) return true;
    return new Date(c.updated_date) > new Date(lastSeen);
  });

  const markConsignesRead = () => {
    const now = new Date().toISOString();
    const updated = { ...lastSeenConsignes };
    consignes.forEach((c) => { updated[c.id] = now; });
    setLastSeenConsignes(updated);
    localStorage.setItem('last_seen_consignes', JSON.stringify(updated));
  };

  const handleFinService = () => {
    if (!currentService) return;
    setShowFinService(true);
  };

  const handlePtiCheck = async () => {
    if (!currentService) return;
    const now = format(new Date(), 'HH:mm');
    ptiMissedRef.current = false;
    resetTimer();
    cancelFall();
    await mcCreateMut.mutateAsync({
      company_id: companyId, site_id: currentService.site_id, site_name: currentService.site_name,
      client_name: currentService.client_name, agent_id: user?.id, agent_name: agentName,
      date: today, time: now, type: 'pti_ok',
      mission_id: currentService.mission_id, service_id: currentService.id,
      content: `PTI - Confirmation de présence à ${now}`,
      latitude: position?.latitude, longitude: position?.longitude, severity: 'normal',
    });
    toast.success('Présence confirmée');
  };

  const startRonde = async (ronde) => {
    const now = format(new Date(), 'HH:mm');
    await alerteMut.mutateAsync({
      company_id: companyId, type: 'debut_ronde', agent_id: priseAgentId, agent_name: agentName,
      site_id: ronde.site_id, site_name: ronde.site_name,
      message: `${agentName} a démarré la ronde "${ronde.name}" sur ${ronde.site_name} à ${now}`,
      date: today, time: now, severity: 'info',
    });
    await mcCreateMut.mutateAsync({
      company_id: companyId,
      site_id: ronde.site_id,
      site_name: ronde.site_name,
      client_name: currentService?.client_name,
      agent_id: priseAgentId,
      agent_name: agentName,
      mission_id: currentService?.mission_id,
      service_id: currentService?.id,
      date: today,
      time: now,
      type: 'debut_ronde',
      event_type: 'debut_ronde',
      content: `Début de ronde « ${ronde.name} » à ${now} — ${agentName}`,
      severity: 'normal',
    });
    qc.invalidateQueries({ queryKey: ['alertes'] });
    qc.invalidateQueries({ queryKey: ['mc_service'] });
    setSelectedRonde(ronde);
    setShowRondeDialog(true);
  };

  const openPrise = (mission) => {
    const check = canStartPlannedService(mission);
    if (!check.ok) {
      toast.error(check.reason);
      return;
    }
    setSelectedMission(mission);
    setShowPriseForm(true);
  };

  const agentDocs = docs.filter((d) => d.target_type === 'tous' || (d.target_type === 'agent' && d.target_id === user?.id));
  const priseAgentId = agentFiche?.id || user?.id;

  return (
    <div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="sticky z-20 -mx-3 sm:-mx-4 xl:-mx-8 px-3 sm:px-4 xl:px-8 bg-background/95 backdrop-blur border-b mb-4 top-0 overflow-x-auto tabs-scroll">
          <TabsList className="flex w-max min-w-full h-12 bg-transparent p-0 rounded-none justify-start gap-0 flex-nowrap">
            {[
              { value: 'accueil', label: 'Accueil', show: true },
              { value: 'service', label: 'Service', show: droits.acces_services },
              { value: 'nonplanifie', label: 'Non planifié', show: droits.acces_service_non_planifie },
              { value: 'pti', label: 'DATI / PTI', show: droits.acces_pti },
              { value: 'planning', label: 'Planning', show: droits.acces_planning },
              { value: 'rondes', label: 'Rondes', show: droits.acces_rondes },
              { value: 'checkpoints', label: 'Contrôles', show: droits.acces_points_controle },
              { value: 'maincourante', label: 'Main courante', show: droits.acces_main_courante },
              { value: 'ecarts', label: 'Écarts', show: droits.acces_ecarts },
              { value: 'consignes', label: 'Consignes', show: droits.acces_consignes, badge: newConsignes.length },
              { value: 'carte', label: 'Carte pro', show: droits.acces_carte_pro },
              { value: 'contact', label: 'Agence', show: droits.acces_contact_societe },
              { value: 'documents', label: 'Documents', show: droits.acces_documents },
              { value: 'demandes', label: 'Demandes', show: droits.acces_conges },
            ].filter((t) => t.show).map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="relative shrink-0 rounded-none h-12 px-3.5 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground"
              >
                {t.label}
                {t.badge > 0 && (
                  <span className="ml-1 inline-flex w-4 h-4 bg-amber-500 text-white rounded-full text-[10px] items-center justify-center">{t.badge}</span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Bonjour {agentName || 'collaborateur'}</h1>
          <p className="text-muted-foreground mt-1 text-sm">Espace Agent</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {currentService && (
            <Badge className="gap-1 bg-green-600 text-white">
              <Clock className="w-3 h-3" />
              <ServiceChrono service={currentService} className="text-sm text-white" />
            </Badge>
          )}
          {newConsignes.length > 0 && droits.acces_consignes && (
            <Badge className="gap-1 bg-amber-500 text-white cursor-pointer" onClick={() => { setActiveTab('consignes'); markConsignesRead(); }}>
              <Bell className="w-3 h-3" /> {newConsignes.length} consigne(s)
            </Badge>
          )}
          {currentService && position && (
            <Badge className="gap-1 bg-green-500 text-white animate-pulse">
              <Navigation className="w-3 h-3" /> GPS actif
            </Badge>
          )}
          {outsideZone && (
            <Badge className="gap-1 bg-red-600 text-white">
              <MapPin className="w-3 h-3" /> Hors zone
            </Badge>
          )}
        </div>
      </div>

        <TabsContent value="accueil" className="space-y-4">
          {droits.acces_consignes && (
            <Card
              className={`p-4 cursor-pointer ${newConsignes.length > 0 ? 'border-amber-400 bg-amber-50' : 'border-border'}`}
              onClick={() => { setActiveTab('consignes'); markConsignesRead(); }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 font-semibold">
                  <BookOpen className="w-4 h-4" />
                  Cahier de consignes
                </div>
                {newConsignes.length > 0 ? (
                  <Badge className="bg-amber-500 text-white gap-1"><Bell className="w-3 h-3" />{newConsignes.length} nouvelle(s)</Badge>
                ) : (
                  <Badge variant="outline">{consignes.length} consigne(s)</Badge>
                )}
              </div>
              {newConsignes.length > 0 && (
                <div className="mt-2 space-y-1">
                  {newConsignes.slice(0, 3).map((c) => (
                    <p key={c.id} className="text-xs text-amber-800">• {c.title} — {c.site_name}</p>
                  ))}
                </div>
              )}
            </Card>
          )}

          {currentService && (
            <button type="button" className="w-full text-left" onClick={() => setActiveTab('service')}>
              <Card className="p-5 border-2 border-green-400 bg-green-50">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                      <span className="font-semibold text-green-700">En service — ouvrir le détail</span>
                    </div>
                    <p className="font-bold text-lg">{currentService.site_name}</p>
                    <p className="text-sm text-muted-foreground">Prise de service à {currentService.actual_start}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground mb-1">Temps écoulé</p>
                    <ServiceChrono service={currentService} className="text-green-800" />
                  </div>
                </div>
              </Card>
            </button>
          )}

          <div className="-mx-3 sm:-mx-4 xl:mx-0">
            <PlanningMapView
              compact
              missions={myMissions}
              prises={services}
              sites={sites}
              selected={planDay}
              onSelectDay={setPlanDay}
              currentService={currentService}
              onOpenMission={(m, meta) => {
                if (meta?.enCours) { setActiveTab('service'); return; }
                if (normalizeDateKey(m.date) === today && droits.acces_services && !currentService) openPrise(m);
                else if (droits.acces_planning) setActiveTab('planning');
              }}
            />
          </div>

          {currentService && droits.acces_pti && (
            <Card className="p-4 border-primary/30 cursor-pointer" onClick={() => setActiveTab('pti')}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold flex items-center gap-2"><Shield className="w-4 h-4" /> DATI / PTI actif</p>
                  <p className="text-xs text-muted-foreground">Confirmez votre présence toutes les {intervalMinutes} min</p>
                </div>
                <span className={`font-mono font-bold ${overdue ? 'text-red-600' : 'text-primary'}`}>{timeLabel}</span>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="service" className="space-y-4">
          {!droits.acces_services ? <AccessDenied label="Services" /> : (
            currentService ? (
              <ServiceEnCours
                service={currentService}
                mission={myMissions.find((m) => m.id === currentService.mission_id) || todayMissions[0]}
                rondes={rondesFiltrees}
                companyId={companyId}
                agentId={priseAgentId}
                agentName={agentName}
                onStartRonde={startRonde}
                onFinService={handleFinService}
              />
            ) : (
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">Vacations du jour</h2>
                {todayMissions.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Aucune vacation assignée aujourd'hui.</p>
                ) : (
                  <div className="space-y-3">
                    {todayMissions.map((m) => (
                      <div key={m.id} className="flex items-center justify-between p-4 border border-border rounded-xl">
                        <div>
                          <p className="font-medium">{m.title}</p>
                          <p className="text-sm text-muted-foreground">{m.site_name} • {m.start_time} - {m.end_time}</p>
                        </div>
                        <Button onClick={() => openPrise(m)} className="gap-2" disabled={!canStartPlannedService(m).ok}>
                          <Clock className="w-4 h-4" /> {canStartPlannedService(m).ok ? 'Prendre le service' : `Dès ${m.start_time}`}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )
          )}
        </TabsContent>

        <TabsContent value="nonplanifie">
          {!droits.acces_service_non_planifie ? <AccessDenied label="Service non planifié" /> : (
            currentService ? (
              <Card className="p-5">
                <p className="font-medium">Un service est déjà en cours.</p>
                <p className="text-sm text-muted-foreground mt-1">Terminez-le avant d’en commencer un autre.</p>
                <ServiceChrono service={currentService} className="mt-3" />
              </Card>
            ) : (
              <ServiceNonPlanifie sites={assignedSites.length ? assignedSites : sites} onStart={openPrise} />
            )
          )}
        </TabsContent>

        <TabsContent value="pti">
          {!droits.acces_pti ? <AccessDenied label="PTI" /> : (
            <PtiModernScreen
              active={!!currentService}
              timeLabel={timeLabel}
              secondsLeft={secondsLeft}
              intervalMinutes={intervalMinutes}
              overdue={overdue}
              siteName={currentService?.site_name}
              fallPending={fallPending}
              fallCancelLeft={fallCancelLeft}
              onOk={handlePtiCheck}
              onSos={() => handlePtiAlerte(`⚠️ ALERTE PTI SOS à ${format(new Date(), 'HH:mm')}`)}
              onCancelFall={cancelFall}
              onArmSensors={requestArm}
            />
          )}
        </TabsContent>

        <TabsContent value="planning">
          {!droits.acces_planning ? <AccessDenied label="Planning" /> : (
            <>
              <h2 className="text-lg font-semibold mb-4">Mes vacations actuelles et futures</h2>
              <div className="space-y-3">
                {futureMissions.map((m) => (
                  <MissionCard
                    key={m.id}
                    mission={m}
                    today={today}
                    trailing={droits.acces_services && normalizeDateKey(m.date) === today && !currentService ? (
                      <Button size="sm" onClick={() => openPrise(m)}>Pointer</Button>
                    ) : null}
                  />
                ))}
                {futureMissions.length === 0 && <p className="text-muted-foreground text-sm">Aucune vacation à venir.</p>}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="rondes" className="space-y-4">
          {!droits.acces_rondes ? <AccessDenied label="Rondes" /> : (
            <>
              <h2 className="text-lg font-semibold">Rondes de mes sites</h2>
              {rondesFiltrees.length === 0 && <p className="text-muted-foreground text-sm">Aucune ronde configurée sur vos sites.</p>}
              {rondesFiltrees.map((ronde) => (
                <Card key={ronde.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{ronde.name}</p>
                      <p className="text-sm text-muted-foreground">{ronde.site_name} • {(ronde.checkpoints || []).length} points</p>
                    </div>
                    <Button onClick={() => startRonde(ronde)} className="gap-2">
                      <MapPin className="w-4 h-4" /> Démarrer
                    </Button>
                  </div>
                </Card>
              ))}
            </>
          )}
        </TabsContent>

        <TabsContent value="checkpoints" className="space-y-4">
          {!droits.acces_points_controle ? <AccessDenied label="Points de contrôle" /> : (
            <>
              <h2 className="text-lg font-semibold">Points de contrôle de mes sites</h2>
              {checkpoints.length === 0 && <p className="text-muted-foreground text-sm">Aucun point de contrôle sur vos sites.</p>}
              {checkpoints.map((cp, i) => (
                <Card key={`${cp.id || cp.name}-${i}`} className="p-4">
                  <p className="font-medium">{cp.name}</p>
                  <p className="text-sm text-muted-foreground">{cp.site_name} • {cp.ronde_name}</p>
                  {cp.description && <p className="text-xs text-muted-foreground mt-1">{cp.description}</p>}
                </Card>
              ))}
            </>
          )}
        </TabsContent>

        <TabsContent value="maincourante" className="space-y-4">
          {!droits.acces_main_courante ? <AccessDenied label="Main courante" /> : (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Main courante de mes sites</h2>
                <Badge variant="outline">{mcFiltered.length} entrées</Badge>
              </div>
              {mcFiltered.length === 0 ? (
                <p className="text-muted-foreground text-sm">Aucune entrée pour vos sites.</p>
              ) : (
                <div className="space-y-3">
                  {mcFiltered.slice(0, 50).map((entry) => (
                    <Card key={entry.id} className={`p-3 ${entry.severity === 'urgent' ? 'border-l-4 border-l-red-500' : entry.severity === 'attention' ? 'border-l-4 border-l-amber-400' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Badge variant="outline" className="text-xs">{entry.type}</Badge>
                            <span className="text-xs text-muted-foreground">{entry.site_name}</span>
                            {entry.agent_name && <span className="text-xs text-muted-foreground">• {entry.agent_name}</span>}
                          </div>
                          <p className="text-sm">{entry.content}</p>
                          <p className="text-xs text-muted-foreground mt-1">{entry.date} {entry.time && `à ${entry.time}`}</p>
                        </div>
                        {entry.severity === 'urgent' && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="ecarts" className="space-y-4">
          {!droits.acces_ecarts ? <AccessDenied label="Écarts horaires" /> : (
            <>
              <h2 className="text-lg font-semibold">Mes services récents</h2>
              {ecarts.length === 0 ? (
                <p className="text-muted-foreground text-sm">Aucun service enregistré.</p>
              ) : (
                <div className="space-y-3">
                  {ecarts.slice(0, 20).map((s) => {
                    const mission = missions.find((m) => m.id === s.mission_id);
                    const ecartMin = mission && s.actual_start && s.actual_end
                      ? Math.round((new Date(`2000-01-01T${s.actual_end}`) - new Date(`2000-01-01T${s.actual_start}`)) / 60000)
                        - Math.round((new Date(`2000-01-01T${mission.end_time}`) - new Date(`2000-01-01T${mission.start_time}`)) / 60000)
                      : null;
                    return (
                      <Card key={s.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{s.site_name}</p>
                            <p className="text-xs text-muted-foreground">{s.date} • {s.actual_start} - {s.actual_end || '…'}</p>
                          </div>
                          {ecartMin !== null && (
                            <Badge className={ecartMin > 5 ? 'bg-red-100 text-red-700' : ecartMin < -5 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}>
                              {ecartMin > 0 ? `+${ecartMin}` : ecartMin} min
                            </Badge>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="consignes" className="space-y-4">
          {!droits.acces_consignes ? <AccessDenied label="Consignes" /> : (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2"><BookOpen className="w-5 h-5" />Cahier de consignes</h2>
                {newConsignes.length > 0 && (
                  <Badge className="bg-amber-500 text-white gap-1"><Bell className="w-3 h-3" />{newConsignes.length} nouveau(x)</Badge>
                )}
              </div>
              {consignes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune consigne sur vos sites.</p>
              ) : (
                consignes.map((c) => {
                  const cat = CATEGORY_CONFIG[c.category] || CATEGORY_CONFIG.general;
                  const isNew = newConsignes.some((n) => n.id === c.id);
                  return (
                    <Card
                      key={c.id}
                      className={`p-4 cursor-pointer hover:shadow-md transition-shadow ${c.priority === 'critique' ? 'border-l-4 border-l-red-500' : c.priority === 'importante' ? 'border-l-4 border-l-amber-400' : ''} ${isNew ? 'bg-amber-50/50' : ''}`}
                      onClick={() => { setSelectedConsigne(c); markConsignesRead(); }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-semibold text-sm">{c.title}</p>
                        <div className="flex items-center gap-2">
                          {isNew && <Badge className="bg-amber-500 text-white text-xs">Nouveau</Badge>}
                          <Badge className={`text-xs ${cat.color}`}>{cat.label}</Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">{c.site_name}</p>
                      <p className="text-sm line-clamp-2 text-muted-foreground">{c.content}</p>
                    </Card>
                  );
                })
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="carte">
          {!droits.acces_carte_pro ? <AccessDenied label="Carte professionnelle" /> : (
            <Card className="p-6 max-w-lg mx-auto border-2">
              <div className="flex items-center gap-4 mb-6">
                {companySettings.logo_url ? (
                  <img src={companySettings.logo_url} alt="" className="w-16 h-16 object-contain rounded-xl bg-white border p-1" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center"><Building2 className="w-7 h-7 text-primary" /></div>
                )}
                <div>
                  <p className="font-bold leading-tight">{companySettings.company_name || 'Société de sécurité'}</p>
                  {companySettings.cnaps_number && <p className="text-xs text-muted-foreground">CNAPS {companySettings.cnaps_number}</p>}
                </div>
              </div>
              <div className="flex items-center gap-4 mb-4">
                {agentFiche?.photo_url ? (
                  <img src={agentFiche.photo_url} alt="" className="w-20 h-20 rounded-full object-cover border" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center text-xl font-bold">
                    {(agentFiche?.first_name?.[0] || agentName?.[0] || 'A').toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-lg font-bold">{agentFiche ? `${agentFiche.last_name || ''} ${agentFiche.first_name || ''}`.trim() : agentName}</p>
                  <p className="text-sm text-muted-foreground">{agentFiche?.fonction || 'Agent de sécurité'}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <p className="flex items-center gap-2"><CreditCard className="w-4 h-4" /> Carte pro : <strong>{agentFiche?.card_number || '—'}</strong></p>
                <p>Validité : <strong>{agentFiche?.card_expiry || '—'}</strong></p>
                {companySettings.address && <p className="text-muted-foreground">{companySettings.address} {companySettings.postal_code} {companySettings.city}</p>}
                {companySettings.phone && <p className="flex items-center gap-2"><Phone className="w-4 h-4" />{companySettings.phone}</p>}
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="contact">
          {!droits.acces_contact_societe ? <AccessDenied label="Contact société" /> : (
            <Card className="p-6 space-y-3">
              <h2 className="text-lg font-semibold">Contacter mon agence</h2>
              <p className="font-bold">{companySettings.company_name || 'Société de sécurité'}</p>
              {companySettings.address && (
                <p className="text-sm text-muted-foreground flex items-start gap-2">
                  <MapPin className="w-4 h-4 mt-0.5" />
                  {companySettings.address}{companySettings.postal_code ? `, ${companySettings.postal_code}` : ''} {companySettings.city || ''}
                </p>
              )}
              {companySettings.phone && (
                <a href={`tel:${companySettings.phone}`} className="flex items-center gap-2 text-primary font-medium">
                  <Phone className="w-4 h-4" /> {companySettings.phone}
                </a>
              )}
              {companySettings.email && (
                <a href={`mailto:${companySettings.email}`} className="flex items-center gap-2 text-primary font-medium">
                  <Mail className="w-4 h-4" /> {companySettings.email}
                </a>
              )}
              {companySettings.website && <p className="text-sm text-muted-foreground">{companySettings.website}</p>}
            </Card>
          )}
        </TabsContent>

        <TabsContent value="documents">
          {!droits.acces_documents ? <AccessDenied label="Documents" /> : (
            <>
              <h2 className="text-lg font-semibold mb-4">Mes documents</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {agentDocs.map((doc) => (
                  <Card key={doc.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">{doc.type} • {doc.date}</p>
                      </div>
                      {doc.file_url && (
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" className="gap-2"><Download className="w-3.5 h-3.5" />Ouvrir</Button>
                        </a>
                      )}
                    </div>
                  </Card>
                ))}
                {fiches.map((fiche) => (
                  <Card key={fiche.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm">Fiche de paie - {fiche.period}</p>
                        {fiche.net_amount && <p className="text-xs text-muted-foreground">Net : {fiche.net_amount.toLocaleString('fr-FR')} €</p>}
                      </div>
                      {fiche.file_url && (
                        <a href={fiche.file_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" className="gap-2"><Download className="w-3.5 h-3.5" />PDF</Button>
                        </a>
                      )}
                    </div>
                  </Card>
                ))}
                {agentDocs.length === 0 && fiches.length === 0 && <p className="text-muted-foreground text-sm col-span-2">Aucun document disponible.</p>}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="demandes">
          {!droits.acces_conges ? <AccessDenied label="Demandes à la société" /> : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Mes demandes à la société</h2>
                <Button size="sm" onClick={() => setShowDemandeForm(true)}>+ Nouvelle demande</Button>
              </div>
              <div className="space-y-3">
                {demandes.map((d) => (
                  <Card key={d.id} className="p-4">
                    <p className="font-medium text-sm">{d.subject}</p>
                    <p className="text-xs text-muted-foreground mt-1">{d.message?.slice(0, 100)}</p>
                    {d.response && (
                      <div className="mt-2 p-2 rounded bg-primary/5 border border-primary/20">
                        <p className="text-xs font-semibold text-primary">Réponse :</p>
                        <p className="text-xs mt-1">{d.response}</p>
                      </div>
                    )}
                    <Badge variant="outline" className="text-xs mt-2">{d.status}</Badge>
                  </Card>
                ))}
                {demandes.length === 0 && <p className="text-muted-foreground text-sm">Aucune demande.</p>}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showDemandeForm} onOpenChange={setShowDemandeForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Demande à la société</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Objet</Label>
              <Input value={demandeForm.subject} onChange={(e) => setDemandeForm((f) => ({ ...f, subject: e.target.value }))} placeholder="Congé, matériel, information…" />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea rows={4} value={demandeForm.message} onChange={(e) => setDemandeForm((f) => ({ ...f, message: e.target.value }))} />
            </div>
            <Button
              className="w-full"
              disabled={!demandeForm.subject.trim() || !demandeForm.message.trim() || demandeMut.isPending}
              onClick={() => demandeMut.mutate({
                company_id: companyId,
                from_type: 'agent',
                from_id: priseAgentId,
                from_name: agentName,
                subject: demandeForm.subject.trim(),
                message: demandeForm.message.trim(),
                priority: 'normale',
                status: 'nouvelle',
              })}
            >
              Envoyer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <PtiCheckOverlay
        open={!!currentService && droits.acces_pti && !showPriseForm && !showFinService && (secondsLeft <= 60 || overdue || fallPending)}
        timeLabel={timeLabel}
        overdue={overdue}
        fallPending={fallPending}
        fallCancelLeft={fallCancelLeft}
        onOk={handlePtiCheck}
        onSos={() => handlePtiAlerte(`⚠️ ALERTE PTI SOS à ${format(new Date(), 'HH:mm')}`)}
        onCancelFall={cancelFall}
      />

      <Dialog open={showPriseForm && !!selectedMission} onOpenChange={() => { setShowPriseForm(false); setSelectedMission(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Prise de service</DialogTitle>
            <p className="text-sm text-muted-foreground">{selectedMission?.site_name}</p>
          </DialogHeader>
          {selectedMission && (
            <PriseDeServiceNFC
              mission={selectedMission}
              companyId={companyId}
              agentId={priseAgentId}
              agentName={agentName}
              onSuccess={() => { setShowPriseForm(false); setSelectedMission(null); qc.invalidateQueries({ queryKey: ['prises_service'] }); }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showFinService && !!currentService} onOpenChange={(open) => { if (!open) setShowFinService(false); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Terminer le service</DialogTitle></DialogHeader>
          {currentService && (
            <FinDeServicePhoto
              service={currentService}
              companyId={companyId}
              agentId={priseAgentId}
              agentName={agentName}
              onSuccess={() => {
                setShowFinService(false);
                qc.invalidateQueries({ queryKey: ['prises_service'] });
                qc.invalidateQueries({ queryKey: ['alertes'] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showRondeDialog && !!selectedRonde} onOpenChange={() => { setShowRondeDialog(false); setSelectedRonde(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Ronde en cours</DialogTitle></DialogHeader>
          {selectedRonde && (
            <RondeNFC
              ronde={selectedRonde}
              currentService={currentService}
              companyId={companyId}
              agentId={priseAgentId}
              agentName={agentName}
              onFinish={() => {
                setShowRondeDialog(false);
                setSelectedRonde(null);
                qc.invalidateQueries({ queryKey: ['ronde_execs'] });
                qc.invalidateQueries({ queryKey: ['mc_service'] });
                qc.invalidateQueries({ queryKey: ['main_courante'] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedConsigne} onOpenChange={() => setSelectedConsigne(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedConsigne?.title}</DialogTitle>
            <p className="text-sm text-muted-foreground">{selectedConsigne?.site_name}</p>
          </DialogHeader>
          {selectedConsigne && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Badge className={CATEGORY_CONFIG[selectedConsigne.category]?.color}>{CATEGORY_CONFIG[selectedConsigne.category]?.label}</Badge>
                {selectedConsigne.priority !== 'normale' && (
                  <Badge className={selectedConsigne.priority === 'critique' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}>
                    {selectedConsigne.priority === 'critique' ? 'Critique' : 'Importante'}
                  </Badge>
                )}
              </div>
              <div className="p-4 bg-muted/30 rounded-xl">
                <p className="text-sm whitespace-pre-wrap">{selectedConsigne.content}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Dernière mise à jour : {selectedConsigne.updated_date && format(new Date(selectedConsigne.updated_date), 'dd/MM/yyyy à HH:mm', { locale: fr })}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
