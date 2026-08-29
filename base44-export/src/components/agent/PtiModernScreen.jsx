import React, { useEffect } from 'react';
import { CheckCircle2, Phone, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function PtiModernScreen({
  active,
  timeLabel,
  secondsLeft,
  intervalMinutes,
  overdue,
  siteName,
  fallPending,
  fallCancelLeft,
  onOk,
  onSos,
  onCancelFall,
  onArmSensors,
}) {
  useEffect(() => {
    if (active) onArmSensors?.();
  }, [active]);

  if (!active) {
    return (
      <div className="rounded-2xl border p-6 text-center space-y-2">
        <Shield className="w-10 h-10 mx-auto text-primary" />
        <h2 className="text-lg font-bold">Protection du travailleur isolé</h2>
        <p className="text-sm text-muted-foreground">Le PTI s’active à la prise de service : vérification d’activité, appel d’urgence, détection de chute et alerte de sortie de périmètre.</p>
      </div>
    );
  }

  return (
    <div className={cn('rounded-2xl border p-5 space-y-4', (overdue || fallPending) && 'border-red-500 bg-red-50')}>
      <div>
        <h2 className="text-lg font-bold">PTI — {siteName}</h2>
        <p className="text-xs text-muted-foreground">Vérification d’activité toutes les {intervalMinutes} min</p>
      </div>
      <p className={cn('text-5xl font-mono font-bold text-center', overdue || secondsLeft <= 60 ? 'text-red-600' : 'text-primary')}>
        {fallPending ? `00:${String(fallCancelLeft).padStart(2, '0')}` : timeLabel}
      </p>
      <p className="text-sm text-center text-muted-foreground">
        {fallPending
          ? `Chute détectée — annulez dans ${fallCancelLeft} s`
          : overdue
            ? 'Alerte envoyée à l’agence'
            : 'Confirmez votre activité avant la fin du délai'}
      </p>
      {fallPending && (
        <Button type="button" variant="outline" className="w-full h-12" onClick={onCancelFall}>
          Fausse alerte
        </Button>
      )}
      <Button type="button" className="w-full h-12 gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={onOk}>
        <CheckCircle2 className="w-5 h-5" /> Je confirme mon activité
      </Button>
      <Button type="button" variant="destructive" className="w-full h-14 text-base font-bold gap-2" onClick={onSos}>
        <Phone className="w-5 h-5" /> Appel d’urgence
      </Button>
    </div>
  );
}
