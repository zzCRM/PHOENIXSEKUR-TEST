import React from 'react';
import { Phone, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function PtiModernScreen({
  active,
  armed,
  siteName,
  fallPending,
  fallCancelLeft,
  onSos,
  onCancelFall,
  onArmSensors,
  onTestAlarm,
}) {
  if (!active) {
    return (
      <div className="rounded-2xl border p-6 text-center space-y-2">
        <Shield className="w-10 h-10 mx-auto text-primary" />
        <h2 className="text-lg font-bold">Protection du travailleur isolé</h2>
        <p className="text-sm text-muted-foreground">Le PTI s’active à la prise de service : perte de verticalité, alerte sonore, appel d’urgence et sortie de périmètre.</p>
      </div>
    );
  }

  return (
    <div className={cn('rounded-2xl border p-5 space-y-4', fallPending && 'border-red-500 bg-red-50')}>
      <div>
        <h2 className="text-lg font-bold">PTI — {siteName}</h2>
        <p className="text-xs text-muted-foreground">Perte de verticalité + appel d’urgence</p>
      </div>

      {!armed ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground text-center">
            Autorisez le mouvement et le son une fois (obligatoire sur iPhone). Posez ensuite le téléphone à plat 5 secondes.
          </p>
          <Button type="button" className="w-full h-14" onClick={onArmSensors}>
            Activer le PTI (capteurs + son)
          </Button>
        </div>
      ) : fallPending ? (
        <>
          <p className="text-5xl font-mono font-bold text-center text-red-600">
            00:{String(fallCancelLeft).padStart(2, '0')}
          </p>
          <p className="text-sm text-center text-muted-foreground">
            Perte de verticalité — confirmez ou appelez les secours
          </p>
          <Button type="button" className="w-full h-12 bg-emerald-600 hover:bg-emerald-700" onClick={onCancelFall}>
            Ça va bien
          </Button>
        </>
      ) : (
        <div className="space-y-2 text-center">
          <p className="text-sm font-medium text-emerald-700">PTI armé — perte de verticalité surveillée</p>
          <p className="text-xs text-muted-foreground">Posez le téléphone à plat 5 secondes : bip + question « ça va / secours ».</p>
          <Button type="button" variant="outline" className="w-full" onClick={onTestAlarm}>
            Tester l’alerte sonore
          </Button>
        </div>
      )}

      <Button type="button" variant="destructive" className="w-full h-14 text-base font-bold gap-2" onClick={onSos}>
        <Phone className="w-5 h-5" /> Appel d’urgence
      </Button>
    </div>
  );
}
