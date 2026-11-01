import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell, Search, HelpCircle, Calendar, CalendarDays, LayoutGrid, MapPin,
  ChevronLeft, ChevronRight, Plus, Download, FileText, Users, Clock, AlertTriangle,
  Building2,
} from 'lucide-react';
import { format, isToday, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { normalizeDateKey } from '@/lib/recurrenceExpand';
import { serviceDurationHours } from '@/lib/serviceQualification';

function cap(value) {
  const text = String(value || '');
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

function shortHour(value) {
  if (!value || !String(value).includes(':')) return '';
  const [h, m] = String(value).split(':');
  return m && m !== '00' ? `${h}h${m}` : `${h}h`;
}

function shiftTone(start) {
  const hour = Number(String(start || '').split(':')[0]);
  if (Number.isNaN(hour)) return 'bg-slate-100 text-slate-700';
  if (hour >= 22 || hour < 5) return 'bg-violet-200 text-violet-950';
  if (hour < 8) return 'bg-emerald-100 text-emerald-800';
  if (hour < 13) return 'bg-sky-100 text-sky-800';
  return 'bg-purple-100 text-purple-900';
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function samePerson(mission, conge) {
  if (mission.agent_id && conge.agent_id && mission.agent_id === conge.agent_id) return true;
  const a = String(mission.agent_name || '').trim().toLowerCase();
  const b = String(conge.agent_name || '').trim().toLowerCase();
  return !!a && a === b;
}

function congeCovers(conge, dayKey) {
  if (!conge || conge.status === 'refuse') return false;
  const start = normalizeDateKey(conge.date_debut);
  const end = normalizeDateKey(conge.date_fin) || start;
  return !!start && dayKey >= start && dayKey <= end;
}

function Ring({ value, color = '#22c55e' }) {
  const radius = 16;
  const circ = 2 * Math.PI * radius;
  const len = (Math.max(0, Math.min(100, value)) / 100) * circ;
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden>
      <circle cx="24" cy="24" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="4" />
      <circle cx="24" cy="24" r={radius} fill="none" stroke={color} strokeWidth="4" strokeDasharray={`${len} ${circ - len}`} strokeLinecap="round" transform="rotate(-90 24 24)" />
      <text x="24" y="28" textAnchor="middle" fontSize="10" fontWeight="700" fill="#111827">{value}%</text>
    </svg>
  );
}

export default function PlanningCommand({
  view,
  onView,
  period,
  onPeriod,
  rangeLabel,
  days,
  missions,
  agents,
  conges,
  prises,
  search,
  onSearch,
  siteFilter,
  onSiteFilter,
  siteOptions,
  agentFilter,
  onAgentFilter,
  agentOptions,
  serviceFilter,
  onServiceFilter,
  serviceOptions,
  hideAbsences,
  onHideAbsences,
  onShift,
  onAdd,
  onExport,
  onOpenMissions,
  onAssign,
  onLeaves,
  onGaps,
  userInitial,
  children,
}) {
  const [exportOpen, setExportOpen] = useState(false);
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const dayKeys = days.map((day) => format(day, 'yyyy-MM-dd'));
  const keySet = useMemo(() => new Set(dayKeys), [dayKeys.join('|')]);
  const todayKey = format(new Date(), 'yyyy-MM-dd');

  const inWindow = missions.filter((mission) => keySet.has(normalizeDateKey(mission.date)) && mission.status !== 'annulee');
  const activeAgents = agents.filter((agent) => agent.status !== 'inactif');
  const agentBase = activeAgents.length || agents.length;
  const plannedIds = new Set(inWindow.map((mission) => mission.agent_id || mission.agent_name).filter(Boolean));
  const plannedCount = plannedIds.size;
  const agentPct = agentBase ? Math.round((plannedCount / agentBase) * 100) : 0;

  const activeSites = new Set(inWindow.map((mission) => mission.site_id || mission.site_name).filter(Boolean));
  const coveredSites = new Set(inWindow.filter((mission) => mission.agent_id || mission.agent_name).map((mission) => mission.site_id || mission.site_name).filter(Boolean));
  const sitePct = activeSites.size ? Math.round((coveredSites.size / activeSites.size) * 100) : 0;
  const hours = inWindow.reduce((sum, mission) => sum + serviceDurationHours(mission.start_time, mission.end_time), 0);
  const prevHours = days.length
    ? missions
      .filter((mission) => {
        const key = normalizeDateKey(mission.date);
        const start = format(addDays(days[0], -days.length), 'yyyy-MM-dd');
        const end = format(addDays(days[0], -1), 'yyyy-MM-dd');
        return mission.status !== 'annulee' && key >= start && key <= end;
      })
      .reduce((sum, mission) => sum + serviceDurationHours(mission.start_time, mission.end_time), 0)
    : 0;
  const hourDelta = prevHours > 0 ? Math.round(((hours - prevHours) / prevHours) * 100) : null;
  const uncovered = inWindow.filter((mission) => !mission.agent_id && !mission.agent_name);

  const onDuty = new Set(
    prises
      .filter((prise) => normalizeDateKey(prise.date) === todayKey && (prise.status === 'en_service' || prise.status === 'en_cours'))
      .map((prise) => prise.agent_id || prise.agent_name)
      .filter(Boolean),
  );

  const rows = useMemo(() => {
    const map = new Map();
    inWindow.forEach((mission) => {
      const key = mission.agent_id || mission.agent_name || 'unassigned';
      if (!map.has(key)) {
        map.set(key, {
          key,
          name: mission.agent_name || 'Non affecté',
          unassigned: !mission.agent_id && !mission.agent_name,
          byDay: {},
          sites: {},
          postes: {},
        });
      }
      const row = map.get(key);
      const day = normalizeDateKey(mission.date);
      row.byDay[day] = row.byDay[day] || [];
      row.byDay[day].push(mission);
      if (mission.site_name) row.sites[mission.site_name] = (row.sites[mission.site_name] || 0) + 1;
      const poste = mission.title || mission.type;
      if (poste) row.postes[poste] = (row.postes[poste] || 0) + 1;
    });
    if (!hideAbsences) {
      conges.forEach((conge) => {
        if (conge.status === 'refuse') return;
        const hits = dayKeys.filter((key) => congeCovers(conge, key));
        if (!hits.length) return;
        const key = conge.agent_id || conge.agent_name || `conge-${conge.id}`;
        if (!map.has(key)) {
          map.set(key, {
            key,
            name: conge.agent_name || 'Absence',
            unassigned: false,
            byDay: {},
            sites: {},
            postes: { Absence: 1 },
          });
        }
        const row = map.get(key);
        hits.forEach((day) => {
          row.byDay[day] = row.byDay[day] || [];
          row.byDay[day].push({ conge, id: `conge-${conge.id}-${day}` });
        });
      });
    }
    return [...map.values()].sort((a, b) => {
      if (a.unassigned !== b.unassigned) return a.unassigned ? -1 : 1;
      return a.name.localeCompare(b.name, 'fr');
    });
  }, [inWindow, conges, hideAbsences, dayKeys.join('|')]);

  const topOf = (bag) => Object.entries(bag).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

  const alerts = [];
  uncovered.slice(0, 6).forEach((mission) => {
    alerts.push({
      id: `open-${mission.id}`,
      title: 'Poste non couvert',
      detail: `${mission.site_name || mission.title || 'Vacation'} — ${cap(format(new Date(`${normalizeDateKey(mission.date)}T12:00:00`), 'EEE d MMM', { locale: fr }))}`,
      action: 'Affecter',
      tone: 'rose',
      run: () => onAssign(mission),
    });
  });
  if (!hideAbsences) {
    inWindow.forEach((mission) => {
      const day = normalizeDateKey(mission.date);
      const leave = conges.find((conge) => conge.status !== 'refuse' && samePerson(mission, conge) && congeCovers(conge, day));
      if (!leave || alerts.length > 8) return;
      alerts.push({
        id: `leave-${mission.id}`,
        title: 'Absence non remplacée',
        detail: `${mission.agent_name || 'Agent'} — ${cap(format(new Date(`${day}T12:00:00`), 'EEE d MMM', { locale: fr }))}`,
        action: 'Remplacer',
        tone: 'rose',
        run: () => onOpenMissions([mission], new Date(`${day}T12:00:00`)),
      });
    });
    conges.filter((conge) => conge.status === 'en_attente' && dayKeys.some((key) => congeCovers(conge, key))).forEach((conge) => {
      alerts.push({
        id: `wait-${conge.id}`,
        title: 'Confirmation en attente',
        detail: conge.agent_name || 'Demande de congé',
        action: 'Relancer',
        tone: 'amber',
        run: onLeaves,
      });
    });
  }
  prises.filter((prise) => keySet.has(normalizeDateKey(prise.date)) && prise.actual_start && prise.planned_start).forEach((prise) => {
    const [ph, pm] = String(prise.planned_start).split(':').map(Number);
    const [ah, am] = String(prise.actual_start).split(':').map(Number);
    if ([ph, pm, ah, am].some((n) => Number.isNaN(n))) return;
    if ((ah * 60 + am) - (ph * 60 + pm) <= 5) return;
    alerts.push({
      id: `late-${prise.id}`,
      title: 'Retard de prise de poste',
      detail: `${prise.agent_name || 'Agent'} — ${prise.planned_start} → ${prise.actual_start}`,
      action: 'Voir',
      tone: 'amber',
      run: onGaps,
    });
  });

  const visibleAlerts = showAllAlerts ? alerts.slice(0, 8) : alerts.slice(0, 3);
  const upcoming = useMemo(() => {
    const groups = new Map();
    missions
      .filter((mission) => mission.status !== 'annulee' && normalizeDateKey(mission.date) >= todayKey)
      .sort((a, b) => `${normalizeDateKey(a.date)} ${a.start_time || ''}`.localeCompare(`${normalizeDateKey(b.date)} ${b.start_time || ''}`))
      .forEach((mission) => {
        const key = `${normalizeDateKey(mission.date)}|${mission.site_id || mission.site_name}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(mission);
      });
    return [...groups.values()].slice(0, 4);
  }, [missions, todayKey]);

  const views = [
    ['calendrier', CalendarDays, 'Vue calendrier'],
    ['planning', Calendar, 'Vue planning'],
    ['tableau', LayoutGrid, 'Vue tableau'],
    ['carte', MapPin, 'Vue carte'],
  ];

  return (
    <div>
      <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 shadow-sm">
            <Calendar className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Planning</h1>
            <p className="text-sm text-slate-500">Gestion des vacations, affectations et disponibilités</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Rechercher un agent, un site, un service..."
              className="w-full h-10 rounded-full bg-white border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-amber-400"
            />
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Link to="/alertes" className="relative w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center" aria-label="Alertes">
              <Bell className="w-4 h-4" />
              {alerts.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500" />}
            </Link>
            <span title="Les chiffres viennent des vacations, congés et prises de service de la période affichée." className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center">
              <HelpCircle className="w-4 h-4 text-slate-500" />
            </span>
            <span className="w-10 h-10 rounded-full bg-slate-800 text-white font-semibold flex items-center justify-center">{userInitial}</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        <Stat icon={Users} tint="emerald" kicker="Agents planifiés" value={`${plannedCount} / ${agentBase || 0}`} detail={<Ring value={agentPct} />} />
        <Stat icon={Building2} tint="sky" kicker="Sites couverts" value={`${coveredSites.size} / ${activeSites.size}`} detail={<Ring value={sitePct} color="#0ea5e9" />} />
        <Stat
          icon={Clock}
          tint="amber"
          kicker="Heures planifiées"
          value={`${Math.round(hours)} h`}
          detail={hourDelta == null ? null : (
            <span className={`text-xs font-semibold ${hourDelta >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
              {hourDelta >= 0 ? '▲' : '▼'} {Math.abs(hourDelta)} %
            </span>
          )}
        />
        <button type="button" onClick={() => document.getElementById('alertes-planning')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="text-left">
          <Stat icon={AlertTriangle} tint="rose" kicker="Vacations à couvrir" value={String(uncovered.length)} detail={<span className="shrink-0 whitespace-nowrap text-xs text-slate-500">Voir →</span>} />
        </button>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-3 sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between mb-3">
          <div className="flex rounded-xl bg-slate-100 p-1 w-fit overflow-x-auto">
            {views.map(([id, Icon, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => onView(id)}
                className={cn(
                  'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm whitespace-nowrap',
                  view === id ? 'bg-white shadow text-slate-900 font-medium' : 'text-slate-500',
                )}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl bg-slate-100 p-1">
              {[['jour', 'Jour'], ['semaine', 'Semaine'], ['mois', 'Mois']].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onPeriod(id)}
                  className={cn('h-8 px-3 rounded-lg text-sm', period === id ? 'bg-slate-900 text-white' : 'text-slate-600')}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="inline-flex items-center h-9 rounded-xl border border-slate-200 bg-white">
              <button type="button" className="px-2 h-full" onClick={() => onShift(-1)} aria-label="Période précédente"><ChevronLeft className="w-4 h-4" /></button>
              <span className="px-1 text-sm font-medium whitespace-nowrap">{rangeLabel}</span>
              <button type="button" className="px-2 h-full" onClick={() => onShift(1)} aria-label="Période suivante"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect value={siteFilter} onChange={onSiteFilter} allLabel="Tous les sites" options={siteOptions} />
            <FilterSelect value={serviceFilter} onChange={onServiceFilter} allLabel="Tous les services" options={serviceOptions} />
            <FilterSelect value={agentFilter} onChange={onAgentFilter} allLabel="Tous les agents" options={agentOptions} />
            <button
              type="button"
              role="switch"
              aria-checked={hideAbsences}
              onClick={() => onHideAbsences(!hideAbsences)}
              className="inline-flex items-center gap-2 h-9 px-2 text-sm text-slate-600"
            >
              <span className={cn('w-9 h-5 rounded-full p-0.5 transition-colors', hideAbsences ? 'bg-slate-900' : 'bg-slate-200')}>
                <span className={cn('block w-4 h-4 rounded-full bg-white transition-transform', hideAbsences && 'translate-x-4')} />
              </span>
              Masquer les absences
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button type="button" onClick={() => setExportOpen((open) => !open)} className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm inline-flex items-center gap-2">
                <Download className="w-4 h-4" /> Exporter PDF
              </button>
              {exportOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setExportOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-white border rounded-lg shadow-lg w-52 py-1">
                    <button type="button" onClick={() => { setExportOpen(false); onExport('site'); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 inline-flex items-center gap-2"><FileText className="w-4 h-4" /> Par site</button>
                    <button type="button" onClick={() => { setExportOpen(false); onExport('collaborateur'); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 inline-flex items-center gap-2"><FileText className="w-4 h-4" /> Par collaborateur</button>
                  </div>
                </>
              )}
            </div>
            <button type="button" onClick={onAdd} className="h-9 px-3 rounded-xl bg-[#e4b54a] text-[#1c1403] text-sm font-semibold inline-flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Ajouter une vacation
            </button>
          </div>
        </div>

        {view === 'planning' ? (
          <>
            <h2 className="font-semibold mb-2">Planning des vacations</h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 mb-3">
              <Legend dot="bg-emerald-400" label="Poste matin" />
              <Legend dot="bg-sky-400" label="Poste journée" />
              <Legend dot="bg-purple-400" label="Poste soir" />
              <Legend dot="bg-violet-700" label="Poste nuit" />
              <Legend dot="bg-rose-400" label="Absence / Congé" />
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm border-collapse min-w-[760px]">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="sticky left-0 bg-white z-10 px-3 py-3 font-medium border-b min-w-[180px]">Agent</th>
                    <th className="px-3 py-3 font-medium border-b min-w-[160px]">Site / Poste</th>
                    {days.map((day) => (
                      <th key={format(day, 'yyyy-MM-dd')} className={cn('px-2 py-2 font-medium border-b text-center min-w-[92px]', isToday(day) && 'text-amber-700')}>
                        <div>{cap(format(day, 'EEE', { locale: fr }))} {format(day, 'd')}</div>
                        <div className="text-[10px] font-normal">{cap(format(day, 'MMM', { locale: fr }))}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={days.length + 2} className="px-3 py-14 text-center text-slate-400">
                        Aucune vacation sur cette période.
                      </td>
                    </tr>
                  )}
                  {rows.map((row) => (
                    <tr key={row.key} className="border-t border-slate-100">
                      <td className="sticky left-0 bg-white z-10 px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded-full bg-slate-100 text-[11px] font-semibold flex items-center justify-center text-slate-600">{row.unassigned ? '–' : initials(row.name)}</span>
                          <span className="font-medium truncate">{row.name}</span>
                          {onDuty.has(row.key) && <span className="w-2 h-2 rounded-full bg-emerald-500" title="En service" />}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <p className="truncate">{row.unassigned ? 'À pourvoir' : (topOf(row.sites) || '—')}</p>
                        <p className="text-[11px] text-slate-400 truncate">{topOf(row.postes) || 'Vacation'}</p>
                      </td>
                      {dayKeys.map((key) => {
                        const items = row.byDay[key] || [];
                        return (
                          <td key={key} className={cn('px-1.5 py-2 text-center align-middle', isToday(days[dayKeys.indexOf(key)]) && 'bg-amber-50/60')}>
                            <div className="flex flex-col items-center gap-1">
                              {items.slice(0, 2).map((item) => item.conge ? (
                                <span key={item.id} className="px-2 py-1 rounded-lg bg-rose-100 text-rose-700 text-[11px] font-medium">Congé</span>
                              ) : (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => onOpenMissions([item], new Date(`${key}T12:00:00`))}
                                  className={cn('px-2 py-1 rounded-lg text-[11px] font-semibold', shiftTone(item.start_time))}
                                >
                                  {shortHour(item.start_time) || '—'}–{shortHour(item.end_time) || '—'}
                                </button>
                              ))}
                              {items.length > 2 && <span className="text-[10px] text-slate-400">+{items.length - 2}</span>}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="mt-1">{children}</div>
        )}
      </div>

      {view === 'planning' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 mt-3">
          <section className="rounded-2xl bg-white border border-slate-200 p-4">
            <h2 className="font-semibold mb-3">Couverture des postes</h2>
            <div className="flex items-center gap-4">
              <Coverage percent={sitePct} />
              <ul className="text-sm space-y-2 text-slate-600">
                <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500" /> {coveredSites.size} site{coveredSites.size > 1 ? 's' : ''} couvert{coveredSites.size > 1 ? 's' : ''}</li>
                <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500" /> {plannedCount} agent{plannedCount > 1 ? 's' : ''} planifié{plannedCount > 1 ? 's' : ''}</li>
                <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500" /> {uncovered.length} poste{uncovered.length > 1 ? 's' : ''} découvert{uncovered.length > 1 ? 's' : ''}</li>
              </ul>
            </div>
          </section>
          <section id="alertes-planning" className="rounded-2xl bg-rose-50/70 border border-rose-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Alertes planning ({alerts.length})</h2>
              {alerts.length > 3 && (
                <button type="button" onClick={() => setShowAllAlerts((open) => !open)} className="text-xs text-slate-500">Voir tout →</button>
              )}
            </div>
            {visibleAlerts.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune alerte sur cette période.</p>
            ) : (
              <ul className="space-y-2">
                {visibleAlerts.map((alert) => (
                  <li key={alert.id} className="flex items-center gap-2 rounded-xl bg-white/80 px-2 py-2">
                    <AlertTriangle className={cn('w-4 h-4 shrink-0', alert.tone === 'amber' ? 'text-amber-500' : 'text-rose-500')} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{alert.title}</p>
                      <p className="text-[11px] text-slate-500 truncate">{alert.detail}</p>
                    </div>
                    <button type="button" onClick={alert.run} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white border border-slate-200">{alert.action}</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-2xl bg-white border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Prochains services</h2>
              <Link to="/missions" className="text-xs text-slate-500">Voir tout →</Link>
            </div>
            {upcoming.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun service à venir.</p>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((group) => {
                  const first = group[0];
                  const day = normalizeDateKey(first.date);
                  const label = day === todayKey ? "Aujourd'hui" : cap(format(new Date(`${day}T12:00:00`), 'EEE d MMM', { locale: fr }));
                  const starts = group.map((mission) => mission.start_time).filter(Boolean).sort();
                  const ends = group.map((mission) => mission.end_time).filter(Boolean).sort();
                  return (
                    <li key={`${day}-${first.site_id || first.site_name}`} className="flex items-center gap-2 text-sm">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-slate-400">{label}</p>
                        <p className="truncate font-medium">{first.site_name || 'Site'}</p>
                      </div>
                      <span className="text-xs text-slate-500 whitespace-nowrap">{shortHour(starts[0])}–{shortHour(ends[ends.length - 1])}</span>
                      <span className="text-xs text-slate-400 inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" />{group.length}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, tint, kicker, value, detail }) {
  const tones = {
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-600',
    sky: 'bg-sky-50 border-sky-100 text-sky-600',
    amber: 'bg-amber-50 border-amber-100 text-amber-600',
    rose: 'bg-rose-50 border-rose-100 text-rose-600',
  };
  return (
    <div className={cn('rounded-2xl border bg-white p-4 min-h-[108px] flex items-start justify-between gap-2', tones[tint].split(' ').slice(1, 2).join(' '))}>
      <div>
        <span className={cn('w-8 h-8 rounded-lg border flex items-center justify-center', tones[tint])}>
          <Icon className="w-4 h-4" />
        </span>
        <p className="text-[11px] uppercase tracking-wide text-slate-500 mt-3">{kicker}</p>
        <p className="text-2xl font-bold leading-none mt-1">{value}</p>
      </div>
      {detail}
    </div>
  );
}

function FilterSelect({ value, onChange, allLabel, options }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 rounded-full border border-slate-200 bg-white px-3 text-sm text-slate-700"
    >
      <option value="">{allLabel}</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}

function Legend({ dot, label }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('w-2 h-2 rounded-full', dot)} />
      {label}
    </span>
  );
}

function Coverage({ percent }) {
  const radius = 36;
  const circ = 2 * Math.PI * radius;
  const len = (Math.max(0, Math.min(100, percent)) / 100) * circ;
  return (
    <div className="relative w-[112px] h-[112px] shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#22c55e" strokeWidth="10" strokeDasharray={`${len} ${circ - len}`} strokeLinecap="round" transform="rotate(-90 50 50)" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-bold">{percent}%</div>
    </div>
  );
}
