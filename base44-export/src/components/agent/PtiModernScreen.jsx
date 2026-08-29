import React, { useEffect } from 'react';
import { Phone, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function PtiModernScreen({
  active,
  siteName,
  fallPending,
  fallCancelLeft,
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
        <p className="text-sm text-muted-foreground">Le PTI s’active à la prise de service : perte de verticalité, appel d’urgence et alerte de sortie de périmètre.</p>
      </div>
    );
  }

  return (
    <div className={cn('rounded-2xl border p-5 space-y-4', fallPending && 'border-red-500 bg-red-50')}>
      <div>
        <h2 className="text-lg font-bold">PTI — {siteName}</h2>
        <p className="text-xs text-muted-foreground">Perte de verticalité + appel d’urgence</p>
      </div>
      {fallPending ? (
        <>
          <p className="text-5xl font-mono font-bold text-center text-red-600">
            00:{String(fallCancelLeft).padStart(2, '0')}
          </p>
          <p className="text-sm text-center text-muted-foreground">
            Perte de verticalité — annulez dans {fallCancelLeft} s sinon l’agence est alertée
          </p>
          <Button type="button" variant="outline" className="w-full h-12" onClick={onCancelFall}>
            Fausse alerte
          </Button>
        </>
      ) : (
        <p className="text-sm text-center text-muted-foreground">
          Le PTI surveille l’orientation du téléphone. Aucune confirmation périodique.
        </p>
      )}
      <Button type="button" variant="destructive" className="w-full h-14 text-base font-bold gap-2" onClick={onSos}>
        <Phone className="w-5 h-5" /> Appel d’urgence
      </Button>
    </div>
  );
}
