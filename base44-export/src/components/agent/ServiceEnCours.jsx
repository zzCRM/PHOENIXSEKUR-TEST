import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, Coffee, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import ServiceChrono from '@/components/agent/ServiceChrono';

const EVENT_ICON = {
  debut_service: '🛡️',
  debut_service_retard: '🛡️',
  arrivee: '🛡️',
  debut_ronde: '📍',
  fin_ronde: '🏁',
  ronde: '📍',
  debut_pause: '☕',
  fin_pause: '☕',
  prolongation_service: '⏱️',
  depart: '🏁',
  fin_service: '🏁',
};

function PauseChrono({ startedAt }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const start = startedAt ? new Date(startedAt) : null;
  if (!start || Number.isNaN(start.getTime())) return null;
  const total = Math.max(0, Math.floor((now - start.getTime()) / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return <span className="font-mono font-bold tabular-nums">{h}:{m}:{s}</span>;
}

export default function ServiceEnCours({
  service,
  mission,
  rondes = [],
  companyId,
  agentId,
  agentName,
  onStartRonde,
  onFinService,
}) {
  const qc = useQueryClient();
  const [showRondeDetail, setShowRondeDetail] = useState(false);
  const today = format(new Date(), 'yyyy-MM-dd');
  const onPause = !!service.pause_started_at;

  const { data: mc = [] } = useQuery({
    queryKey: ['mc_service', companyId, service?.id],
    queryFn: () => base44.entities.MainCourante.filter({ company_id: companyId }, '-date', 300),
    enabled: !!companyId,
  });
  const { data: execs = [] } = useQuery({
    queryKey: ['ronde_execs', companyId, service?.id],
    queryFn: () => base44.entities.RondeExecution.filter({ company_id: companyId }, '-date', 200),
    enabled: !!companyId,
  });

  const siteRondes = rondes.filter((r) => !service.site_id || r.site_id === service.site_id);
  const myExecs = execs.filter((e) =>
    e.date === (service.date || today)
    && (e.agent_id === agentId || e.agent_name === agentName)
    && (!service.site_id || e.site_id === service.site_id),
  );
  const rondesDone = myExecs.filter((e) => e.status === 'terminee' || e.end_time).length;
  const rondesPlanned = siteRondes.length;

  const feed = useMemo(() => {
    return mc
      .filter((e) => {
        if (e.site_id && service.site_id && e.site_id !== service.site_id) return false;
        if (e.date && e.date.split('T')[0] !== (service.date || today)) return false;
        if (e.agent_id && agentId && e.agent_id !== agentId && e.agent_name !== agentName) return false;
        return true;
      })
      .sort((a, b) => `${a.date || ''} ${a.time || ''}`.localeCompare(`${b.date || ''} ${b.time || ''}`));
  }, [mc, service, agentId, agentName, today]);

  const overdue = (() => {
    if (!service.planned_end) return false;
    const end = new Date(`${(service.date || today)}T${service.planned_end.length === 5 ? `${service.planned_end}:00` : service.planned_end}`);
    return Date.now() > end.getTime() && service.status === 'en_service';
  })();

  const writeMc = async (type, content, extra = {}) => {
    const now = format(new Date(), 'HH:mm');
    await base44.entities.MainCourante.create({
      company_id: companyId,
      site_id: service.site_id,
      site_name: service.site_name,
      client_name: service.client_name,
      agent_id: agentId,
      agent_name: agentName,
      mission_id: service.mission_id,
      service_id: service.id,
      date: service.date || today,
      time: now,
      type,
      event_type: type,
      content,
      severity: extra.severity || 'normal',
      ...extra,
    });
    qc.invalidateQueries({ queryKey: ['mc_service'] });
    qc.invalidateQueries({ queryKey: ['mc_agent'] });
    qc.invalidateQueries({ queryKey: ['main_courante'] });
  };

  const pauseMut = useMutation({
    mutationFn: async (action) => {
      const now = format(new Date(), 'HH:mm');
      if (action === 'start') {
        await base44.entities.PriseDeService.update(service.id, {
          pause_started_at: new Date().toISOString(),
          pause_started_time: now,
        });
        await writeMc('debut_pause', `Début de pause à ${now} — ${agentName}`);
        return;
      }
      const start = service.pause_started_at ? new Date(service.pause_started_at) : new Date();
      const minutes = Math.max(1, Math.round((Date.now() - start.getTime()) / 60000));
      const pauses = [...(service.pauses || []), {
        start: service.pause_started_time || format(start, 'HH:mm'),
        end: now,
        minutes,
      }];
      await base44.entities.PriseDeService.update(service.id, {
        pause_started_at: null,
        pause_started_time: null,
        pauses,
      });
      await writeMc('fin_pause', `Fin de pause à ${now} — durée ${minutes} min (début ${service.pause_started_time || ''})`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prises_service'] });
      toast.success(onPause ? 'Pause terminée' : 'Pause commencée');
    },
    onError: (e) => toast.error(e.message || 'Action impossible'),
  });

  const startLibre = () => {
    onStartRonde({
      id: `libre-${service.site_id || 'site'}`,
      name: 'Ronde libre',
      site_id: service.site_id,
      site_name: service.site_name,
      checkpoints: [],
    });
  };

  const dateLabel = service.date
    ? format(new Date(`${String(service.date).split('T')[0]}T12:00:00`), "d MMMM yyyy", { locale: fr })
    : '';

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3 cursor-default">
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-emerald-500 text-white">Planifié</Badge>
          {overdue && <Badge className="bg-amber-400 text-amber-950">Prolongation de service/tournée</Badge>}
          {onPause && <Badge className="bg-amber-500 text-white">En pause</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          Le {dateLabel} de {service.planned_start || mission?.start_time || '—'} à {service.planned_end || mission?.end_time || '—'}
        </p>
        <Badge className="bg-blue-600 text-white">{service.service_type || mission?.title || 'Gardiennage & Surveillance'}</Badge>
        <div>
          <p className="font-bold text-lg">{service.site_name}</p>
          {mission?.site_address && <p className="text-sm text-muted-foreground">{mission.site_address}</p>}
        </div>
        <div className="rounded-lg bg-emerald-100 text-emerald-900 text-sm font-medium px-3 py-2">
          Agent des services — {agentName}
        </div>
        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40">
          <div>
            <p className="text-xs text-muted-foreground">Temps de service</p>
            <ServiceChrono service={service} />
          </div>
          <Button variant="destructive" size="sm" onClick={onFinService} disabled={onPause}>
            Terminer
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="w-4 h-4" />
          <h3 className="font-semibold">Rondes</h3>
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="icon"
            className="h-14 w-14 rounded-full bg-emerald-600 hover:bg-emerald-700"
            onClick={() => (siteRondes[0] ? onStartRonde(siteRondes[0]) : startLibre())}
            disabled={onPause}
          >
            <Play className="w-6 h-6 fill-white" />
          </Button>
          <button type="button" className="flex-1 text-left" onClick={() => setShowRondeDetail((v) => !v)}>
            <p className="font-bold uppercase tracking-wide text-sm">Ronde libre</p>
            <p className="text-sm text-muted-foreground">{rondesDone}/{rondesPlanned} réalisées</p>
          </button>
          <Badge variant="outline">{rondesDone}/{rondesPlanned}</Badge>
        </div>
        {siteRondes.length > 1 && (
          <div className="mt-3 space-y-2">
            {siteRondes.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                <span>{r.name}</span>
                <Button size="sm" variant="secondary" disabled={onPause} onClick={() => onStartRonde(r)}>Démarrer</Button>
              </div>
            ))}
          </div>
        )}
        <button type="button" className="mt-3 text-xs text-muted-foreground flex items-center gap-1" onClick={() => setShowRondeDetail((v) => !v)}>
          Détail de l’exécution des rondes {showRondeDetail ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        {showRondeDetail && (
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            {myExecs.length === 0 && <p>Aucune ronde effectuée pendant ce service.</p>}
            {myExecs.map((e) => (
              <p key={e.id}>• {e.start_time} {e.ronde_name} — {e.status === 'terminee' ? 'terminée' : e.status}</p>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Coffee className="w-4 h-4" />
          <h3 className="font-semibold">Pauses</h3>
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="icon"
            className={`h-14 w-14 rounded-full ${onPause ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-400 hover:bg-amber-500 text-amber-950'}`}
            onClick={() => pauseMut.mutate(onPause ? 'stop' : 'start')}
            disabled={pauseMut.isPending}
          >
            {onPause ? <Play className="w-6 h-6 fill-white" /> : <Pause className="w-6 h-6 fill-white" />}
          </Button>
          <div className="flex-1">
            {onPause ? (
              <>
                <p className="font-semibold text-amber-800">En pause depuis {service.pause_started_time}</p>
                <p className="text-sm">Temps en pause : <PauseChrono startedAt={service.pause_started_at} /></p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {(service.pauses || []).length === 0
                  ? 'Aucune pause planifiée'
                  : `${(service.pauses || []).length} pause(s) — ${(service.pauses || []).reduce((s, p) => s + (p.minutes || 0), 0)} min`}
              </p>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold mb-3">Fil d’activité</h3>
        {feed.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune activité enregistrée pour l’instant.</p>
        ) : (
          <div className="relative pl-6 space-y-4">
            <div className="absolute left-[9px] top-1 bottom-1 w-0.5 bg-emerald-300" />
            {feed.map((e) => (
              <div key={e.id} className="relative">
                <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-white border-2 border-emerald-500 flex items-center justify-center text-[10px]">
                  {EVENT_ICON[e.event_type || e.type] || '•'}
                </div>
                <p className="text-xs text-muted-foreground">{e.date} {e.time}</p>
                <p className="text-sm font-medium">{e.event_label || e.event_type || e.type}</p>
                <p className="text-xs text-muted-foreground">{e.content}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
