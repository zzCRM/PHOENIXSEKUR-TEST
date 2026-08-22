import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Camera, MapPin, RotateCcw, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

/** Fin de service certifiée : photo + GPS. */
export default function FinDeServicePhoto({ service, companyId, agentId, agentName, onSuccess }) {
  const [step, setStep] = useState('camera');
  const [loading, setLoading] = useState(false);
  const [photoBlob, setPhotoBlob] = useState(null);
  const [photoURL, setPhotoURL] = useState(null);
  const [position, setPosition] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    startCamera();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setPosition({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => {},
        { timeout: 8000, enableHighAccuracy: true },
      );
    }
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraError(null);
    } catch {
      setCameraError("Impossible d'accéder à la caméra.");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
  };

  const takePhoto = () => {
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
    canvas.toBlob((blob) => {
      setPhotoBlob(blob);
      setPhotoURL(URL.createObjectURL(blob));
      stopCamera();
      setStep('preview');
    }, 'image/jpeg', 0.85);
  };

  const handleConfirm = async () => {
    if (!photoBlob || !service) return;
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
        certified: true,
      });

      await base44.entities.MainCourante.create({
        company_id: companyId,
        site_id: service.site_id,
        site_name: service.site_name,
        client_name: service.client_name,
        agent_id: agentId,
        agent_name: agentName,
        date: today,
        time: now,
        type: 'depart',
        content: `Fin de service certifiée (photo + GPS) — ${agentName} à ${now}`,
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
        <p className="text-sm text-muted-foreground">Photo et GPS enregistrés</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="font-semibold">Fin de service certifiée</p>
        <p className="text-sm text-muted-foreground">{service?.site_name}</p>
      </div>

      {cameraError && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4" /> {cameraError}
        </div>
      )}

      {step === 'camera' && (
        <div className="space-y-3">
          <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <MapPin className="w-3.5 h-3.5" />
            {position ? `GPS ${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}` : 'GPS en cours…'}
          </div>
          <Button className="w-full gap-2" onClick={takePhoto} disabled={!!cameraError}>
            <Camera className="w-4 h-4" /> Prendre la photo
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
            <Button className="flex-1" onClick={handleConfirm} disabled={loading}>
              {loading ? 'Enregistrement…' : 'Confirmer la fin'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
