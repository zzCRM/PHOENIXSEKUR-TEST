import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet';
import {
  Bell, Search, HelpCircle, Calendar, Users, MapPin, Clock, AlertTriangle,
  Building2, Warehouse, Landmark, Hospital, ChevronRight, CheckCircle2, Shield,
} from 'lucide-react';
import { format, parseISO, startOfWeek, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { accountDisplayName } from '@/lib/agentPortal';
import { normalizeDateKey } from '@/lib/recurrenceExpand';
import { siteLatLng } from '@/lib/siteCoords';
import 'leaflet/dist/leaflet.css';

function parisParts(date = new Date()) {
  const dateKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
  const time = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(date);
  const label = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(date);
  return { dateKey, time, label: label.charAt(0).toUpperCase() + label.slice(1) };
}

function helloName(user) {
  const raw = accountDisplayName(user);
  const token = raw
    ? (raw.split(/\s+/).filter(Boolean).pop() || raw)
    : (user?.email || 'bonjour').split('@')[0];
  if (!token) return 'bonjour';
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

function hoursBetween(start, end) {
  if (!start || !end) return 0;
  const [h1, m1] = String(start).split(':').map(Number);
  const [h2, m2] = String(end).split(':').map(Number);
  if ([h1, m1, h2, m2].some((n) => Number.isNaN(n))) return 0;
  let minutes = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (minutes <= 0) minutes += 24 * 60;
  return minutes / 60;
}

function toMinutes(value) {
  if (!value || typeof value !== 'string' || !value.includes(':')) return null;
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function eventLabel(entry) {
  return entry.event_label || entry.type_label || entry.description || entry.message || entry.title || 'Événement';
}

function siteIcon(name = '') {
  const n = name.toLowerCase();
  if (n.includes('hôpital') || n.includes('hopital') || n.includes('clinique')) return Hospital;
  if (n.includes('siège') || n.includes('siege') || n.includes('bureau')) return Landmark;
  if (n.includes('logi') || n.includes('entrepôt') || n.includes('entrepot')) return Warehouse;
  return Building2;
}

function FitSites({ points }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`).join('|');
  useEffect(() => {
    if (!points.length) {
      map.setView([46.6, 2.4], 5);
      return;
    }
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 12);
      return;
    }
    map.fitBounds(points.map((p) => [p.lat, p.lng]), { padding: [28, 28], maxZoom: 12 });
  }, [map, key]);
  return null;
}

function Donut({ parts, totalLabel, totalValue }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  const radius = 38;
  const circ = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="relative w-[148px] h-[148px] shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
        {total > 0 && parts.map((part) => {
          const len = (part.value / total) * circ;
          const node = (
            <circle
              key={part.key}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={part.color}
              strokeWidth="10"
              strokeDasharray={`${len} ${circ - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              transform="rotate(-90 50 50)"
            />
          );
          offset += len;
          return node;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-2xl font-bold leading-none">{totalValue}</p>
        <p className="text-[11px] text-white/55 mt-1">{totalLabel}</p>
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, kicker, value, detail, tone, to }) {
  const tones = {
    green: 'from-[#123526] to-[#0c1c18] border-emerald-500/30',
    blue: 'from-[#10233c] to-[#0c1624] border-sky-500/30',
    amber: 'from-[#2a2412] to-[#16140c] border-amber-400/30',
    red: 'from-[#2a1218] to-[#160c10] border-rose-500/30',
  };
  const iconTones = {
    green: 'bg-emerald-500/15 text-emerald-400',
    blue: 'bg-sky-500/15 text-sky-400',
    amber: 'bg-amber-400/15 text-amber-300',
    red: 'bg-rose-500/15 text-rose-400',
  };
  return (
    <Link to={to} className={`rounded-2xl border bg-gradient-to-br ${tones[tone]} p-4 min-h-[108px] flex flex-col justify-between hover:brightness-110 transition`}>
      <div className="flex items-start justify-between gap-2">
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconTones[tone]}`}>
          <Icon className="w-4 h-4" />
        </span>
        {detail}
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-wide text-white/55">{kicker}</p>
        <p className="text-[28px] font-bold leading-none mt-1">{value}</p>
      </div>
    </Link>
  );
}

function Panel({ title, action, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-[#0d1726] ${className}`}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function Dashboard() {
  const { companyId, user } = useCompany();
  const navigate = useNavigate();
  const [clock, setClock] = useState(() => parisParts());
  const [query, setQuery] = useState('');

  useEffect(() => {
    const id = setInterval(() => setClock(parisParts()), 30000);
    return () => clearInterval(id);
  }, []);

  const { data: agents = [], isLoading: la } = useQuery({
    queryKey: ['agents', companyId],
    queryFn: () => base44.entities.Agent.filter({ company_id: companyId }),
    enabled: !!companyId,
  });
  const { data: missions = [], isLoading: lm } = useQuery({
    queryKey: ['missions', companyId],
    queryFn: () => base44.entities.Mission.filter({ company_id: companyId }, '-date', 800),
    enabled: !!companyId,
  });
  const { data: sites = [], isLoading: ls } = useQuery({
    queryKey: ['sites', companyId],
    queryFn: () => base44.entities.Site.filter({ company_id: companyId }),
    enabled: !!companyId,
  });
  const { data: prises = [] } = useQuery({
    queryKey: ['prises_service', companyId],
    queryFn: () => base44.entities.PriseDeService.filter({ company_id: companyId }, '-date', 200),
    enabled: !!companyId,
  });
  const { data: alertes = [] } = useQuery({
    queryKey: ['alertes', companyId],
    queryFn: () => base44.entities.Alerte.filter({ company_id: companyId }, '-created_date', 80),
    enabled: !!companyId,
  });
  const { data: journal = [] } = useQuery({
    queryKey: ['main_courante', companyId],
    queryFn: () => base44.entities.MainCourante.filter({ company_id: companyId }, '-created_date', 40),
    enabled: !!companyId,
  });

  const todayKey = clock.dateKey;
  const todayMissions = useMemo(
    () => missions.filter((m) => normalizeDateKey(m.date) === todayKey && m.status !== 'annulee'),
    [missions, todayKey],
  );
  const onDuty = useMemo(
    () => prises.filter((p) => normalizeDateKey(p.date) === todayKey && (p.status === 'en_service' || p.status === 'en_cours')),
    [prises, todayKey],
  );
  const activeAgents = agents.filter((a) => a.status !== 'inactif');
  const dutyCount = new Set(onDuty.map((p) => p.agent_id).filter(Boolean)).size;
  const agentBase = activeAgents.length || agents.length;
  const dutyPct = agentBase ? Math.round((dutyCount / agentBase) * 100) : 0;

  const sitesWithMission = new Set(todayMissions.map((m) => m.site_id).filter(Boolean));
  const openAlerts = alertes.filter((a) => !a.read && a.type !== 'pti_ok' && a.status !== 'cloturee' && a.status !== 'close');
  const alertSiteIds = new Set(openAlerts.map((a) => a.site_id).filter(Boolean));
  const unassigned = todayMissions.filter((m) => !m.agent_id && !m.agent_name);

  const siteStates = sites.map((site) => {
    let state = 'ok';
    if (alertSiteIds.has(site.id)) state = 'alert';
    else if (todayMissions.some((m) => m.site_id === site.id && !m.agent_id && !m.agent_name)) state = 'watch';
    else if (!sitesWithMission.has(site.id)) state = 'idle';
    return { site, state };
  });
  const operational = siteStates.filter((s) => s.state === 'ok' || s.state === 'idle').length;
  const watch = siteStates.filter((s) => s.state === 'watch').length;
  const anomaly = siteStates.filter((s) => s.state === 'alert').length;
  const activeSites = sites.filter((site) => !['inactif', 'ferme', 'archive', 'inactif'].includes(site.status));
  const activeSitePct = sites.length ? Math.round((activeSites.length / sites.length) * 100) : 0;

  const plannedHours = todayMissions.reduce((sum, m) => sum + hoursBetween(m.start_time, m.end_time), 0);
  const weekStart = startOfWeek(parseISO(todayKey), { weekStartsOn: 1 });
  const weekKeys = Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), 'yyyy-MM-dd'));
  const prevWeekKeys = weekKeys.map((key) => format(addDays(parseISO(key), -7), 'yyyy-MM-dd'));
  const hoursFor = (keys) => missions
    .filter((m) => keys.includes(normalizeDateKey(m.date)) && m.status !== 'annulee')
    .reduce((sum, m) => sum + hoursBetween(m.start_time, m.end_time), 0);
  const weekHours = hoursFor(weekKeys);
  const prevWeekHours = hoursFor(prevWeekKeys);
  const weekDelta = prevWeekHours > 0 ? Math.round(((weekHours - prevWeekHours) / prevWeekHours) * 100) : null;
  const dayBars = weekKeys.map((key) => ({
    label: format(parseISO(key), 'EEEEE', { locale: fr }).toUpperCase(),
    hours: missions
      .filter((m) => normalizeDateKey(m.date) === key && m.status !== 'annulee')
      .reduce((sum, m) => sum + hoursBetween(m.start_time, m.end_time), 0),
    today: key === todayKey,
  }));
  const maxBar = Math.max(8, ...dayBars.map((d) => d.hours));

  const lateStarts = prises.filter((p) => {
    if (normalizeDateKey(p.date) !== todayKey) return false;
    const planned = toMinutes(p.planned_start);
    const actual = toMinutes(p.actual_start);
    return planned != null && actual != null && actual - planned > 0;
  });

  const anomalies = unassigned.length + lateStarts.length + openAlerts.length;

  const pins = siteStates
    .map(({ site, state }) => {
      const pos = siteLatLng(site);
      if (!pos) return null;
      return { ...pos, id: site.id, name: site.name || site.site_name, state };
    })
    .filter(Boolean);

  const q = query.trim().toLowerCase();
  const planning = todayMissions
    .filter((m) => !q || [m.site_name, m.title, m.client_name, m.agent_name].some((v) => String(v || '').toLowerCase().includes(q)))
    .sort((a, b) => String(a.start_time || '').localeCompare(String(b.start_time || '')));

  const searchHits = q ? [
    ...agents.filter((a) => `${a.first_name || ''} ${a.last_name || ''} ${a.email || ''}`.toLowerCase().includes(q)).slice(0, 3)
      .map((a) => ({ id: a.id, label: `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email, hint: 'Agent', to: '/agents' })),
    ...sites.filter((s) => `${s.name || ''} ${s.city || ''}`.toLowerCase().includes(q)).slice(0, 3)
      .map((s) => ({ id: s.id, label: s.name || 'Site', hint: 'Site', to: '/sites' })),
    ...planning.slice(0, 3).map((m) => ({ id: m.id, label: m.site_name || m.title, hint: 'Vacation', to: '/planning' })),
  ] : [];

  const activity = [
    ...journal.map((row) => ({
      id: `mc-${row.id}`,
      time: row.time || row.heure || '',
      title: eventLabel(row),
      place: row.site_name || '',
      kind: row.severity === 'urgent' || row.category === 'incident' ? 'alert' : 'ok',
    })),
    ...prises.filter((p) => normalizeDateKey(p.date) === todayKey).map((p) => ({
      id: `ps-${p.id}`,
      time: p.actual_start || p.planned_start || '',
      title: p.status === 'termine' ? 'Fin de service' : 'Prise de poste',
      place: p.site_name || p.agent_name || '',
      kind: 'info',
    })),
  ]
    .filter((row) => !q || `${row.title} ${row.place}`.toLowerCase().includes(q))
    .sort((a, b) => String(b.time).localeCompare(String(a.time)))
    .slice(0, 4);

  const resting = Math.max(0, agentBase - dutyCount);
  const donutParts = [
    { key: 'duty', label: 'En service', value: dutyCount, color: '#34d399' },
    { key: 'rest', label: 'En repos', value: resting, color: '#64748b' },
    { key: 'off', label: 'Inactifs', value: agents.filter((a) => a.status === 'inactif').length, color: '#f43f5e' },
  ].filter((part) => part.value > 0);

  const alerts = [
    ...unassigned.slice(0, 2).map((m) => ({
      id: m.id,
      title: 'Vacation non couverte',
      detail: `${m.site_name || m.title || 'Site'} — ${m.start_time || ''}${m.end_time ? `-${m.end_time}` : ''}`,
      to: '/planning',
    })),
    ...lateStarts.slice(0, 2).map((p) => ({
      id: p.id,
      title: 'Retard de prise de poste',
      detail: `${p.agent_name || 'Agent'} — ${p.site_name || ''} ${p.planned_start || ''}→${p.actual_start || ''}`,
      to: '/ecarts-horaires',
    })),
    ...openAlerts.slice(0, 2).map((a) => ({
      id: a.id,
      title: a.pti ? 'Alerte PTI' : 'Alerte à traiter',
      detail: a.message || a.description || a.site_name || a.type || 'Alerte',
      to: a.pti ? '/pti' : '/alertes',
    })),
  ].slice(0, 3);

  const initial = helloName(user).charAt(0).toUpperCase();
  const loading = la || lm || ls;

  return (
    <div className="-m-3 sm:-m-4 xl:-m-8 min-h-[calc(100dvh-4.5rem)] xl:min-h-screen bg-[#070e1a] text-white px-3 py-4 sm:px-5 sm:py-5 pb-24 xl:pb-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between mb-5">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight">Bonjour, {helloName(user)}</h1>
          <p className="text-sm text-white/55 mt-1">Voici la synthèse de votre activité aujourd’hui.</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 xl:justify-end">
          <div className="relative w-full sm:w-[320px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un agent, un site, une vacation..."
              className="w-full h-10 rounded-full bg-[#101a2b] border border-white/10 pl-9 pr-3 text-sm placeholder:text-white/35 outline-none focus:border-amber-300/50"
            />
            {searchHits.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-xl border border-white/10 bg-[#101a2b] shadow-lg overflow-hidden">
                {searchHits.map((hit) => (
                  <button
                    key={`${hit.hint}-${hit.id}`}
                    type="button"
                    onClick={() => navigate(hit.to)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 flex items-center justify-between"
                  >
                    <span>{hit.label}</span>
                    <span className="text-[11px] text-white/40">{hit.hint}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Link to="/alertes" className="relative w-10 h-10 rounded-full bg-[#101a2b] border border-white/10 flex items-center justify-center" aria-label="Alertes">
              <Bell className="w-4 h-4" />
              {openAlerts.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500" />}
            </Link>
            <span title="Les chiffres viennent des missions, pointages, sites et alertes de votre société." className="w-10 h-10 rounded-full bg-[#101a2b] border border-white/10 flex items-center justify-center">
              <HelpCircle className="w-4 h-4 text-white/70" />
            </span>
            <span className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-300 to-amber-600 text-[#1c1403] font-bold flex items-center justify-center">
              {initial}
            </span>
          </div>
        </div>
      </header>

      <div className="flex items-center gap-2 text-sm text-white/70 mb-4">
        <Calendar className="w-4 h-4 text-amber-300" />
        <span>{clock.label}</span>
        <span className="ml-auto font-semibold tabular-nums">{clock.time}</span>
      </div>

      {loading ? (
        <div className="h-40 rounded-2xl border border-white/10 bg-[#0d1726] animate-pulse" />
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
            <StatTile
              icon={Users}
              tone="green"
              kicker="Agents en service"
              value={`${dutyCount} / ${agentBase || 0}`}
              to="/agents"
              detail={<Ring value={dutyPct} color="#34d399" />}
            />
            <StatTile
              icon={MapPin}
              tone="blue"
              kicker="Sites actifs"
              value={`${activeSites.length} / ${sites.length}`}
              to="/sites"
              detail={<Ring value={activeSitePct} color="#38bdf8" />}
            />
            <StatTile
              icon={Clock}
              tone="amber"
              kicker="Heures planifiées"
              value={`${Math.round(plannedHours)} h`}
              to="/planning"
              detail={weekDelta == null ? null : (
                <span className={`text-xs font-semibold ${weekDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {weekDelta >= 0 ? '▲' : '▼'} {Math.abs(weekDelta)} %
                </span>
              )}
            />
            <StatTile
              icon={AlertTriangle}
              tone="red"
              kicker="Anomalies"
              value={String(anomalies).padStart(2, '0')}
              to="/alertes"
              detail={<span className="shrink-0 whitespace-nowrap text-[11px] text-white/70">Voir →</span>}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-3 mb-3">
            <Panel
              className="xl:col-span-3"
              title="Planning du jour"
              action={<Link to="/planning" className="text-xs text-amber-300 hover:underline">Vue planning →</Link>}
            >
              <ul className="divide-y divide-white/5">
                {planning.length === 0 && (
                  <li className="px-4 py-8 text-sm text-white/45">Aucune vacation aujourd’hui.</li>
                )}
                {planning.slice(0, 6).map((mission) => {
                  const Icon = siteIcon(mission.site_name || mission.title);
                  const uncovered = !mission.agent_id && !mission.agent_name;
                  return (
                    <li key={mission.id} className="px-4 py-3 flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${uncovered ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                      <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/70">
                        <Icon className="w-4 h-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{mission.site_name || mission.title || 'Vacation'}</p>
                        <p className="text-[11px] text-white/40 truncate">{mission.client_name || mission.agent_name || 'Non assigné'}</p>
                      </div>
                      <p className="text-xs text-white/70 tabular-nums whitespace-nowrap">
                        {mission.start_time || '—'}{mission.end_time ? ` – ${mission.end_time}` : ''}
                      </p>
                      <span className="hidden sm:flex items-center gap-1 text-xs text-white/55">
                        <Users className="w-3.5 h-3.5" />
                        {mission.agent_name ? 1 : 0}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Panel>

            <Panel
              className="xl:col-span-2"
              title="Carte des sites"
              action={<Link to="/carte" className="text-xs text-amber-300 hover:underline">Voir la carte →</Link>}
            >
              <style>{`.phoenix-dark-map .leaflet-tile-pane{filter:invert(1) hue-rotate(180deg) brightness(.92) saturate(.45);}.phoenix-dark-map .leaflet-container{background:#0b1a2e;}.phoenix-dark-map .leaflet-control-attribution{background:rgba(7,14,26,.75);color:rgba(255,255,255,.55);font-size:9px;}.phoenix-dark-map .leaflet-control-attribution a{color:#e4b54a;}`}</style>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_148px]">
                <div className="phoenix-dark-map h-[220px] sm:h-[250px] overflow-hidden">
                  <MapContainer center={[46.6, 2.4]} zoom={5} style={{ height: '100%', width: '100%', background: '#0b1a2e' }} zoomControl={false}>
                    <TileLayer attribution="&copy; OpenStreetMap" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <FitSites points={pins} />
                    {pins.map((pin) => (
                      <CircleMarker
                        key={pin.id}
                        center={[pin.lat, pin.lng]}
                        radius={8}
                        pathOptions={{
                          color: pin.state === 'alert' ? '#fb7185' : pin.state === 'watch' ? '#fbbf24' : '#34d399',
                          fillColor: pin.state === 'alert' ? '#fb7185' : pin.state === 'watch' ? '#fbbf24' : '#34d399',
                          fillOpacity: 0.95,
                          weight: 2,
                        }}
                      />
                    ))}
                  </MapContainer>
                </div>
                <div className="p-3 text-xs space-y-2 border-t sm:border-t-0 sm:border-l border-white/5">
                  <p className="text-lg font-bold">{sites.length} sites</p>
                  <Legend color="bg-emerald-400" label={`${operational} opérationnels`} />
                  <Legend color="bg-amber-400" label={`${watch} sous vigilance`} />
                  <Legend color="bg-rose-400" label={`${anomaly} en anomalie`} />
                  {pins.length === 0 && <p className="text-white/40 pt-2">Aucun site n’a de coordonnées GPS.</p>}
                </div>
              </div>
            </Panel>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 mb-3">
            <Panel title="Activité récente" action={<Link to="/main-courante" className="text-xs text-white/50 hover:text-white">Tout voir →</Link>}>
              <ul className="px-2 py-2 space-y-1">
                {activity.length === 0 && <li className="px-2 py-6 text-sm text-white/45">Aucun événement récent.</li>}
                {activity.map((row) => (
                  <li key={row.id} className="flex items-start gap-3 px-2 py-2 rounded-xl hover:bg-white/5">
                    <span className="text-[11px] text-white/40 w-10 pt-0.5 tabular-nums">{row.time || '—'}</span>
                    <span className={`mt-0.5 w-6 h-6 rounded-md flex items-center justify-center ${row.kind === 'alert' ? 'bg-rose-500/15 text-rose-300' : row.kind === 'info' ? 'bg-sky-500/15 text-sky-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
                      {row.kind === 'alert' ? <AlertTriangle className="w-3.5 h-3.5" /> : row.kind === 'info' ? <Shield className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm leading-tight">{row.title}</p>
                      {row.place && <p className="text-[11px] text-white/40 truncate">{row.place}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="Répartition des agents">
              <div className="p-4 flex items-center gap-4">
                <Donut parts={donutParts.length ? donutParts : [{ key: 'empty', value: 1, color: '#334155' }]} totalValue={agents.length} totalLabel="Agents" />
                <ul className="space-y-2 text-sm">
                  <LegendRow color="bg-emerald-400" label="En service" value={`${dutyCount} (${dutyPct} %)`} />
                  <LegendRow color="bg-slate-400" label="En repos" value={`${resting}`} />
                  <LegendRow color="bg-rose-400" label="Inactifs" value={`${agents.filter((a) => a.status === 'inactif').length}`} />
                </ul>
              </div>
            </Panel>

            <Panel title="Heures planifiées (semaine)">
              <div className="px-4 pt-3 pb-4 h-[210px] flex items-end justify-between gap-1">
                {dayBars.map((bar) => (
                  <div key={bar.label} className="flex-1 flex flex-col items-center gap-2 h-full justify-end min-w-0">
                    <div className="w-full flex items-end justify-center h-[150px]">
                      <div
                        className={`w-5 sm:w-7 max-w-full rounded-t-md ${bar.today ? 'bg-amber-300' : 'bg-sky-500/80'}`}
                        style={{ height: bar.hours > 0 ? `${Math.max(8, (bar.hours / maxBar) * 100)}%` : '0%' }}
                        title={`${Math.round(bar.hours)} h`}
                      />
                    </div>
                    <span className={`text-[11px] ${bar.today ? 'text-amber-200' : 'text-white/50'}`}>{bar.label}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <section className="rounded-2xl border border-rose-500/30 bg-gradient-to-r from-[#2a1218] to-[#120c18] px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                Alertes à traiter ({alerts.length})
              </h2>
              <Link to="/alertes" className="text-xs text-white/60 hover:text-white inline-flex items-center gap-1">
                Tout traiter <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            {alerts.length === 0 ? (
              <p className="text-sm text-white/50 pb-1">Aucune alerte ouverte pour aujourd’hui.</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
                {alerts.map((item) => (
                  <div key={item.id} className="rounded-xl bg-black/25 border border-white/10 px-3 py-3 flex items-center gap-3">
                    <span className="w-9 h-9 rounded-lg bg-rose-500/10 text-rose-300 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <p className="text-[11px] text-white/45 truncate">{item.detail}</p>
                    </div>
                    <Link to={item.to} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15">
                      Traiter
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Ring({ value, color }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const len = (Math.max(0, Math.min(100, value)) / 100) * c;
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden>
      <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
      <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="4" strokeDasharray={`${len} ${c - len}`} strokeLinecap="round" transform="rotate(-90 22 22)" />
      <text x="22" y="26" textAnchor="middle" fontSize="9" fill="white" fontWeight="700">{value}%</text>
    </svg>
  );
}

function Legend({ color, label }) {
  return (
    <p className="flex items-center gap-2 text-white/75">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      {label}
    </p>
  );
}

function LegendRow({ color, label, value }) {
  return (
    <li className="flex items-center gap-2">
      <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
      <span className="text-white/80">{label}</span>
      <span className="ml-auto text-white/50 text-xs">{value}</span>
    </li>
  );
}
