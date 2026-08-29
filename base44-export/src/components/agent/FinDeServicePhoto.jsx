import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Camera, MapPin, RotateCcw, AlertCircle, ScanLine } from 'lucide-react';
import { format } from 'date-fns';
import NfcScanner from '@/components/nfc/NfcScanner';
import { resolveFinMode, expectedEndNfc, nfcMatches, isWithinSiteGeofence } from '@/lib/serviceStartRules';

/** Fin de service certifiée : selfie + NFC ou géofence selon le site. */
export default function FinDeServicePhoto({ service, companyId, agentId, agentName, onSuccess }) {
  const [step, setStep] = useState('camera');
  const [loading, setLoading] = useState(false);
  const [photoBlob, setPhotoBlob] = useState(null);
  const [photoURL, setPhotoURL] = useState(null);
  const [position, setPosition] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [nfcTag, setNfcTag] = useState('');
  const [gateError, setGateError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const { data: site } = useQuery({
    queryKey: ['site_prise', service?.site_id],
    queryFn: () => base44.entities.Site.get(service.site_id),
    enabled: !!service?.site_id,
  });

  const mode = resolveFinMode(site);
  const expectedNfc = expectedEndNfc(site);

  useEffect(() => {
    startCamera();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setPosition({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => {},
        { timeout: 10000, enableHighAccuracy: true },
      );
    }
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraError(null);
    } catch {
      setCameraError("Impossible d'accéder à la caméra selfie.");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
  };

  const takePhoto = () => {
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoRef.current, 0, 0);
    canvas.toBlob((blob) => {
      setPhotoBlob(blob);
      setPhotoURL(URL.createObjectURL(blob));
      stopCamera();
      setStep('preview');
    }, 'image/jpeg', 0.85);
  };

  const validateGates = () => {
    if (mode === 'nfc') {
      if (!expectedNfc) return 'Aucun badge NFC de fin de service n’est paramétré sur ce site.';
      if (!nfcTag) return 'Badgez le NFC de fin de service.';
      if (!nfcMatches(expectedNfc, nfcTag)) return 'Badge NFC incorrect pour la fin de service.';
    }
    if (mode === 'geolocalisation') {
      if (!position) return 'Géolocalisation en cours…';
      const geo = isWithinSiteGeofence(position, site);
      if (!geo.ok) return geo.reason;
    }
    return '';
  };

  const handleConfirm = async () => {
    if (!photoBlob || !service) return;
    const blocked = validateGates();
    if (blocked) { setGateError(blocked); return; }
    setLoading(true);
    try {
      const photoFile = new File([photoBlob], `fin_service_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file: photoFile });
      const now = format(new Date(), 'HH:mm');
      const today = format(new Date(), 'yyyy-MM-dd');

      await base44.entities.PriseDeService.update(service.id, {
        actual_end: now,
        status: 'termine',
        end_latitude: position?.latitude,
        end_longitude: position?.longitude,
        end_photo_url: file_url,
        nfc_end_validated: mode === 'nfc',
        nfc_end_tag_id: nfcTag || undefined,
        certified: true,
      });

      await base44.entities.MainCourante.create({
        company_id: companyId,
        site_id: service.site_id,
        site_name: service.site_name,
        client_name: service.client_name,
        agent_id: agentId,
        agent_name: agentName,
        mission_id: service.mission_id,
        date: today,
        time: now,
        type: 'depart',
        event_type: 'fin_service',
        content: `Fin de service certifiée (selfie + ${mode === 'nfc' ? 'NFC' : mode === 'geolocalisation' ? 'géolocalisation' : 'GPS'}) — ${agentName} à ${now}`,
        latitude: position?.latitude,
        longitude: position?.longitude,
        photo_url: file_url,
        severity: 'normal',
      });

      await base44.entities.Alerte.create({
        company_id: companyId,
        type: 'fin_service',
        agent_id: agentId,
        agent_name: agentName,
        site_id: service.site_id,
        site_name: service.site_name,
        client_name: service.client_name,
        message: `${agentName} a terminé son service (pointage certifié) sur ${service.site_name} à ${now}`,
        latitude: position?.latitude,
        longitude: position?.longitude,
        date: today,
        time: now,
        severity: 'info',
      });

      setStep('done');
      onSuccess?.();
    } catch (err) {
      setCameraError(err.message || 'Erreur lors de la fin de service');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'done') {
    return (
      <div className="text-center py-8 space-y-3">
        <CheckCircle2 className="w-14 h-14 text-green-600 mx-auto" />
        <p className="font-semibold">Service terminé et certifié</p>
        <p className="text-sm text-muted-foreground">Selfie et pointage enregistrés</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="font-semibold">Fin de service certifiée</p>
        <p className="text-sm text-muted-foreground">{service?.site_name}</p>
      </div>

      {mode === 'nfc' && (
        <div>
          <p className="text-sm font-medium flex items-center gap-2 mb-2"><ScanLine className="w-4 h-4" /> Badge NFC de fin de service</p>
          <NfcScanner value={nfcTag} onChange={setNfcTag} autoStart compact />
        </div>
      )}

      {mode === 'geolocalisation' && (
        <p className="text-xs p-3 rounded-xl bg-muted">
          <MapPin className="w-3.5 h-3.5 inline mr-1" />
          {position && isWithinSiteGeofence(position, site).ok
            ? 'Dans le périmètre — fin de service autorisée'
            : (isWithinSiteGeofence(position || {}, site).reason || 'GPS en cours…')}
        </p>
      )}

      {cameraError && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4" /> {cameraError}
        </div>
      )}
      {gateError && (
        <div className="flex items-center gap-2 text-sm text-amber-800 bg-amber-50 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4" /> {gateError}
        </div>
      )}

      {step === 'camera' && (
        <div className="space-y-3">
          <div className="relative rounded-xl overflow-hidden bg-black aspect-[3/4] max-h-[360px]">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <MapPin className="w-3.5 h-3.5" />
            {position ? `GPS ${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}` : 'GPS en cours…'}
          </div>
          <Button className="w-full gap-2" onClick={takePhoto} disabled={!!cameraError}>
            <Camera className="w-4 h-4" /> Prendre le selfie
          </Button>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-3">
          <img src={photoURL} alt="Fin de service" className="w-full rounded-xl" />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 gap-2" onClick={() => { setStep('camera'); setPhotoBlob(null); startCamera(); }}>
              <RotateCcw className="w-4 h-4" /> Reprendre
            </Button>
            <Button className="flex-1" onClick={handleConfirm} disabled={loading || !!validateGates()}>
              {loading ? 'Enregistrement…' : 'Confirmer la fin'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
