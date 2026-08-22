import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Camera, MapPin, RotateCcw, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function PriseDeServiceNFC({ mission, companyId, agentId, agentName, onSuccess }) {
  const [step, setStep] = useState('camera'); // camera, preview, done
  const [loading, setLoading] = useState(false);
  const [photoBlob, setPhotoBlob] = useState(null);
  const [photoURL, setPhotoURL] = useState(null);
  const [position, setPosition] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    startCamera();
    getPosition();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraError(null);
    } catch {
      setCameraError("Impossible d'accéder à la caméra. Vérifiez les autorisations.");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
  };

  const getPosition = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => setPosition({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => {},
      { timeout: 8000 }
    );
  };

  const takePhoto = () => {
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
    canvas.toBlob(blob => {
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

  const handleStart = async () => {
    if (!photoBlob) return;
    setLoading(true);

    const photoFile = new File([photoBlob], `service_${Date.now()}.jpg`, { type: 'image/jpeg' });
    const { file_url: photoUploadUrl } = await base44.integrations.Core.UploadFile({ file: photoFile });

    const now = format(new Date(), 'HH:mm');
    const today = format(new Date(), 'yyyy-MM-dd');

    await base44.entities.PriseDeService.create({
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
      status: 'en_service',
      start_photo_url: photoUploadUrl,
      start_latitude: position?.latitude,
      start_longitude: position?.longitude,
      nfc_validated: false,
      certified: true,
    });

    await base44.entities.MainCourante.create({
      company_id: companyId,
      site_id: mission.site_id,
      site_name: mission.site_name,
      client_name: mission.client_name,
      agent_id: agentId,
      agent_name: agentName,
      date: today,
      time: now,
      type: 'arrivee',
      content: `Prise de service certifiée (photo + GPS) — ${agentName} sur ${mission.site_name} à ${now}`,
      latitude: position?.latitude,
      longitude: position?.longitude,
      photo_url: photoUploadUrl,
      severity: 'normal',
    });

    await base44.entities.Alerte.create({
      company_id: companyId,
      type: 'debut_service',
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
      severity: 'info',
    });

    setLoading(false);
    setStep('done');
    setTimeout(() => onSuccess(), 1200);
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

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-xl bg-muted/50">
        <p className="font-semibold text-sm">{mission.title}</p>
        <p className="text-xs text-muted-foreground">{mission.site_name} • {mission.start_time} - {mission.end_time}</p>
      </div>

      {/* Camera / Preview */}
      <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
        {step === 'camera' && !cameraError && (
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        )}
        {step === 'preview' && photoURL && (
          <img src={photoURL} alt="Photo" className="w-full h-full object-cover" />
        )}
        {cameraError && (
          <div className="flex items-center justify-center h-full p-4 text-center">
            <div>
              <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
              <p className="text-white text-sm">{cameraError}</p>
            </div>
          </div>
        )}
      </div>

      {/* GPS */}
      {position && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="w-3 h-3 text-green-500" />
          GPS: {position.latitude.toFixed(5)}, {position.longitude.toFixed(5)}
        </p>
      )}

      {/* Boutons */}
      {step === 'camera' && !cameraError && (
        <Button className="w-full gap-2" size="lg" onClick={takePhoto}>
          <Camera className="w-5 h-5" /> Prendre la photo
        </Button>
      )}

      {step === 'preview' && (
        <div className="space-y-2">
          <Button className="w-full gap-2" size="lg" onClick={handleStart} disabled={loading}>
            {loading ? 'Démarrage en cours...' : <><CheckCircle2 className="w-5 h-5" /> Confirmer et prendre le service</>}
          </Button>
          <Button variant="outline" className="w-full gap-2" onClick={retakePhoto} disabled={loading}>
            <RotateCcw className="w-4 h-4" /> Reprendre la photo
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