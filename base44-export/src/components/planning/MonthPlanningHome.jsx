import React, { useMemo, useState } from 'react';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, addMonths, subMonths, isSameMonth, isSameDay, isToday,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { normalizeDateKey } from '@/lib/recurrenceExpand';

const WEEK_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function dayMissions(missions, day) {
  const key = format(day, 'yyyy-MM-dd');
  return missions.filter((m) => normalizeDateKey(m.date) === key && m.status !== 'annulee');
}

export default function MonthPlanningHome({
  missions = [],
  prises = [],
  sites = [],
  title = 'Planning du mois',
  onOpenMission,
  currentService,
  month: monthProp,
  onMonthChange,
  selected: selectedProp,
  onSelect,
  onAdd,
  feriesMap = {},
  counts = true,
  hideMonthNav = false,
}) {
  const [monthState, setMonthState] = useState(() => startOfMonth(monthProp || new Date()));
  const [selectedState, setSelectedState] = useState(() => selectedProp || new Date());
  const [calendarOpen, setCalendarOpen] = useState(true);
  const month = monthProp ? startOfMonth(monthProp) : monthState;
  const selected = selectedProp || selectedState;

  const setMonth = (updater) => {
    const next = typeof updater === 'function' ? updater(month) : updater;
    onMonthChange?.(next);
    if (!monthProp) setMonthState(startOfMonth(next));
  };
  const setSelected = (day) => {
    onSelect?.(day);
    if (!selectedProp) setSelectedState(day);
  };

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const selectedList = useMemo(() => dayMissions(missions, selected)
    .sort((a, b) => String(a.start_time || '').localeCompare(String(b.start_time || ''))), [missions, selected]);

  const countByDay = useMemo(() => {
    const map = {};
    missions.forEach((m) => {
      const k = normalizeDateKey(m.date);
      if (k && m.status !== 'annulee') map[k] = (map[k] || 0) + 1;
    });
    return map;
  }, [missions]);
  const priseByMission = useMemo(() => {
    const map = {};
    prises.forEach((p) => {
      if (p.mission_id) map[p.mission_id] = p;
      if (p.status === 'en_service') map[`site-${p.site_id}-${normalizeDateKey(p.date)}`] = p;
    });
    return map;
  }, [prises]);

  const siteById = useMemo(() => Object.fromEntries(sites.map((s) => [s.id, s])), [sites]);

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b">
        <h2 className="font-semibold text-sm sm:text-base">{title}</h2>
        {!hideMonthNav && (
        <div className="flex items-center gap-1">
          <button type="button" className="p-2 rounded-lg hover:bg-muted" onClick={() => setMonth((d) => subMonths(d, 1))} aria-label="Mois précédent">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium min-w-[8.5rem] text-center capitalize">
            {format(month, 'MMMM yyyy', { locale: fr })}
          </span>
          <button type="button" className="p-2 rounded-lg hover:bg-muted" onClick={() => setMonth((d) => addMonths(d, 1))} aria-label="Mois suivant">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        )}
      </div>

      {calendarOpen && (
        <div className="p-3">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEK_LABELS.map((d) => (
              <div key={d} className="text-[10px] sm:text-xs text-center text-muted-foreground font-medium py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const inMonth = isSameMonth(day, month);
              const selectedDay = isSameDay(day, selected);
              const n = countByDay[key] || 0;
              const ferie = feriesMap[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setSelected(day); }}
                  className={cn(
                    'relative h-11 sm:h-12 rounded-2xl text-sm flex flex-col items-center justify-center',
                    !inMonth && 'text-muted-foreground/40',
                    selectedDay && 'bg-slate-800 text-white shadow-sm',
                    !selectedDay && isToday(day) && 'ring-1 ring-primary',
                    !selectedDay && inMonth && !ferie && 'hover:bg-muted',
                    !selectedDay && ferie && inMonth && 'bg-red-50 text-red-700',
                  )}
                >
                  {format(day, 'd')}
                  {n > 0 && counts && (
                    <span className={cn(
                      'text-[9px] font-semibold leading-none mt-0.5',
                      selectedDay ? 'text-amber-200' : 'text-amber-600',
                    )}
                    >
                      {n}
                    </span>
                  )}
                  {n > 0 && !counts && (
                    <span className={cn('absolute bottom-1 w-1.5 h-1.5 rounded-full', selectedDay ? 'bg-amber-300' : 'bg-amber-500')} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        type="button"
        className="w-full flex justify-center py-1.5 border-t text-muted-foreground hover:bg-muted/40"
        onClick={() => setCalendarOpen((v) => !v)}
      >
        {calendarOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      <div className="px-3 pb-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">Services</h3>
            <p className="text-xs text-muted-foreground capitalize">
              {format(selected, 'EEEE d MMMM', { locale: fr })}
              {feriesMap[format(selected, 'yyyy-MM-dd')] ? ` — ${feriesMap[format(selected, 'yyyy-MM-dd')]}` : ''}
            </p>
          </div>
          {onAdd && (
            <Button type="button" size="sm" className="gap-1 h-8" onClick={() => onAdd(selected)}>
              Ajouter
            </Button>
          )}
        </div>
        {selectedList.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Aucune vacation ce jour.</p>
        ) : selectedList.map((m) => {
          const prise = priseByMission[m.id] || priseByMission[`site-${m.site_id}-${normalizeDateKey(m.date)}`];
          const enCours = prise?.status === 'en_service' || currentService?.mission_id === m.id || currentService?.id === prise?.id;
          const site = siteById[m.site_id];
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onOpenMission?.(m, { enCours, prise })}
              className="w-full text-left rounded-xl border border-border p-3 hover:bg-muted/30 space-y-1.5"
            >
              <div className="flex flex-wrap gap-1.5">
                <Badge className="bg-emerald-500 text-white">Planifié</Badge>
                {enCours
                  ? <Badge className="bg-blue-600 text-white">En cours</Badge>
                  : <Badge className="bg-amber-300 text-amber-950">En attente</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">
                Le {normalizeDateKey(m.date).split('-').reverse().join('/')} de {m.start_time || '—'} à {m.end_time || '—'}
              </p>
              <Badge className="bg-blue-600 text-white">{m.title || m.type || 'Gardiennage & Surveillance'}</Badge>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold flex items-center gap-1.5">
                    {m.site_name}
                    <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                  </p>
                  {(site?.address || m.site_address) && (
                    <p className="text-xs text-muted-foreground">{site?.address || m.site_address}{site?.postal_code ? `, ${site.postal_code}` : ''} {site?.city || ''}</p>
                  )}
                </div>
              </div>
              {m.agent_name && (
                <div className="rounded-md bg-emerald-100 text-emerald-900 text-xs font-medium px-2 py-1.5">
                  Agent des services — <span className="font-semibold">{m.agent_name}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
