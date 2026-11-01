import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createOutbox, memoryStorage } from '@/lib/ptiOutbox';
import { describeFeatures, FEATURE_LABELS, readDeviceSnapshot, STATE_LABELS } from '@/lib/ptiDevice';
import { CAPABILITY_CATALOG, evaluateImmobility, evaluateSosHold, evaluateZone } from '@/lib/ptiRules';

export default function PtiTestBench() {
  const [snapshot, setSnapshot] = useState(null);
  const [motionSamples, setMotionSamples] = useState(0);
  const [log, setLog] = useState([]);
  const [outbox] = useState(() => createOutbox(memoryStorage(), 'pti-test-memory'));

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      const next = await readDeviceSnapshot({ motionSamples });
      if (!stopped) setSnapshot(next);
    };
    load();
    return () => { stopped = true; };
  }, [motionSamples]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = (event) => {
      const acc = event.accelerationIncludingGravity || event.acceleration;
      if (!acc || acc.x == null) return;
      setMotionSamples((count) => count + 1);
    };
    window.addEventListener('devicemotion', handler);
    return () => window.removeEventListener('devicemotion', handler);
  }, []);

  const note = (line) => setLog((rows) => [line, ...rows].slice(0, 8));
  const features = snapshot ? describeFeatures({ ...snapshot, motionSamples }) : null;

  const simulateStillness = () => {
    const isolated = evaluateImmobility({
      samples: [{ t: 0, still: true }],
      now: 1000,
      prealertSec: 60,
      confirmSec: 15,
      motionAvailable: motionSamples > 0,
    });
    const full = evaluateImmobility({
      samples: [{ t: 0, still: true }, { t: 40000, still: true }, { t: 80000, still: true }],
      now: 80000,
      prealertSec: 60,
      confirmSec: 15,
      motionAvailable: true,
    });
    note(`Immobilité locale : 1 mesure → ${isolated.phase}. Série confirmée en mémoire → ${full.phase}. Aucune alerte envoyée.`);
  };

  const simulateZone = () => {
    const early = evaluateZone({ outside: true, outsideSince: 0, now: 10000, prealertSec: 30 });
    const late = evaluateZone({ outside: true, outsideSince: 0, now: 30000, prealertSec: 30 });
    note(`Zone locale : 10 s → ${early.phase}, 30 s → ${late.phase}. Aucune alerte envoyée.`);
  };

  const simulateOffline = async () => {
    outbox.enqueue({ client_event_id: 'essai-local', type: 'sos', detail: 'essai' });
    await outbox.flush(async () => { throw new Error('coupure simulée'); });
    const item = outbox.list()[0];
    note(`File mémoire : ${item.transmission_status}. ${item.last_error}. Le centre n’a rien reçu.`);
  };

  const simulateReceipt = async () => {
    await outbox.flush(async () => ({
      id: 'essai-non-envoyé',
      transmission_status: 'received',
      received_at: new Date().toISOString(),
    }));
    const item = outbox.list()[0];
    note(`Accusé simulé en mémoire seulement (${item?.transmission_status}). Aucune requête vers le centre.`);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 border-sky-300 bg-sky-50 text-sky-950 text-sm">
        Écran d’essai. Les scénarios restent dans ce navigateur et n’envoient aucune alerte au centre de supervision.
      </Card>
      <Card className="p-4 space-y-2 text-sm">
        <p className="font-semibold">Cet appareil</p>
        <p>Système détecté : {snapshot?.platform || '…'} · application web, pas une application native.</p>
        <p>Mesures de mouvement reçues pendant cet écran : {motionSamples}</p>
        <p>Batterie lue : {snapshot?.batteryLevel == null ? 'aucune valeur' : `${snapshot.batteryLevel} %`}</p>
        {features && Object.entries(features.features).map(([key, state]) => (
          <div key={key} className="flex justify-between gap-3">
            <span>{FEATURE_LABELS[key] || key}</span>
            <span className="text-muted-foreground">{STATE_LABELS[state] || state}</span>
          </div>
        ))}
      </Card>
      <Card className="p-4 space-y-2 text-sm">
        <p className="font-semibold">Ce que la PWA ne garantit pas</p>
        {CAPABILITY_CATALOG.filter((item) => item.native_required).map((item) => (
          <p key={item.key}><span className="font-medium">{item.label}.</span> {item.note}</p>
        ))}
      </Card>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={simulateStillness}>Essai immobilité</Button>
        <Button type="button" variant="outline" onClick={simulateZone}>Essai zone</Button>
        <Button type="button" variant="outline" onClick={simulateOffline}>Essai coupure</Button>
        <Button type="button" variant="outline" onClick={simulateReceipt}>Essai accusé en mémoire</Button>
        <Button type="button" variant="outline" onClick={() => note(`SOS 1 s : ${evaluateSosHold(1000, 2).ready ? 'prêt' : 'pas encore'}`)}>Essai appui SOS</Button>
      </div>
      <Card className="p-4 text-sm space-y-1">
        {log.length === 0 && <p className="text-muted-foreground">Aucun essai lancé.</p>}
        {log.map((line) => <p key={line}>{line}</p>)}
      </Card>
    </div>
  );
}
