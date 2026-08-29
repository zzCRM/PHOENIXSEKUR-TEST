import React, { useEffect } from 'react';
import { Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { startPtiAlarm, stopPtiAlarm } from '@/lib/ptiAlarm';

export default function PtiCheckOverlay({
  open,
  fallCancelLeft,
  onSos,
  onCancelFall,
}) {
  useEffect(() => {
    if (!open) return undefined;
    startPtiAlarm();
    return () => stopPtiAlarm();
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[2500] bg-slate-950/95 text-white flex flex-col items-center justify-center p-6 gap-5">
      <p className="text-xs uppercase tracking-[0.2em] text-red-300">Alerte PTI</p>
      <p className="text-6xl font-mono font-bold text-red-400 animate-pulse">
        00:{String(fallCancelLeft).padStart(2, '0')}
      </p>
      <p className="text-center text-lg font-semibold max-w-sm">
        Perte de verticalité détectée
      </p>
      <p className="text-center text-white/80 max-w-xs">
        Tout va bien ou faut-il appeler les secours ? Sans réponse, l’agence sera alertée.
      </p>
      <Button className="w-full max-w-sm h-16 text-lg bg-emerald-500 hover:bg-emerald-600 text-white" onClick={onCancelFall}>
        Ça va bien
      </Button>
      <Button variant="destructive" className="w-full max-w-sm h-16 text-lg font-bold gap-2" onClick={onSos}>
        <Phone className="w-6 h-6" /> Appeler les secours
      </Button>
    </div>
  );
}
