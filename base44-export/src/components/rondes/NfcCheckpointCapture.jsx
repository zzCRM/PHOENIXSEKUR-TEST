import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import NfcScanner from '@/components/nfc/NfcScanner';

/**
 * NfcCheckpointCapture
 * Handles NFC scan + automatic geolocation for a checkpoint.
 * Props:
 *   onCapture({ nfc_tag_id, latitude, longitude }) — called when both NFC + GPS are ready
 *   initialNfc — pre-filled NFC id (edit mode)
 *   initialLat / initialLng — pre-filled coords (edit mode)
 */
export default function NfcCheckpointCapture({ onCapture, initialNfc = '', initialLat = '', initialLng = '' }) {
  const [nfcId, setNfcId] = useState(initialNfc);
  const [geoStatus, setGeoStatus] = useState('idle'); // idle | loading | success | error
  const [lat, setLat] = useState(initialLat);
  const [lng, setLng] = useState(initialLng);

  const handleNfcChange = (id) => setNfcId(id);

  // Auto-trigger geolocation on mount
  useEffect(() => {
    if (!initialLat && !initialLng) {
      captureGeo();
    } else {
      setGeoStatus('success');
    }
  }, []);

  // Notify parent when NFC or GPS ready
  useEffect(() => {
    if (nfcId || (lat && lng)) {
      onCapture({ nfc_tag_id: nfcId, latitude: lat, longitude: lng });
    }
  }, [nfcId, lat, lng]);

  const captureGeo = () => {
    if (!navigator.geolocation) {
      setGeoStatus('error');
      return;
    }
    setGeoStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newLat = pos.coords.latitude.toFixed(6);
        const newLng = pos.coords.longitude.toFixed(6);
        setLat(newLat);
        setLng(newLng);
        setGeoStatus('success');
      },
      (err) => {
        console.warn('Geo error:', err);
        setGeoStatus('error');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  return (
    <div className="space-y-3">
      {/* NFC Block — scanner de qualité */}
      <NfcScanner value={nfcId} onChange={handleNfcChange} compact />

      {/* Geolocation Block */}
      <div className={`border rounded-lg p-3 flex items-center gap-3 ${
        geoStatus === 'success' ? 'border-green-200 bg-green-50' :
        geoStatus === 'error' ? 'border-amber-200 bg-amber-50' :
        'border-border bg-muted/10'
      }`}>
        {geoStatus === 'loading' && <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />}
        {geoStatus === 'success' && <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />}
        {geoStatus === 'error' && <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />}
        {geoStatus === 'idle' && <MapPin className="w-5 h-5 text-muted-foreground shrink-0" />}

        <div className="flex-1 min-w-0">
          {geoStatus === 'loading' && <p className="text-sm text-primary">Localisation en cours...</p>}
          {geoStatus === 'success' && (
            <div>
              <p className="text-sm font-semibold text-green-700">Position capturée</p>
              <p className="text-xs font-mono text-muted-foreground truncate">{lat}, {lng}</p>
            </div>
          )}
          {geoStatus === 'error' && (
            <div>
              <p className="text-sm text-amber-700">Localisation non disponible</p>
              <p className="text-xs text-muted-foreground">Autorisez la géolocalisation dans Chrome</p>
            </div>
          )}
          {geoStatus === 'idle' && <p className="text-sm text-muted-foreground">Position GPS non capturée</p>}
        </div>

        {(geoStatus === 'error' || geoStatus === 'success') && (
          <Button type="button" size="sm" variant="ghost" onClick={captureGeo} className="shrink-0">
            <MapPin className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}