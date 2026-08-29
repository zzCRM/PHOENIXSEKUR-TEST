import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Camera, MapPin, RotateCcw, AlertCircle, Clock, ScanLine } from 'lucide-react';
import { format } from 'date-fns';
import NfcScanner from '@/components/nfc/NfcScanner';
import {
  canStartPlannedService,
  resolvePriseMode,
  expectedStartNfc,
  nfcMatches,
  isWithinSiteGeofence,
} from '@/lib/serviceStartRules';
import { primePtiOnUserGesture } from '@/lib/useFallDetection';

export default function PriseDeServiceNFC({ mission, companyId, agentId, agentName, onSuccess }) {
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
    queryKey: ['site_prise', mission?.site_id],
    queryFn: () => base44.entities.Site.get(mission.site_id),
    enabled: !!mission?.site_id,
  });

  const mode = resolvePriseMode(site);
  const expectedNfc = expectedStartNfc(site);
  const timeCheck = canStartPlannedService(mission);

  useEffect(() => {
    startCamera();
    getPosition();
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
      setCameraError("Impossible d'accéder à la caméra selfie. Autorisez l'appareil photo avant.");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
  };

  const getPosition = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setPosition({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => {},
      { timeout: 10000, enableHighAccuracy: true },
    );
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

  const retakePhoto = () => {
    setPhotoBlob(null);
    setPhotoURL(null);
    setStep('camera');
    startCamera();
  };

  const validateGates = () => {
    if (!timeCheck.ok) return timeCheck.reason;
    if (mode === 'nfc') {
      if (!expectedNfc) return 'Aucun badge NFC de prise de service n’est paramétré sur ce site. Contactez votre société.';
      if (!nfcTag) return 'Badgez le NFC de prise de service pour continuer.';
      if (!nfcMatches(expectedNfc, nfcTag)) return 'Badge NFC incorrect. Approchez le tag de prise de service du site.';
    }
    if (mode === 'geolocalisation') {
      if (!position) return 'Géolocalisation en cours… restez sur le site.';
      const geo = isWithinSiteGeofence(position, site);
      if (!geo.ok) return geo.reason;
    }
    return '';
  };

  const handleStart = async () => {
    if (!photoBlob) return;
    const blocked = validateGates();
    if (blocked) { setGateError(blocked); return; }
    setLoading(true);
    setGateError('');
    primePtiOnUserGesture();

    try {
      const photoFile = new File([photoBlob], `service_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const { file_url: photoUploadUrl } = await base44.integrations.Core.UploadFile({ file: photoFile });

      const now = format(new Date(), 'HH:mm');
      const today = format(new Date(), 'yyyy-MM-dd');
      const late = timeCheck.late;
      const mcType = late ? 'debut_service_retard' : 'debut_service';

      const created = await base44.entities.PriseDeService.create({
        company_id: companyId,
        agent_id: agentId,
        agent_name: agentName,
        mission_id: mission.id,
        site_id: mission.site_id,
        site_name: mission.site_name,
        client_name: mission.client_name,
        date: today,
        planned_start: mission.start_time,
        planned_end: mission.end_time,
        actual_start: now,
        started_at: new Date().toISOString(),
        unplanned: !!mission.unplanned,
        service_type: mission.type,
        status: 'en_service',
        start_photo_url: photoUploadUrl,
        start_latitude: position?.latitude,
        start_longitude: position?.longitude,
        nfc_validated: mode === 'nfc',
        nfc_tag_id: nfcTag || undefined,
        prise_mode: mode,
        pauses: [],
        certified: true,
      });

      await base44.entities.MainCourante.create({
        company_id: companyId,
        site_id: mission.site_id,
        site_name: mission.site_name,
        client_name: mission.client_name,
        agent_id: agentId,
        agent_name: agentName,
        mission_id: mission.id,
        service_id: created?.id,
        date: today,
        time: now,
        type: late ? 'arrivee' : 'arrivee',
        event_type: mcType,
        content: late
          ? `Début de service en retard — selfie + ${mode === 'nfc' ? 'NFC' : mode === 'geolocalisation' ? 'géolocalisation' : 'GPS'} — ${agentName} sur ${mission.site_name} à ${now} (prévu ${mission.start_time})`
          : `Prise de service certifiée (selfie + ${mode === 'nfc' ? 'NFC' : mode === 'geolocalisation' ? 'géolocalisation' : 'GPS'}) — ${agentName} sur ${mission.site_name} à ${now}`,
        latitude: position?.latitude,
        longitude: position?.longitude,
        photo_url: photoUploadUrl,
        severity: late ? 'attention' : 'normal',
      });

      await base44.entities.Alerte.create({
        company_id: companyId,
        type: late ? 'debut_service_retard' : 'debut_service',
        agent_id: agentId,
        agent_name: agentName,
        site_id: mission.site_id,
        site_name: mission.site_name,
        client_name: mission.client_name,
        message: `${agentName} a pris son service sur ${mission.site_name} à ${now}`,
        latitude: position?.latitude,
        longitude: position?.longitude,
        date: today,
        time: now,
        severity: late ? 'attention' : 'info',
      });

      setStep('done');
      setTimeout(() => onSuccess(), 1200);
    } catch (err) {
      setGateError(err.message || 'Impossible de démarrer le service');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'done') {
    return (
      <div className="text-center py-8">
        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-3" />
        <p className="text-lg font-bold text-green-600">Service démarré !</p>
        <p className="text-muted-foreground text-sm mt-1">{mission.site_name}</p>
      </div>
    );
  }

  if (!timeCheck.ok) {
    return (
      <div className="space-y-4 text-center py-4">
        <Clock className="w-12 h-12 text-amber-500 mx-auto" />
        <p className="font-semibold">Prise de service bloquée</p>
        <p className="text-sm text-muted-foreground">{timeCheck.reason}</p>
        <p className="text-xs text-muted-foreground">{mission.title} • {mission.start_time} - {mission.end_time}</p>
      </div>
    );
  }

  const gateMsg = gateError || (mode === 'nfc' && !expectedNfc
    ? 'Paramétrez le NFC de prise de service sur la fiche du site.'
    : '');

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-xl bg-muted/50">
        <p className="font-semibold text-sm">{mission.title}</p>
        <p className="text-xs text-muted-foreground">{mission.site_name} • {mission.start_time} - {mission.end_time}</p>
        <p className="text-[11px] mt-1 text-muted-foreground">
          {mode === 'nfc' && 'Mode : badge NFC obligatoire'}
          {mode === 'geolocalisation' && `Mode : géolocalisation (périmètre ${site?.geofence_radius || 200} m)`}
          {mode === 'libre' && 'Mode : selfie + GPS'}
        </p>
      </div>

      {mode === 'nfc' && (
        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2"><ScanLine className="w-4 h-4" /> Badge NFC de prise de service</p>
          <NfcScanner value={nfcTag} onChange={setNfcTag} autoStart compact />
        </div>
      )}

      {mode === 'geolocalisation' && (
        <div className={`text-xs p-3 rounded-xl ${position && isWithinSiteGeofence(position, site).ok ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>
          <MapPin className="w-3.5 h-3.5 inline mr-1" />
          {!position && 'Recherche GPS… placez-vous dans le périmètre du site.'}
          {position && isWithinSiteGeofence(position, site).ok && 'Vous êtes dans le périmètre autorisé.'}
          {position && !isWithinSiteGeofence(position, site).ok && isWithinSiteGeofence(position, site).reason}
        </div>
      )}

      <div className="relative rounded-xl overflow-hidden bg-black aspect-[3/4] max-h-[360px] mx-auto w-full">
        {step === 'camera' && !cameraError && (
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
        )}
        {step === 'preview' && photoURL && (
          <img src={photoURL} alt="Selfie" className="w-full h-full object-cover" />
        )}
        {cameraError && (
          <div className="flex items-center justify-center h-full p-4 text-center">
            <div>
              <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
              <p className="text-white text-sm">{cameraError}</p>
            </div>
          </div>
        )}
        <p className="absolute bottom-2 left-0 right-0 text-center text-white/80 text-xs">Selfie de prise de service</p>
      </div>

      {position && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="w-3 h-3 text-green-500" />
          GPS: {position.latitude.toFixed(5)}, {position.longitude.toFixed(5)}
        </p>
      )}

      {gateMsg && (
        <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {gateMsg}
        </div>
      )}

      {step === 'camera' && !cameraError && (
        <Button className="w-full gap-2" size="lg" onClick={takePhoto}>
          <Camera className="w-5 h-5" /> Prendre le selfie
        </Button>
      )}

      {step === 'preview' && (
        <div className="space-y-2">
          <Button className="w-full gap-2" size="lg" onClick={handleStart} disabled={loading || !!validateGates()}>
            {loading ? 'Démarrage en cours...' : <><CheckCircle2 className="w-5 h-5" /> Confirmer et prendre le service</>}
          </Button>
          <Button variant="outline" className="w-full gap-2" onClick={retakePhoto} disabled={loading}>
            <RotateCcw className="w-4 h-4" /> Reprendre le selfie
          </Button>
        </div>
      )}

      {cameraError && (
        <Button variant="outline" className="w-full gap-2" onClick={startCamera}>
          <RotateCcw className="w-4 h-4" /> Réessayer
        </Button>
      )}
    </div>
  );
}
