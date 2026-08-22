import React, { useEffect, useRef, useState } from 'react';
import { Users, Clock, Layers } from 'lucide-react';
import { format, subMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import { loadGoogleMaps } from '@/lib/googlePlaces';

const enc = (svg) => 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);

const personSvg = (recent) => `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 34 42">
  <ellipse cx="17" cy="41" rx="7" ry="2" fill="rgba(0,0,0,0.25)"/>
  <circle cx="17" cy="9" r="6.5" fill="#F4D03F" stroke="#1f2937" stroke-width="1.6"/>
  <path d="M6 38c0-7.7 4.6-13 11-13s11 5.3 11 13" fill="#F4D03F" stroke="#1f2937" stroke-width="1.6"/>
  ${recent ? '<circle cx="28" cy="30" r="5" fill="#22c55e" stroke="#fff" stroke-width="1.5"/>' : '<circle cx="28" cy="30" r="5" fill="#f59e0b" stroke="#fff" stroke-width="1.5"/>'}
</svg>`;

const siteSvg = (n) => `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 34 44">
  <path d="M17 1C9.3 1 3 7.1 3 14.6 3 24.5 17 43 17 43s14-18.5 14-28.4C31 7.1 24.7 1 17 1z" fill="#0f766e" stroke="#fff" stroke-width="2.5"/>
  <text x="17" y="20" text-anchor="middle" font-size="13" font-weight="700" fill="#fff" font-family="Inter,Arial,sans-serif">${n || '•'}</text>
</svg>`;

