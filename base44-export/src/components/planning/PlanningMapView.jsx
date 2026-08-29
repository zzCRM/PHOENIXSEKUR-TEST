import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { format, addDays, startOfWeek, isSameDay, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeDateKey } from '@/lib/recurrenceExpand';
import { geocodeAddress, siteAddress, siteLatLng } from '@/lib/siteCoords';
import 'leaflet/dist/leaflet.css';

const FR_CENTER = [46.7, 2.5];

function pinIcon(active, status) {
  const fill = status === 'en_cours' ? '#2563eb' : status === 'terminee' ? '#14b8a6' : '#10b981';
  const scale = active ? 1.15 : 1;
  return L.divIcon({
    className: 'carte-pin',
    iconSize: [36 * scale, 46 * scale],
    iconAnchor: [18 * scale, 44 * scale],
    html: `<div style="transform:scale(${scale});transform-origin:bottom center">
      <svg width="36" height="46" viewBox="0 0 36 46" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="18" cy="43" rx="7" ry="2.2" fill="rgba(0,0,0,.25)"/>
        <path d="M18 2C10.3 2 4 8.2 4 15.8 4 26.2 18 44 18 44s14-17.8 14-28.2C32 8.2 25.7 2 18 2z" fill="${fill}" stroke="#fff" stroke-width="2.4"/>
        <circle cx="18" cy="16" r="5.2" fill="#fff"/>
      </svg>
    </div>`,
  });
}

function FitPins({ points, focus }) {
  const map = useMap();
  const key = `${points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|')}|${focus?.lat || ''}`;
  useEffect(() => {
    if (focus) {
      map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 15), { duration: 0.45 });
      return;
    }
    if (!points.length) {
      map.setView(FR_CENTER, 6);
      return;
    }
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 14);
      return;
    }
    map.fitBounds(points.map((p) => [p.lat, p.lng]), { padding: [48, 80], maxZoom: 14 });
  }, [map, key]);
  return null;
}

function dayList(missions, day) {
  const key = format(day, 'yyyy-MM-dd');
  return missions
    .filter((m) => normalizeDateKey(m.date) === key && m.status !== 'annulee')
    .sort((a, b) => String(a.start_time || '').localeCompare(String(b.start_time || '')));
}

