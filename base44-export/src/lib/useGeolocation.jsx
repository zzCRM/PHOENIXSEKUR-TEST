import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';

export function useGeolocation({ active, agentId, agentName, serviceId, siteId, siteName, companyId }) {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const watchIdRef = useRef(null);
  const lastSaveRef = useRef(0);

  useEffect(() => {
    if (!active || !agentId || !companyId) {
      // Stop tracking if not active
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setPosition(null);
      return;
    }

    if (!navigator.geolocation) {
      setError('Géolocalisation non supportée');
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setPosition({ latitude, longitude, accuracy });

        // Save to DB every 30 seconds
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
          } catch (e) {
            // Silently ignore save errors
          }
        }
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [active, agentId, companyId]);

  return { position, error };
}