export default function SupervisionMap({ hqAddress, positions, agentPositions, sites, services }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [noKey, setNoKey] = useState(false);
  const [ready, setReady] = useState(false);
  const [mapType, setMapType] = useState('roadmap');
  const [loadError, setLoadError] = useState('');
  const markersRef = useRef([]);
  const infoRef = useRef(null);

  // Init map
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadGoogleMaps().then((gmaps) => {
      if (cancelled || !containerRef.current) return;
      const map = new gmaps.Map(containerRef.current, {
        center: { lat: 46.6, lng: 2.6 },
        zoom: 6,
        mapTypeControl: false,
        streetViewControl: true,
        fullscreenControl: true,
        zoomControl: true,
        gestureHandling: 'greedy',
        styles: [{ featureType: 'all', elementType: 'labels', stylers: [{ visibility: 'on' }] }],
      });
      infoRef.current = new gmaps.InfoWindow();
      mapRef.current = { map, gmaps };
      setReady(true);
      setLoading(false);

      // Center on HQ address
      const applyCenter = (lat, lng) => {
        if (cancelled) return;
        map.setCenter({ lat, lng });
        map.setZoom(13);
      };
      const centerOnHq = async () => {
        if (!hqAddress) { fitToSites(); return; }
        // Try Google Geocoder first
        try {
          const res = await new Promise((resolve) => {
            new gmaps.Geocoder().geocode({ address: hqAddress, region: 'FR' }, (r, s) => resolve({ r, s }));
          });
          if (res.s === 'OK' && res.r?.[0]?.geometry?.location) {
            const loc = res.r[0].geometry.location;
            applyCenter(loc.lat(), loc.lng());
            return;
          }
        } catch (e) { /* fall through */ }
        // Fallback: OpenStreetMap Nominatim (no API key required)
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(hqAddress)}`);
          const data = await r.json();
          if (data?.[0]?.lat && data?.[0]?.lon) {
            applyCenter(parseFloat(data[0].lat), parseFloat(data[0].lon));
            return;
          }
        } catch (e) { /* ignore */ }
        fitToSites();
      };
      const fitToSites = () => {
        const pts = (sites || []).filter(s => s.latitude && s.longitude).map(s => new gmaps.LatLng(s.latitude, s.longitude));
        if (pts.length) {
          const bounds = new gmaps.LatLngBounds();
          pts.forEach(p => bounds.extend(p));
          map.fitBounds(bounds);
          if (map.getZoom() > 15) map.setZoom(15);
        }
      };
      mapRef.current.centerOnHq = centerOnHq;
      mapRef.current.fitToSites = fitToSites;
      centerOnHq();
    }).catch((e) => {
      if (cancelled) return;
      setLoadError(e.message || 'Erreur Google Maps');
      if (/No Google Maps API key/i.test(e.message || '')) setNoKey(true);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  // Recenter when HQ address or sites become available
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    if (mapRef.current.centerOnHq) mapRef.current.centerOnHq();
  }, [ready, hqAddress, sites]);

  // Render markers
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const { map, gmaps } = mapRef.current;
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    const isRecent = (ts) => ts && new Date(ts) > subMinutes(new Date(), 5);
    const activeServices = (services || []).filter(s => s.status === 'en_service');

    // Sites
    (sites || []).filter(s => s.latitude && s.longitude).forEach(s => {
      const n = activeServices.filter(svc => svc.site_id === s.id).length;
      const marker = new gmaps.Marker({
        position: { lat: s.latitude, lng: s.longitude },
        map,
        icon: { url: enc(siteSvg(n)), scaledSize: new gmaps.Size(36, 48), anchor: new gmaps.Point(18, 46) },
        zIndex: 100,
      });
      marker.addListener('click', () => {
        infoRef.current.setContent(`<div style="font-family:Inter,sans-serif;min-width:160px">
          <div style="font-weight:600;font-size:13px">${s.name}</div>
          ${s.client_name ? `<div style="font-size:11px;color:#64748b">${s.client_name}</div>` : ''}
          ${s.address ? `<div style="font-size:11px;color:#64748b;margin-top:2px">${s.address}</div>` : ''}
          <div style="font-size:11px;margin-top:6px;display:flex;align-items:center;gap:4px">👥 ${n} agent(s) en service</div>
        </div>`);
        infoRef.current.open(map, marker);
      });
      markersRef.current.push(marker);
    });

    // Agents
    activeServices.forEach(svc => {
      const p = agentPositions[svc.agent_id];
      if (!p || !p.latitude) return;
      const recent = isRecent(p.timestamp);
      const marker = new gmaps.Marker({
        position: { lat: p.latitude, lng: p.longitude },
        map,
        icon: { url: enc(personSvg(recent)), scaledSize: new gmaps.Size(36, 46), anchor: new gmaps.Point(18, 44) },
        zIndex: 200,
      });
      marker.addListener('click', () => {
        infoRef.current.setContent(`<div style="font-family:Inter,sans-serif;min-width:170px">
          <div style="font-weight:600;font-size:13px">${svc.agent_name}</div>
          <div style="font-size:11px;color:#64748b">${svc.site_name || ''}</div>
          <div style="font-size:11px;margin-top:4px">🕐 Depuis ${svc.actual_start || '—'}</div>
          <div style="font-size:11px;color:${recent ? '#16a34a' : '#d97706'}">${recent ? '● En ligne' : '● Vu ' + (p.timestamp ? new Date(p.timestamp).toLocaleTimeString('fr-FR').slice(0,5) : '')}</div>
        </div>`);
        infoRef.current.open(map, marker);
      });
      markersRef.current.push(marker);
    });
  }, [ready, positions, agentPositions, sites, services]);

  const switchType = (type) => {
    setMapType(type);
    if (mapRef.current) mapRef.current.map.setMapTypeId(type);
  };

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" style={{ background: '#e8eef2' }} />
      {(loading || noKey) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground bg-slate-100">
          {loading ? (
            <>
              <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-3" />
              <p className="font-medium">Chargement de la carte…</p>
            </>
          ) : (
            <>
              <Layers className="w-12 h-12 mb-3 opacity-30" />
              <p className="font-semibold">Clé Google Maps requise</p>
              <p className="text-sm mt-1">Configurez GOOGLE_MAPS_API_KEY dans les paramètres.</p>
            </>
          )}
        </div>
      )}
      {/* Plan / Satellite toggle */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex bg-white rounded-full shadow-lg overflow-hidden border border-border/60 pointer-events-auto">
        <button
          onClick={() => switchType('roadmap')}
          className={`px-3.5 py-1.5 text-sm font-medium transition-colors ${mapType === 'roadmap' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
        >Plan</button>
        <button
          onClick={() => switchType('satellite')}
          className={`px-3.5 py-1.5 text-sm font-medium transition-colors ${mapType === 'satellite' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
        >Satellite</button>
      </div>
      {loadError && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-red-50 text-red-700 text-xs px-3 py-2 rounded-lg border border-red-200 shadow">
          {loadError}
        </div>
      )}
    </div>
  );
}