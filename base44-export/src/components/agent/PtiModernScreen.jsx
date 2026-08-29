import React from 'react';
import { CheckCircle2, Phone, Shield, MapPin, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function Ring({ progress, danger }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(1, Math.max(0, progress)));
  return (
    <svg viewBox="0 0 128 128" className="w-44 h-44 mx-auto -rotate-90">
      <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="10" />
      <circle
        cx="64"
        cy="64"
        r={r}
        fill="none"
        stroke={danger ? '#f87171' : '#34d399'}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

export default function PtiModernScreen({
  active,
  timeLabel,
  secondsLeft,
  intervalMinutes,
  overdue,
  siteName,
  gpsOk,
  fallArmed,
  fallPending,
  fallCancelLeft,
  onOk,
  onSos,
  onCancelFall,
  onArmSensors,
}) {
  const total = intervalMinutes * 60;
  const progress = total ? secondsLeft / total : 0;
  const danger = overdue || secondsLeft <= 60 || fallPending;

  if (!active) {
    return (
      <div className="rounded-3xl bg-slate-900 text-white p-6 text-center space-y-3">
        <Shield className="w-12 h-12 mx-auto text-emerald-400" />
        <h2 className="text-xl font-bold">DATI / PTI</h2>
        <p className="text-sm text-white/70">Le PTI s’active tout seul à la prise de service : vérification périodique, SOS, chute et GPS.</p>
        <p className="text-amber-300 text-sm font-medium">Prenez votre service pour l’armer.</p>
      </div>
    );
  }

  return (
    <div className={cn('rounded-3xl p-5 text-white space-y-5', danger ? 'bg-red-950' : 'bg-slate-900')}>
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/60">
        <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> PTI actif</span>
        <span>{siteName}</span>
      </div>

      <div className="relative">
        <Ring progress={progress} danger={danger} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className={cn('text-4xl font-mono font-bold', danger && 'text-red-300')}>{timeLabel}</p>
          <p className="text-[11px] text-white/60 mt-1">prochaine vérif.</p>
        </div>
      </div>

      <p className="text-center text-sm text-white/80">
        {fallPending
          ? `Chute détectée — annulez dans ${fallCancelLeft}s sinon alerte`
          : overdue
            ? 'Alerte envoyée à l’agence — confirmez si vous allez bien'
            : `Confirmez votre présence toutes les ${intervalMinutes} min`}
      </p>

      {fallPending && (
        <Button type="button" className="w-full h-14 text-base bg-white text-slate-900 hover:bg-slate-100" onClick={onCancelFall}>
          Fausse alerte — j’annule
        </Button>
      )}

      <Button type="button" className="w-full h-14 text-base gap-2 bg-emerald-500 hover:bg-emerald-600" onClick={onOk}>
        <CheckCircle2 className="w-5 h-5" /> Je suis OK
      </Button>
      <Button type="button" variant="destructive" className="w-full h-16 text-lg font-bold gap-2" onClick={onSos}>
        <Phone className="w-6 h-6" /> SOS — Alerte agence
      </Button>

      <div className="grid grid-cols-3 gap-2 text-[11px] text-center">
        <div className="rounded-xl bg-white/10 py-2 px-1">
          <MapPin className={cn('w-4 h-4 mx-auto mb-1', gpsOk ? 'text-emerald-400' : 'text-amber-300')} />
          GPS {gpsOk ? 'OK' : '…'}
        </div>
        <div className="rounded-xl bg-white/10 py-2 px-1">
          <Activity className={cn('w-4 h-4 mx-auto mb-1', fallArmed ? 'text-emerald-400' : 'text-white/40')} />
          Chute {fallArmed ? 'armée' : 'off'}
        </div>
        <button type="button" className="rounded-xl bg-white/10 py-2 px-1" onClick={onArmSensors}>
          <Shield className="w-4 h-4 mx-auto mb-1 text-sky-300" />
          Capteurs
        </button>
      </div>
    </div>
  );
}
