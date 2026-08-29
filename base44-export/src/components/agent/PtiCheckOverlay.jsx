import React from 'react';
import { CheckCircle2, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PtiCheckOverlay({
  open,
  timeLabel,
  overdue,
  fallPending,
  fallCancelLeft,
  onOk,
  onSos,
  onCancelFall,
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[2500] bg-slate-950/95 text-white flex flex-col items-center justify-center p-6 gap-5">
      <p className="text-xs uppercase tracking-[0.2em] text-white/50">Vérification PTI</p>
      <p className={`text-6xl font-mono font-bold ${overdue || fallPending ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
        {fallPending ? `00:${String(fallCancelLeft).padStart(2, '0')}` : timeLabel}
      </p>
      <p className="text-center text-white/80 max-w-xs">
        {fallPending
          ? 'Chute détectée. Annulez si vous allez bien.'
          : overdue
            ? 'L’agence a été alertée.'
            : 'Confirmez que vous allez bien.'}
      </p>
      {fallPending && (
        <Button className="w-full max-w-sm h-14 bg-white text-slate-900" onClick={onCancelFall}>Fausse alerte</Button>
      )}
      <Button className="w-full max-w-sm h-14 bg-emerald-500 hover:bg-emerald-600 gap-2" onClick={onOk}>
        <CheckCircle2 className="w-5 h-5" /> Je suis OK
      </Button>
      <Button variant="destructive" className="w-full max-w-sm h-16 text-lg font-bold gap-2" onClick={onSos}>
        <Phone className="w-6 h-6" /> SOS
      </Button>
    </div>
  );
}
