import React, { useEffect, useRef, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { evaluateBattery, evaluateImmobility, evaluateSosHold, protectionFlags, PTI_DISCLAIMER } from '@/lib/ptiRules';
import { describeFeatures, FEATURE_LABELS, readDeviceSnapshot, STATE_LABELS } from '@/lib/ptiDevice';
import { flushPtiOutbox, ptiOutbox } from '@/lib/ptiTransmit';
import { base44 } from '@/api/base44Client';

const BANNERS = {
  protection_active: 'Protection active',
  protection_partial: 'Protection partiellement disponible',
  permission_missing: 'Autorisation manquante',
  gps_unavailable: 'GPS indisponible',
  network_unavailable: 'Réseau indisponible',
  alert_pending: 'Alerte en attente d’envoi',
  alert_confirmed: 'Alerte reçue et confirmée par le serveur',
};

export function PtiWatchers({
  active,
  effective,
  onAlert,
  onStatus,
}) {
  const samplesRef = useRef([]);
  const motionCount = useRef(0);
  const batterySent = useRef('');
  const immobilitySent = useRef(false);
  const onStatusRef = useRef(onStatus);
  const onAlertRef = useRef(onAlert);
  onStatusRef.current = onStatus;
  onAlertRef.current = onAlert;

  useEffect(() => {
    let stopped = false;
    const publish = async () => {
      const pending = ptiOutbox().pending();
      const received = ptiOutbox().list().filter((item) => item.transmission_status === 'received' && item.server_id);
      const last = received[received.length - 1] || null;
      let server = 'offline';
      try {
        await base44.pti.ping();
        if (!stopped) server = 'online';
      } catch {
        server = 'offline';
      }
      const snapshot = await readDeviceSnapshot({
        geoFix: false,
        motionSamples: motionCount.current,
      });
      if (stopped) return;
      const features = describeFeatures(snapshot);
      onStatusRef.current?.({
        snapshot,
        features,
        server,
        network: snapshot.onLine ? 'online' : 'offline',
        batteryLevel: snapshot.batteryLevel,
        pending,
        lastReceived: last,
        motionSamples: motionCount.current,
      });
    };
    publish();
    const id = setInterval(publish, 20000);
    const onOnline = () => { flushPtiOutbox().finally(publish); };
    window.addEventListener('online', onOnline);
    flushPtiOutbox().finally(publish);
    return () => {
      stopped = true;
      clearInterval(id);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  useEffect(() => {
    if (!active || !effective?.detections?.immobilite) return undefined;
    const samples = samplesRef.current;
    const handler = (event) => {
      const acc = event.acceleration;
      if (!acc || (acc.x == null && acc.y == null && acc.z == null)) return;
      motionCount.current += 1;
      const mag = Math.hypot(Number(acc.x) || 0, Number(acc.y) || 0, Number(acc.z) || 0);
      const prev = samples[samples.length - 1];
      const still = Boolean(prev) && Math.abs(mag - prev.mag) < 0.35 && mag < 0.8;
      samples.push({ t: Date.now(), still, mag });
      if (samples.length > 90) samples.shift();
    };
    window.addEventListener('devicemotion', handler);
    const timer = setInterval(() => {
      if (motionCount.current < 1 || immobilitySent.current) return;
      const decision = evaluateImmobility({
        samples,
        now: Date.now(),
        prealertSec: effective.immobilite_prealerte_sec,
        confirmSec: effective.immobilite_confirmation_sec,
        motionAvailable: true,
      });
      if (decision.phase === 'confirmed') {
        immobilitySent.current = true;
        onAlertRef.current?.('immobilite', 'Immobilité confirmée après préalerte');
      }
    }, 2000);
    return () => {
      window.removeEventListener('devicemotion', handler);
      clearInterval(timer);
    };
  }, [active, effective]);

  useEffect(() => {
    if (!active || !effective?.detections?.batterie) return undefined;
    let stopped = false;
    const check = async () => {
      const snapshot = await readDeviceSnapshot();
      if (stopped || snapshot.batteryLevel == null) return;
      const decision = evaluateBattery(snapshot.batteryLevel, effective.batterie_faible_pct, effective.batterie_critique_pct);
      if (decision.phase !== 'faible' && decision.phase !== 'critique') return;
      if (batterySent.current === decision.phase) return;
      batterySent.current = decision.phase;
      onAlertRef.current?.(
        decision.phase === 'critique' ? 'batterie_critique' : 'batterie_faible',
        `Batterie ${snapshot.batteryLevel} %`,
        { battery_level: snapshot.batteryLevel },
      );
    };
    check();
    const id = setInterval(check, 60000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [active, effective]);

  return null;
}

export default function PtiAgentPanel({
  active,
  effective,
  imposed,
  locallyEnabled,
  onToggleLocal,
  position,
  gpsError,
  status,
  onSos,
}) {
  const [holdMs, setHoldMs] = useState(0);
  const holdRef = useRef(null);
  const detections = effective?.detections || {};
  const features = status?.features?.features || {};
  const gpsState = position ? 'available' : (gpsError ? 'denied' : (features.geolocation_foreground || 'unverified'));
  const flags = protectionFlags({
    onDuty: active,
    imposed,
    locallyEnabled,
    detections,
    features: {
      gps: gpsState,
      motion: features.motion,
      battery: features.battery,
      network: status?.network,
      server: status?.server,
    },
    pendingCount: status?.pending?.length || 0,
    lastReceived: status?.lastReceived
      ? { id: status.lastReceived.server_id, transmission_status: status.lastReceived.transmission_status }
      : null,
  });
  const hold = evaluateSosHold(holdMs, effective?.sos_hold_sec || 2);
  useEffect(() => () => {
    if (holdRef.current) clearInterval(holdRef.current);
  }, []);

  const startHold = () => {
    const started = Date.now();
    setHoldMs(0);
    holdRef.current = setInterval(() => {
      const ms = Date.now() - started;
      setHoldMs(ms);
      if (ms >= (effective?.sos_hold_sec || 2) * 1000) {
        clearInterval(holdRef.current);
        holdRef.current = null;
        setHoldMs(0);
        onSos?.();
      }
    }, 100);
  };
  const stopHold = () => {
    if (holdRef.current) clearInterval(holdRef.current);
    holdRef.current = null;
    setHoldMs(0);
  };

  const detectionRows = [
    ['chute', 'Chute', features.motion],
    ['immobilite', 'Immobilité', features.immobility],
    ['perte_verticalite', 'Perte de verticalité', features.verticality],
    ['zone_gps', 'Zone GPS', gpsState],
    ['sos', 'SOS', 'available'],
    ['batterie', 'Batterie', features.battery],
  ];

  return (
    <div className="space-y-4">
      <Card className="p-4 border-amber-300 bg-amber-50 text-amber-950 text-sm">
        {PTI_DISCLAIMER}
      </Card>
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Protection</p>
            <p className="text-lg font-semibold">
              {flags.protection === 'active' && 'Protection active'}
              {flags.protection === 'partial' && 'Protection partiellement disponible'}
              {flags.protection === 'inactive' && 'Protection inactive'}
            </p>
            <p className="text-sm text-muted-foreground">
              {effective?.profile_label || 'Profil en cours de chargement'}
              {imposed ? ' · imposée par l’entreprise' : ''}
            </p>
          </div>
          <Button
            type="button"
            variant={locallyEnabled ? 'default' : 'outline'}
            disabled={imposed || !active}
            onClick={() => onToggleLocal?.(!locallyEnabled)}
          >
            {imposed ? 'Verrouillée' : locallyEnabled ? 'Activée' : 'Désactivée'}
          </Button>
        </div>
        <div className="flex flex-col gap-1">
          {flags.banners.map((key) => (
            <p key={key} className={`text-sm font-medium ${key === 'alert_confirmed' ? 'text-emerald-700' : key === 'protection_active' ? 'text-emerald-700' : 'text-amber-800'}`}>
              {BANNERS[key]}
            </p>
          ))}
        </div>
      </Card>

      <button
        type="button"
        className="w-full rounded-2xl bg-red-600 text-white py-8 text-2xl font-bold tracking-wide active:bg-red-700"
        onPointerDown={startHold}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
      >
        <span className="inline-flex items-center gap-3">
          <ShieldAlert className="w-8 h-8" /> SOS
        </span>
        <span className="block text-sm font-normal mt-2">
          Maintenir {effective?.sos_hold_sec || 2} s
          {holdMs > 0 ? ` · ${Math.round(hold.ratio * 100)} %` : ''}
        </span>
      </button>

      <Card className="p-4 space-y-2 text-sm">
        <Row label="Connexion serveur" value={status?.server === 'online' ? 'Serveur joignable' : 'Serveur injoignable'} />
        <Row label="Réseau du téléphone" value={status?.network === 'offline' ? 'Hors ligne' : 'En ligne'} />
        <Row label="GPS" value={position ? `Position lue · ±${Math.round(position.accuracy || 0)} m` : (gpsError || 'Pas de position')} />
        <Row label="Batterie" value={status?.batteryLevel == null ? 'Indisponible sur ce téléphone' : `${status.batteryLevel} %`} />
        <Row label="Profil PTI" value={effective?.profile_label || '—'} />
        <Row
          label="Dernière transmission confirmée"
          value={status?.lastReceived?.received_at ? new Date(status.lastReceived.received_at).toLocaleString('fr-FR') : 'Aucune'}
        />
        <Row label="Alertes en attente sur le téléphone" value={String(status?.pending?.length || 0)} />
      </Card>

      <Card className="p-4 space-y-2">
        <p className="font-semibold">Fonctions de détection</p>
        {detectionRows.map(([key, label, state]) => (
          <div key={key} className="flex items-center justify-between text-sm gap-3">
            <span>{label}{detections[key] === false ? ' · coupée dans le profil' : ''}</span>
            <span className="text-muted-foreground text-right">{STATE_LABELS[state] || state || 'Non lue'}</span>
          </div>
        ))}
        <p className="text-xs text-muted-foreground pt-2">
          Une fonction « non lue » ou « indisponible » ne déclenche pas d’alarme. Le GPS arrière-plan et les notifications téléphone verrouillé ne sont pas garantis dans cette application web.
        </p>
        {status?.features && (
          <ul className="text-xs text-muted-foreground space-y-1 pt-2">
            {Object.entries(status.features.features).map(([key, state]) => (
              <li key={key}>{FEATURE_LABELS[key] || key} : {STATE_LABELS[state] || state}</li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