export default function PlanningMapView({
  missions = [],
  sites = [],
  prises = [],
  selected,
  onSelectDay,
  onOpenMission,
  compact = false,
  immersive = false,
  currentService,
}) {
  const [extraCoords, setExtraCoords] = useState({});
  const [focusId, setFocusId] = useState(null);
  const scrollerRef = useRef(null);
  const day = selected || new Date();
  const list = useMemo(() => dayList(missions, day), [missions, day]);
  const siteById = useMemo(() => Object.fromEntries(sites.map((s) => [s.id, s])), [sites]);

  const week = useMemo(() => {
    const start = startOfWeek(day, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [day]);

  const priseByMission = useMemo(() => {
    const map = {};
    prises.forEach((p) => {
      if (p.mission_id) map[p.mission_id] = p;
    });
    return map;
  }, [prises]);

  const listKey = list.map((m) => m.id || `${m.site_id}-${m.start_time}`).join('|');
  useEffect(() => {
    let cancelled = false;
    const missing = [];
    list.forEach((m) => {
      const site = siteById[m.site_id];
      if (siteLatLng(site)) return;
      const addr = siteAddress(site) || [m.site_address, m.site_name, m.client_name].filter(Boolean).join(', ');
      if (addr) missing.push({ key: m.site_id || m.site_name, addr });
    });
    const unique = [...new Map(missing.map((x) => [x.key, x])).values()].slice(0, 6);
    (async () => {
      for (const item of unique) {
        const pos = await geocodeAddress(item.addr);
        if (cancelled || !pos) continue;
        setExtraCoords((prev) => (prev[item.key] ? prev : { ...prev, [item.key]: pos }));
      }
    })();
    return () => { cancelled = true; };
  }, [listKey]);

  const pins = useMemo(() => {
    const seen = new Map();
    list.forEach((m) => {
      const site = siteById[m.site_id];
      const pos = siteLatLng(site) || extraCoords[m.site_id] || extraCoords[m.site_name];
      if (!pos) return;
      const id = m.site_id || m.site_name || m.id;
      if (!seen.has(id)) seen.set(id, { id, ...pos, mission: m, count: 1 });
      else seen.get(id).count += 1;
    });
    return [...seen.values()];
  }, [list, siteById, extraCoords]);

  const focusPin = pins.find((p) => p.id === focusId) || pins[0] || null;

  const dayKey = format(day, 'yyyy-MM-dd');
  useEffect(() => {
    if (!list.length) { setFocusId(null); return; }
    const first = list[0];
    setFocusId(first.site_id || first.site_name || first.id);
  }, [dayKey, list]);

  const ticketStatus = (m) => {
    const prise = priseByMission[m.id];
    if (prise?.status === 'en_service' || currentService?.mission_id === m.id) return 'en_cours';
    if (m.status === 'terminee') return 'terminee';
    return 'planifiee';
  };

  return (
    <div className={cn(
      'relative overflow-hidden bg-[#e8eef2]',
      immersive
        ? 'h-[calc(100dvh-3.25rem)] xl:h-[calc(100dvh-5.5rem)] rounded-none xl:rounded-3xl xl:border xl:border-border z-0 isolate'
        : compact
          ? 'h-[68dvh] min-h-[420px] rounded-none xl:rounded-3xl xl:border xl:border-border z-0 isolate'
          : 'h-[min(78dvh,720px)] rounded-3xl border border-border z-0 isolate',
    )}>
      <MapContainer
        center={focusPin ? [focusPin.lat, focusPin.lng] : FR_CENTER}
        zoom={focusPin ? 14 : 6}
        className="h-full w-full z-0"
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          attribution='&copy; OSM &copy; CARTO'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <FitPins points={pins} focus={focusPin} />
        {focusPin && (
          <CircleMarker
            center={[focusPin.lat, focusPin.lng]}
            radius={18}
            pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.12, weight: 1 }}
          />
        )}
        {pins.map((p) => (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={pinIcon(p.id === focusPin?.id, ticketStatus(p.mission))}
            eventHandlers={{
              click: () => {
                setFocusId(p.id);
                const el = scrollerRef.current?.querySelector(`[data-site="${p.id}"]`);
                el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
              },
            }}
          />
        ))}
      </MapContainer>

      <div className={cn('absolute left-3 right-3 z-10 pointer-events-none', immersive ? 'top-[4.25rem]' : 'top-3')}>
        <div className="pointer-events-auto rounded-2xl bg-white/90 backdrop-blur-md shadow-lg border border-white/70 px-3 py-2">
          <p className="text-[11px] font-medium text-muted-foreground capitalize">
            {format(day, 'EEEE d MMMM yyyy', { locale: fr })}
          </p>
          <div className="mt-1.5 flex gap-1 overflow-x-auto tabs-scroll">
            {week.map((d) => {
              const n = dayList(missions, d).length;
              const on = isSameDay(d, day);
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => onSelectDay?.(d)}
                  className={cn(
                    'shrink-0 w-10 h-12 rounded-xl flex flex-col items-center justify-center text-xs',
                    on ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100',
                    !on && isToday(d) && 'ring-1 ring-emerald-500',
                  )}
                >
                  <span className="text-[9px] uppercase opacity-70">{format(d, 'EEEEE', { locale: fr })}</span>
                  <span className="font-semibold">{format(d, 'd')}</span>
                  {n > 0 && <span className={cn('w-1 h-1 rounded-full mt-0.5', on ? 'bg-emerald-300' : 'bg-emerald-500')} />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 inset-x-0 z-10 bg-gradient-to-t from-black/25 to-transparent pt-10 pb-3">
        <div ref={scrollerRef} className="flex gap-2.5 overflow-x-auto tabs-scroll px-3 snap-x snap-mandatory">
          {list.length === 0 ? (
            <div className="mx-auto mb-1 rounded-2xl bg-white/95 px-4 py-3 text-sm text-muted-foreground shadow">
              Aucune vacation ce jour.
            </div>
          ) : list.map((m) => {
            const st = ticketStatus(m);
            const siteId = m.site_id || m.site_name || m.id;
            const active = siteId === focusId;
            return (
              <button
                key={m.id}
                type="button"
                data-site={siteId}
                onClick={() => {
                  setFocusId(siteId);
                  onOpenMission?.(m, { enCours: st === 'en_cours' });
                }}
                className={cn(
                  'snap-center shrink-0 w-[78%] max-w-[280px] rounded-2xl bg-white text-left p-3 shadow-xl border transition-transform',
                  active ? 'border-emerald-500 scale-[1.02]' : 'border-white/80',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-sm">{m.start_time || '—'} – {m.end_time || '—'}</p>
                  <span className={cn(
                    'w-2.5 h-2.5 rounded-full',
                    st === 'en_cours' ? 'bg-blue-500' : st === 'terminee' ? 'bg-teal-500' : 'bg-emerald-500',
                  )}
                  />
                </div>
                <p className="font-bold mt-1 truncate">{m.site_name || 'Site'}</p>
                <p className="text-xs text-muted-foreground truncate">{m.agent_name || 'Non assigné'}</p>
                <p className="text-[11px] mt-1 text-emerald-700 font-medium">
                  {st === 'en_cours' ? 'En cours' : st === 'terminee' ? 'Terminée' : 'Planifié'}
                </p>
              </button>
            );
          })}
        </div>
        {!pins.length && list.length > 0 && (
          <p className="px-4 pt-2 text-[11px] text-white/90 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> Ajoutez l’adresse GPS du site pour le pin sur la carte.
          </p>
        )}
      </div>
    </div>
  );
}
