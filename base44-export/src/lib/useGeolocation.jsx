import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { isOutsideGeofence } from '@/lib/geoUtils';

export function useGeolocation({
  active,
  agentId,
  agentName,
  serviceId,
  siteId,
  siteName,
  companyId,
  siteLatitude,
  siteLongitude,
  geofenceRadius = 200,
  onGeofenceViolation,
}) {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [outsideZone, setOutsideZone] = useState(false);
  const watchIdRef = useRef(null);
  const lastSaveRef = useRef(0);
  const lastGeofenceAlertRef = useRef(0);

  useEffect(() => {
    if (!active || !agentId || !companyId) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setPosition(null);
      setOutsideZone(false);
      return undefined;
    }

    if (!navigator.geolocation) {
      setError('Géolocalisation non supportée');
      return undefined;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setPosition({ latitude, longitude, accuracy });

        if (siteLatitude != null && siteLongitude != null) {
          const outside = isOutsideGeofence(
            latitude, longitude, siteLatitude, siteLongitude, geofenceRadius,
          );
          setOutsideZone(outside);
          const now = Date.now();
          if (outside && onGeofenceViolation && now - lastGeofenceAlertRef.current > 120000) {
            lastGeofenceAlertRef.current = now;
            onGeofenceViolation({ latitude, longitude, accuracy });
          }
        }

        const now = Date.now();
        if (now - lastSaveRef.current > 30000) {
          lastSaveRef.current = now;
          const timestamp = new Date().toISOString();
          const today = format(new Date(), 'yyyy-MM-dd');
          try {
            await base44.entities.Geolocation.create({
              company_id: companyId,
              agent_id: agentId,
              agent_name: agentName || '',
              service_id: serviceId || '',
              site_id: siteId || '',
              site_name: siteName || '',
              latitude,
              longitude,
              accuracy,
              timestamp,
              date: today,
            });
          } catch {
            /* ignore */
          }
        }
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [
    active, agentId, companyId, agentName, serviceId, siteId, siteName,
    siteLatitude, siteLongitude, geofenceRadius, onGeofenceViolation,
  ]);

  return { position, error, outsideZone };
}
