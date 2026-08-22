import React, { useState, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Clock, AlertTriangle, CheckCircle2, Download, MapPin, Navigation, BookOpen, Bell, Calendar, Lock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useCompany } from '@/lib/useCompany';
import { useGeolocation } from '@/lib/useGeolocation';
import { usePtiTimer } from '@/lib/usePtiTimer';
import { toast } from 'sonner';
import PriseDeServiceNFC from '@/components/agent/PriseDeServiceNFC';
import RondeNFC from '@/components/agent/RondeNFC';

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

export default function EspaceAgent() {
  const [activeTab, setActiveTab] = useState('accueil');
  const [showPriseForm, setShowPriseForm] = useState(false);
  const [selectedMission, setSelectedMission] = useState(null);
  const [showRondeDialog, setShowRondeDialog] = useState(false);
  const [selectedRonde, setSelectedRonde] = useState(null);
  const [selectedConsigne, setSelectedConsigne] = useState(null);
  const [lastSeenConsignes, setLastSeenConsignes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('last_seen_consignes') || '{}'); } catch { return {}; }
  });
  const { user, companyId } = useCompany();
  const qc = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');

  // Charger la fiche agent pour récupérer ses droits
  const { data: agentFiche } = useQuery({
    queryKey: ['ma_fiche_agent', user?.email, companyId],
    queryFn: async () => {
      const agents = await base44.entities.Agent.filter({ company_id: companyId });
      return agents.find(a => a.email === user?.email) || null;
    },
    enabled: !!companyId && !!user,
  });

  // Droits portail de l'agent (avec défauts permissifs si pas de fiche)
  const droits = agentFiche?.droits_portail || {
    acces_planning: true, acces_services: true, acces_ecarts: false,
    acces_rondes: true, acces_main_courante: false, acces_pti: true,
    acces_conges: true, acces_documents: true, acces_consignes: true,
  };

  const { data: missions = [] } = useQuery({ queryKey: ['missions', companyId], queryFn: () => base44.entities.Mission.filter({ company_id: companyId }, '-date', 50), enabled: !!companyId });
  const { data: services = [] } = useQuery({ queryKey: ['prises_service', companyId], queryFn: () => base44.entities.PriseDeService.filter({ company_id: companyId }, '-date', 30), enabled: !!companyId });
  const { data: rondes = [] } = useQuery({
    queryKey: ['rondes_agent', agentFiche?.id],
    queryFn: () => base44.entities.Ronde.filter({ company_id: companyId }),
    enabled: !!companyId && droits.acces_rondes,
  });
  const { data: mainCouranteData = [] } = useQuery({
    queryKey: ['mc_agent', companyId],
    queryFn: () => base44.entities.MainCourante.filter({ company_id: companyId }, '-date', 100),
    enabled: !!companyId && droits.acces_main_courante,
  });
  const { data: ecarts = [] } = useQuery({
    queryKey: ['ecarts_agent', user?.email, companyId],
    queryFn: () => base44.entities.PriseDeService.filter({ company_id: companyId }, '-date', 50),
    enabled: !!companyId && droits.acces_ecarts,
  });
  const { data: fiches = [] } = useQuery({
    queryKey: ['fiches_paie', companyId],
    queryFn: () => base44.entities.FicheDePaie.filter({ company_id: companyId }, '-year', 24),
    enabled: !!companyId && droits.acces_documents,
  });
  const { data: demandes = [] } = useQuery({
    queryKey: ['mes_demandes'],
    queryFn: () => base44.entities.Demande.filter({ from_type: 'agent', company_id: companyId }, '-created_date', 20),
    enabled: !!companyId && droits.acces_conges,
  });
  const { data: docs = [] } = useQuery({
    queryKey: ['mes_docs'],
    queryFn: () => base44.entities.Document.filter({ company_id: companyId }, '-created_date', 50),
    enabled: !!companyId && droits.acces_documents,
  });
  const { data: consignes = [] } = useQuery({
    queryKey: ['cahier_consignes', companyId],
    queryFn: () => base44.entities.CahierConsignes.filter({ company_id: companyId, active: true }, '-updated_date', 100),
    enabled: !!companyId && droits.acces_consignes,
  });

  const serviceUpdateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PriseDeService.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prises_service'] }),
  });
  const mcCreateMut = useMutation({ mutationFn: (data) => base44.entities.MainCourante.create(data) });
  const alerteMut = useMutation({ mutationFn: (data) => base44.entities.Alerte.create(data) });
  const demandeMut = useMutation({
    mutationFn: (data) => base44.entities.Demande.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mes_demandes'] }),
  });

  const todayMissions = missions.filter(m => m.date === today);
  const futureMissions = missions.filter(m => m.date >= today).slice(0, 15);
  const currentService = services.find(s => s.date === today && s.status === 'en_service');

  const { data: currentSite } = useQuery({
    queryKey: ['site_geofence', currentService?.site_id],
    queryFn: () => base44.entities.Site.get(currentService.site_id),
    enabled: !!currentService?.site_id,
  });

  const agentName = user ? (user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim()) : '';
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
    intervalMinutes: 15,
    onWarning: () => toast.warning('PTI : confirmez votre présence dans 1 minute'),
    onMissedDeadline: () => {
      if (ptiMissedRef.current) return;
      ptiMissedRef.current = true;
      triggerPtiAlerte('⚠️ ALERTE PTI automatique — absence de confirmation');
      toast.error('PTI : alerte automatique déclenchée');
    },
  });

  // Main courante filtrée sur les sites de l'agent
  const agentSiteIds = [...new Set(missions.map(m => m.site_id).filter(Boolean))];
  const mcFiltered = mainCouranteData.filter(mc => agentSiteIds.includes(mc.site_id));

  // Rondes filtrées sur les sites de l'agent
  const rondesFiltrees = rondes.filter(r => agentSiteIds.includes(r.site_id));

  const newConsignes = consignes.filter(c => {
    const lastSeen = lastSeenConsignes[c.id];
    if (!lastSeen) return true;
    return new Date(c.updated_date) > new Date(lastSeen);
  });

  const markConsignesRead = () => {
    const now = new Date().toISOString();
    const updated = { ...lastSeenConsignes };
    consignes.forEach(c => { updated[c.id] = now; });
    setLastSeenConsignes(updated);
    localStorage.setItem('last_seen_consignes', JSON.stringify(updated));
  };

  const handleFinService = async () => {
    if (!currentService) return;
    const now = format(new Date(), 'HH:mm');
    await serviceUpdateMut.mutateAsync({
      id: currentService.id,
      data: { actual_end: now, status: 'termine', end_latitude: position?.latitude, end_longitude: position?.longitude }
    });
    await mcCreateMut.mutateAsync({
      company_id: companyId, site_id: currentService.site_id, site_name: currentService.site_name,
      client_name: currentService.client_name, agent_id: user?.id, agent_name: agentName,
      date: today, time: now, type: 'depart',
      content: `Fin de service - ${agentName} a quitté le site à ${now}`,
      latitude: position?.latitude, longitude: position?.longitude, severity: 'normal',
    });
    await alerteMut.mutateAsync({
      company_id: companyId, type: 'fin_service', agent_id: user?.id, agent_name: agentName,
      site_id: currentService.site_id, site_name: currentService.site_name, client_name: currentService.client_name,
      message: `${agentName} a terminé son service sur ${currentService.site_name} à ${now}`,
      latitude: position?.latitude, longitude: position?.longitude, date: today, time: now, severity: 'info',
    });
    qc.invalidateQueries({ queryKey: ['alertes'] });
  };

  const handlePtiCheck = async () => {
    if (!currentService) return;
    const now = format(new Date(), 'HH:mm');
    ptiMissedRef.current = false;
    resetTimer();
    await mcCreateMut.mutateAsync({
      company_id: companyId, site_id: currentService.site_id, site_name: currentService.site_name,
      client_name: currentService.client_name, agent_id: user?.id, agent_name: agentName,
      date: today, time: now, type: 'pti_ok',
      content: `PTI - Confirmation de présence à ${now}`,
      latitude: position?.latitude, longitude: position?.longitude, severity: 'normal',
    });
    toast.success('Présence confirmée');
  };

  const handlePtiAlerte = async () => {
    await triggerPtiAlerte(`⚠️ ALERTE PTI manuelle à ${format(new Date(), 'HH:mm')}`);
    toast.error('Alerte PTI envoyée');
  };

  const startRonde = async (ronde) => {
    const now = format(new Date(), 'HH:mm');
    await alerteMut.mutateAsync({
      company_id: companyId, type: 'debut_ronde', agent_id: user?.id, agent_name: agentName,
      site_id: ronde.site_id, site_name: ronde.site_name,
      message: `${agentName} a démarré la ronde "${ronde.name}" sur ${ronde.site_name} à ${now}`,
      date: today, time: now, severity: 'info',
    });
    qc.invalidateQueries({ queryKey: ['alertes'] });
    setSelectedRonde(ronde);
    setShowRondeDialog(true);
  };

  const agentDocs = docs.filter(d => d.target_type === 'tous' || (d.target_type === 'agent' && d.target_id === user?.id));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Espace Agent</h1>
          <p className="text-muted-foreground mt-1">Bonjour {agentName || 'Agent'} 👋</p>
        </div>
        <div className="flex items-center gap-2">
          {newConsignes.length > 0 && droits.acces_consignes && (
            <Badge className="gap-1 bg-amber-500 text-white cursor-pointer" onClick={() => { setActiveTab('consignes'); markConsignesRead(); }}>
              <Bell className="w-3 h-3" /> {newConsignes.length} mise(s) à jour
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="accueil">Accueil</TabsTrigger>
          {droits.acces_services && <TabsTrigger value="service">Service</TabsTrigger>}
          {droits.acces_pti && <TabsTrigger value="pti">PTI</TabsTrigger>}
          {droits.acces_planning && <TabsTrigger value="planning">Planning</TabsTrigger>}
          {droits.acces_rondes && <TabsTrigger value="rondes">Rondes</TabsTrigger>}
          {droits.acces_main_courante && <TabsTrigger value="maincourante">Main courante</TabsTrigger>}
          {droits.acces_ecarts && <TabsTrigger value="ecarts">Écarts</TabsTrigger>}
          {droits.acces_consignes && (
            <TabsTrigger value="consignes" className="relative">
              Consignes
              {newConsignes.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white rounded-full text-[10px] flex items-center justify-center">{newConsignes.length}</span>
              )}
            </TabsTrigger>
          )}
          {droits.acces_documents && <TabsTrigger value="documents">Documents</TabsTrigger>}
          {droits.acces_conges && <TabsTrigger value="demandes">Demandes</TabsTrigger>}
        </TabsList>

        {/* ===== ACCUEIL ===== */}
        <TabsContent value="accueil" className="space-y-4">
          {currentService ? (
            <Card className="p-5 border-2 border-green-400 bg-green-50">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                <span className="font-semibold text-green-700">En service</span>
              </div>
              <p className="font-bold text-lg">{currentService.site_name}</p>
              <p className="text-sm text-muted-foreground">Depuis {currentService.actual_start}</p>
              {droits.acces_services && <Button variant="destructive" size="sm" className="mt-3" onClick={handleFinService}>Terminer le service</Button>}
            </Card>
          ) : (
            <Card className="p-5">
              <h2 className="font-semibold mb-3">Missions du jour</h2>
              {todayMissions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune mission assignée aujourd'hui.</p>
              ) : (
                <div className="space-y-2">
                  {todayMissions.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-3 border border-border rounded-xl">
                      <div>
                        <p className="font-medium text-sm">{m.title}</p>
                        <p className="text-xs text-muted-foreground">{m.site_name} • {m.start_time} - {m.end_time}</p>
                      </div>
                      {droits.acces_services && (
                        <Button size="sm" onClick={() => { setSelectedMission(m); setShowPriseForm(true); }} className="gap-1.5">
                          <Clock className="w-3.5 h-3.5" /> Prendre le service
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {newConsignes.length > 0 && droits.acces_consignes && (
            <Card className="p-4 border-amber-300 bg-amber-50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-amber-700 font-semibold">
                  <Bell className="w-4 h-4" />
                  {newConsignes.length} consigne(s) mise(s) à jour
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setActiveTab('consignes'); markConsignesRead(); }} className="text-amber-700 text-xs">Voir →</Button>
              </div>
              <div className="space-y-1">
                {newConsignes.slice(0, 3).map(c => (
                  <p key={c.id} className="text-xs text-amber-700">• {c.title} — {c.site_name}</p>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-5">
            <h2 className="font-semibold mb-3 flex items-center gap-2"><Calendar className="w-4 h-4" />Prochaines vacations</h2>
            {futureMissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune vacation à venir.</p>
            ) : (
              <div className="space-y-2">
                {futureMissions.slice(0, 5).map(m => (
                  <div key={m.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                    <div className="text-center w-10 shrink-0">
                      <p className="text-base font-bold text-primary">{format(new Date(m.date), 'd', { locale: fr })}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">{format(new Date(m.date), 'MMM', { locale: fr })}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.title}</p>
                      <p className="text-xs text-muted-foreground">{m.site_name} • {m.start_time}-{m.end_time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ===== SERVICE ===== */}
        <TabsContent value="service" className="space-y-4">
          {!droits.acces_services ? <AccessDenied label="Services" /> : (
            currentService ? (
              <Card className="p-6 border-2 border-primary/40 bg-primary/5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                  <h2 className="text-lg font-semibold text-green-600">En service actuellement</h2>
                </div>
                <p className="font-bold text-xl">{currentService.site_name}</p>
                <p className="text-muted-foreground">{currentService.client_name}</p>
                <div className="mt-3 space-y-1 text-sm">
                  <p>Arrivée : <strong>{currentService.actual_start}</strong></p>
                  <p>Fin prévue : <strong>{currentService.planned_end}</strong></p>
                  {position && <p className="flex items-center gap-1 text-xs text-muted-foreground mt-2"><Navigation className="w-3 h-3 text-green-500" /> GPS actif</p>}
                </div>
                {currentService.start_photo_url && <img src={currentService.start_photo_url} alt="Photo service" className="mt-3 w-24 h-24 rounded-xl object-cover border" />}
                <Button variant="destructive" className="mt-4" onClick={handleFinService}>Terminer le service</Button>
              </Card>
            ) : (
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">Missions du jour</h2>
                {todayMissions.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Aucune mission assignée aujourd'hui.</p>
                ) : (
                  <div className="space-y-3">
                    {todayMissions.map(m => (
                      <div key={m.id} className="flex items-center justify-between p-4 border border-border rounded-xl">
                        <div>
                          <p className="font-medium">{m.title}</p>
                          <p className="text-sm text-muted-foreground">{m.site_name} • {m.start_time} - {m.end_time}</p>
                        </div>
                        <Button onClick={() => { setSelectedMission(m); setShowPriseForm(true); }} className="gap-2">
                          <Clock className="w-4 h-4" /> Prendre le service
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )
          )}
        </TabsContent>

        {/* ===== PTI ===== */}
        <TabsContent value="pti">
          {!droits.acces_pti ? <AccessDenied label="PTI" /> : (
            <Card className={`p-8 text-center border-2 ${overdue ? 'border-red-500 bg-red-50' : 'border-border'}`}>
              <Shield className={`w-16 h-16 mx-auto mb-4 ${overdue ? 'text-red-600' : 'text-muted-foreground'}`} />
              <h2 className="text-xl font-bold mb-2">Protection Travailleur Isolé</h2>
              <p className="text-muted-foreground mb-4 text-sm">
                Confirmez votre présence toutes les {intervalMinutes} minutes
              </p>
              {!currentService ? (
                <p className="text-amber-600 font-medium p-3 bg-amber-50 rounded-xl">Prenez votre service pour activer le PTI</p>
              ) : (
                <>
                  <div className={`text-5xl font-mono font-bold mb-2 ${overdue ? 'text-red-600 animate-pulse' : secondsLeft <= 60 ? 'text-amber-600' : 'text-primary'}`}>
                    {timeLabel}
                  </div>
                  <p className="text-xs text-muted-foreground mb-6">
                    {overdue ? 'Délai dépassé — alerte envoyée' : 'Temps restant avant confirmation obligatoire'}
                  </p>
                  <div className="flex gap-4 justify-center flex-wrap">
                    <Button size="lg" className="gap-2 bg-green-600 hover:bg-green-700 min-w-36" onClick={handlePtiCheck}>
                      <CheckCircle2 className="w-5 h-5" /> Je suis OK
                    </Button>
                    <Button size="lg" variant="destructive" className="gap-2 min-w-36" onClick={handlePtiAlerte}>
                      <AlertTriangle className="w-5 h-5" /> ALERTE PTI
                    </Button>
                  </div>
                </>
              )}
            </Card>
          )}
        </TabsContent>

        {/* ===== PLANNING ===== */}
        <TabsContent value="planning">
          {!droits.acces_planning ? <AccessDenied label="Planning" /> : (
            <>
              <h2 className="text-lg font-semibold mb-4">Mes prochaines vacations</h2>
              <div className="space-y-3">
                {futureMissions.map(m => (
                  <Card key={m.id} className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="text-center w-12 shrink-0">
                        <p className="text-lg font-bold text-primary">{format(new Date(m.date), 'd', { locale: fr })}</p>
                        <p className="text-xs text-muted-foreground uppercase">{format(new Date(m.date), 'MMM', { locale: fr })}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{m.title}</p>
                        <p className="text-sm text-muted-foreground">{m.site_name} • {m.start_time} - {m.end_time}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0">{m.date === today ? 'Aujourd\'hui' : format(new Date(m.date), 'EEE', { locale: fr })}</Badge>
                    </div>
                  </Card>
                ))}
                {futureMissions.length === 0 && <p className="text-muted-foreground text-sm">Aucune vacation à venir.</p>}
              </div>
            </>
          )}
        </TabsContent>

        {/* ===== RONDES ===== */}
        <TabsContent value="rondes" className="space-y-4">
          {!droits.acces_rondes ? <AccessDenied label="Rondes" /> : (
            <>
              <h2 className="text-lg font-semibold">Rondes de mes sites</h2>
              {rondesFiltrees.length === 0 && <p className="text-muted-foreground text-sm">Aucune ronde configurée sur vos sites.</p>}
              {rondesFiltrees.map(ronde => (
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

        {/* ===== MAIN COURANTE ===== */}
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
                  {mcFiltered.slice(0, 50).map(entry => (
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

        {/* ===== ÉCARTS HORAIRES ===== */}
        <TabsContent value="ecarts" className="space-y-4">
          {!droits.acces_ecarts ? <AccessDenied label="Écarts horaires" /> : (
            <>
              <h2 className="text-lg font-semibold">Mes services récents</h2>
              {ecarts.length === 0 ? (
                <p className="text-muted-foreground text-sm">Aucun service enregistré.</p>
              ) : (
                <div className="space-y-3">
                  {ecarts.slice(0, 20).map(s => {
                    const mission = missions.find(m => m.id === s.mission_id);
                    const ecartMin = mission && s.actual_start && s.actual_end
                      ? Math.round((new Date(`2000-01-01T${s.actual_end}`) - new Date(`2000-01-01T${s.actual_start}`)) / 60000) -
                        Math.round((new Date(`2000-01-01T${mission.end_time}`) - new Date(`2000-01-01T${mission.start_time}`)) / 60000)
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

        {/* ===== CONSIGNES ===== */}
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
                <p className="text-sm text-muted-foreground">Aucune consigne disponible.</p>
              ) : (
                consignes.map(c => {
                  const cat = CATEGORY_CONFIG[c.category] || CATEGORY_CONFIG.general;
                  const isNew = newConsignes.some(n => n.id === c.id);
                  return (
                    <Card
                      key={c.id}
                      className={`p-4 cursor-pointer hover:shadow-md transition-shadow ${c.priority === 'critique' ? 'border-l-4 border-l-red-500' : c.priority === 'importante' ? 'border-l-4 border-l-amber-400' : ''} ${isNew ? 'bg-amber-50/50' : ''}`}
                      onClick={() => setSelectedConsigne(c)}
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

        {/* ===== DOCUMENTS ===== */}
        <TabsContent value="documents">
          {!droits.acces_documents ? <AccessDenied label="Documents" /> : (
            <>
              <h2 className="text-lg font-semibold mb-4">Mes documents</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {agentDocs.map(doc => (
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
                {fiches.map(fiche => (
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

        {/* ===== DEMANDES ===== */}
        <TabsContent value="demandes">
          {!droits.acces_conges ? <AccessDenied label="Demandes / Congés" /> : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Mes demandes</h2>
                <Button size="sm" onClick={() => demandeMut.mutate({
                  company_id: companyId, from_type: 'agent', from_id: user?.id, from_name: agentName,
                  subject: 'Nouvelle demande', message: '', priority: 'normale', status: 'nouvelle',
                })}>+ Nouvelle demande</Button>
              </div>
              <div className="space-y-3">
                {demandes.map(d => (
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

      {/* Prise de service dialog */}
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
              agentId={user?.id}
              agentName={agentName}
              onSuccess={() => { setShowPriseForm(false); setSelectedMission(null); qc.invalidateQueries({ queryKey: ['prises_service'] }); }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Ronde dialog */}
      <Dialog open={showRondeDialog && !!selectedRonde} onOpenChange={() => { setShowRondeDialog(false); setSelectedRonde(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Ronde en cours</DialogTitle></DialogHeader>
          {selectedRonde && (
            <RondeNFC
              ronde={selectedRonde}
              currentService={currentService}
              companyId={companyId}
              agentId={user?.id}
              agentName={agentName}
              onFinish={() => { setShowRondeDialog(false); setSelectedRonde(null); }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Consigne detail dialog */}
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