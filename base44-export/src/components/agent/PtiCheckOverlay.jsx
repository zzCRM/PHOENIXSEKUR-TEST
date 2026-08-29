import React from 'react';
import { Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PtiCheckOverlay({
  open,
  fallCancelLeft,
  onSos,
  onCancelFall,
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[2500] bg-slate-950/95 text-white flex flex-col items-center justify-center p-6 gap-5">
      <p className="text-xs uppercase tracking-[0.2em] text-white/50">Perte de verticalité</p>
      <p className="text-6xl font-mono font-bold text-red-400 animate-pulse">
        00:{String(fallCancelLeft).padStart(2, '0')}
      </p>
      <p className="text-center text-white/80 max-w-xs">
        Le téléphone n’est plus à la verticale. Annulez si vous allez bien, sinon l’agence sera alertée.
      </p>
      <Button className="w-full max-w-sm h-14 bg-white text-slate-900" onClick={onCancelFall}>Fausse alerte</Button>
      <Button variant="destructive" className="w-full max-w-sm h-16 text-lg font-bold gap-2" onClick={onSos}>
        <Phone className="w-6 h-6" /> Appel d’urgence
      </Button>
    </div>
  );
}
