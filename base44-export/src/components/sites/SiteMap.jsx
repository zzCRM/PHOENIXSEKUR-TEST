import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, MapPin } from 'lucide-react';
import { loadGoogleMaps } from '@/lib/googlePlaces';

const pinSvg = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44">
    <path d="M17 1C9.3 1 3 7.1 3 14.6 3 24.5 17 43 17 43s14-18.5 14-28.4C31 7.1 24.7 1 17 1z" fill="#dc2626" stroke="#fff" stroke-width="2.5"/>
    <circle cx="17" cy="15" r="5" fill="#fff"/>
  </svg>`
);

export default function SiteMap({ address, lat, lng, onLocate }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const geocoderRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [noKey, setNoKey] = useState(false);
  const [mapType, setMapType] = useState('roadmap');
  const [loadError, setLoadError] = useState('');
  const debounceRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadGoogleMaps().then((gmaps) => {
      if (cancelled || !containerRef.current) return;
      const center = (lat && lng) ? { lat, lng } : { lat: 46.6, lng: 2.6 };
      const map = new gmaps.Map(containerRef.current, {
        center,
        zoom: (lat && lng) ? 15 : 6,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        gestureHandling: 'greedy',
      });
      const marker = new gmaps.Marker({
        position: center,
        map,
        icon: { url: pinSvg, scaledSize: new gmaps.Size(34, 44), anchor: new gmaps.Point(17, 43) },
        draggable: true,
      });
      geocoderRef.current = new gmaps.Geocoder();
      markerRef.current = marker;
      mapRef.current = { map, gmaps };
      marker.addListener('dragend', () => {
        const p = marker.getPosition();
        onLocate?.(p.lat(), p.lng());
      });
      setLoading(false);
    }).catch((e) => {
      if (cancelled) return;
      setLoadError(e.message || 'Erreur Google Maps');
      if (/No Google Maps API key/i.test(e.message || '')) setNoKey(true);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  // Geocode when address changes (debounced)
  useEffect(() => {
    if (!mapRef.current || !geocoderRef.current || !address) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const { gmaps } = mapRef.current;
      geocoderRef.current.geocode({ address, region: 'FR' }, (results, status) => {
        if (status === 'OK' && results?.[0]?.geometry?.location) {
          const loc = results[0].geometry.location;
          mapRef.current.map.setCenter(loc);
          mapRef.current.map.setZoom(16);
          markerRef.current.setPosition(loc);
          onLocate?.(loc.lat(), loc.lng());
        }
      });
    }, 900);
  }, [address]);

  const switchType = (type) => {
    setMapType(type);
    if (mapRef.current) mapRef.current.map.setMapTypeId(type);
  };

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden border border-border">
      <div ref={containerRef} className="w-full h-full" style={{ background: '#e8eef2' }} />
      {(loading || noKey) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground bg-slate-100 rounded-lg">
          {noKey ? (
            <>
              <MapPin className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-xs font-medium">Clé Google Maps requise</p>
            </>
          ) : (
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          )}
        </div>
      )}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] flex bg-white rounded-full shadow-lg overflow-hidden border border-border/60">
        <button onClick={() => switchType('roadmap')}
          className={`px-3 py-1 text-xs font-medium transition-colors ${mapType === 'roadmap' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}>Plan</button>
        <button onClick={() => switchType('satellite')}
          className={`px-3 py-1 text-xs font-medium transition-colors ${mapType === 'satellite' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}>Satellite</button>
      </div>
      {loadError && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[1000] bg-red-50 text-red-700 text-xs px-2.5 py-1.5 rounded-lg border border-red-200 shadow">
          {loadError}
        </div>
      )}
    </div>
  );
}