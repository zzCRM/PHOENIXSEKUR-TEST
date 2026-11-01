import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, AlertTriangle, MapPin, ScanLine, Smartphone, X, CloudOff, Plus, Ban } from 'lucide-react';
import { useNfcScan } from '@/hooks/useNfcScan';
import {
  DRAFT_PREFIX,
  buildRunItems,
  createRondeOutbox,
  distanceMeters,
  hm,
  isLibre,
  matchScan,
  newRunId,
} from '@/lib/rondeExecution';

export const rondeOutbox = () => createRondeOutbox(window.localStorage);

export function flushRondeOutbox() {
  return rondeOutbox().flush((item) => base44.entities[item.entity].create({
    ...item.data,
    client_sent_at: new Date().toISOString(),
  }));
}

function readPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve({ gps_error: 'indisponible' }); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, gps_accuracy: Math.round(pos.coords.accuracy) }),
      (err) => resolve({ gps_error: err?.code === 1 ? 'refusee' : 'indisponible' }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 },
    );
  });
}

function loadDraft(key) {
  try { return JSON.parse(window.localStorage.getItem(key) || 'null'); } catch { return null; }
}

export default function RondeNFC({ ronde, currentService, companyId, agentId, agentName, onFinish }) {
  const libre = isLibre(ronde);
  const checkpoints = useMemo(
    () => [...(ronde.checkpoints || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [ronde.checkpoints],
  );
  const draftKey = `${DRAFT_PREFIX}${currentService?.id || 'hors-service'}:${ronde.id}`;
  const initial = useMemo(() => loadDraft(draftKey), [draftKey]);

  const [runId] = useState(() => initial?.runId || newRunId());
  const [startedAt] = useState(() => (initial?.startedAt ? new Date(initial.startedAt) : new Date()));
  const [done, setDone] = useState(initial?.done || []);
  const [skipped, setSkipped] = useState(initial?.skipped || []);
  const [controles, setControles] = useState(initial?.controles || []);
  const [extraAnomalies, setExtraAnomalies] = useState(initial?.extraAnomalies || []);
  const [observations, setObservations] = useState(initial?.observations || '');
  const [newControle, setNewControle] = useState('');
  const [newAnomalie, setNewAnomalie] = useState('');
  const [scanningFor, setScanningFor] = useState(null);
  const [scanError, setScanError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const { supported, scan, stop } = useNfcScan();
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  useEffect(() => {
    if (result) return;
    window.localStorage.setItem(draftKey, JSON.stringify({
      runId, startedAt: startedAt.toISOString(), done, skipped, controles, extraAnomalies, observations,
    }));
  }, [draftKey, runId, startedAt, done, skipped, controles, extraAnomalies, observations, result]);

  const isDone = (cpId) => done.some((entry) => entry.checkpoint_id === cpId);
  const handled = done.length + skipped.length;
  const allowSkip = ronde.allow_skip === true;
  const mustFinishAll = !libre && !allowSkip && handled < checkpoints.length;
  const canFinish = !loading && (libre || handled > 0) && !mustFinishAll;

  const scanCheckpoint = useCallback((cp) => {
    if (isDone(cp.id)) return;
    setScanError('');
    setScanningFor(cp.id);
    scan(45000)
      .then(async (serial) => {
        const verdict = matchScan(checkpoints, cp, serial);
        if (!verdict.ok) {
          setScanningFor(null);
          if (verdict.reason === 'autre_point') setScanError(`Ce badge est celui du point « ${verdict.other.name} », pas de « ${cp.name} ». Point non validé.`);
          else if (verdict.reason === 'sans_tag') setScanError(`Le point « ${cp.name} » n'a pas de tag NFC enregistré.`);
          else setScanError(`Ce badge (${serial}) ne correspond pas au point « ${cp.name} ». Point non validé.`);
          return;
        }
        const scannedAt = new Date();
        const position = await readPosition();
        const distance = distanceMeters(position, cp);
        setDone((prev) => (prev.some((entry) => entry.checkpoint_id === cp.id) ? prev : [...prev, {
          pointeau_id: cp.pointeau_id || cp.id,
          checkpoint_id: cp.id,
          checkpoint_name: cp.name || cp.id,
          time: hm(scannedAt),
          scanned_at: scannedAt.toISOString(),
          note: '',
          anomaly: false,
          nfc_validated: true,
          nfc_serial: serial,
          ...position,
          ...(distance !== null ? { gps_distance_m: distance } : {}),
        }]));
        setScanningFor(null);
      })
      .catch((err) => {
        setScanningFor(null);
        if (err?.message && !['timeout', 'unsupported'].includes(err.message)) setScanError(err.message);
        else if (err?.message === 'timeout') setScanError('Aucun badge détecté. Rapprochez le tag du dos du téléphone puis réessayez.');
      });
  }, [checkpoints, done, scan]);

  const validateManually = async (cp) => {
    if (isDone(cp.id)) return;
    const scannedAt = new Date();
    const position = await readPosition();
    setDone((prev) => [...prev, {
      pointeau_id: cp.pointeau_id || '',
      checkpoint_id: cp.id,
      checkpoint_name: cp.name || cp.id,
      time: hm(scannedAt),
      scanned_at: scannedAt.toISOString(),
      note: '',
      anomaly: false,
      nfc_validated: false,
      nfc_serial: '',
      ...position,
    }]);
  };

  const markInaccessible = (cp) => {
    const reason = window.prompt(`Pourquoi le point « ${cp.name} » est-il inaccessible ?`);
    if (!reason || !reason.trim()) return;
    setSkipped((prev) => [...prev, { pointeau_id: cp.pointeau_id || cp.id, checkpoint_id: cp.id, checkpoint_name: cp.name, reason: reason.trim(), at: new Date().toISOString() }]);
  };

  const patchDone = (cpId, patch) => setDone((prev) => prev.map((entry) => (entry.checkpoint_id === cpId ? { ...entry, ...patch } : entry)));
  const patchControle = (index, patch) => setControles((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const addControle = () => {
    const label = newControle.trim();
    if (!label) return;
    setControles((prev) => [...prev, { label, anomaly: false, note: '', at: new Date().toISOString() }]);
    setNewControle('');
  };
  const addAnomalie = () => {
    const label = newAnomalie.trim();
    if (!label) return;
    setExtraAnomalies((prev) => [...prev, { label, note: '', at: new Date().toISOString() }]);
    setNewAnomalie('');
  };

  const handleFinish = async () => {
    setLoading(true);
    const items = buildRunItems({
      runId, ronde, service: currentService, companyId, agentId, agentName,
      startedAt, endedAt: new Date(), done, skipped, controles, observations, extraAnomalies,
    });
    const outbox = rondeOutbox();
    outbox.enqueue(items);
    window.localStorage.removeItem(draftKey);
    const summary = await flushRondeOutbox();
    if (!mounted.current) return;
    const rejected = outbox.rejected().filter((item) => item.runId === runId);
    setLoading(false);
    setResult({ ...summary, rejected: rejected.length ? rejected[0].error : '' });
    if (!rejected.length) setTimeout(() => onFinish?.(), summary.pending ? 2500 : 1500);
  };

  const closeRejected = () => {
    rondeOutbox().dismissRejected(runId);
    onFinish?.();
  };

  if (result) {
    if (result.rejected) {
      return (
        <div className="text-center py-8 space-y-3">
          <AlertTriangle className="w-14 h-14 text-red-500 mx-auto" />
          <p className="text-lg font-bold text-red-600">Ronde refusée par le serveur</p>
          <p className="text-sm text-muted-foreground">{result.rejected}</p>
          <Button variant="outline" onClick={closeRejected}>Fermer</Button>
        </div>
      );
    }
    return (
      <div className="text-center py-12">
        {result.pending > 0
          ? <CloudOff className="w-16 h-16 text-amber-500 mx-auto mb-3" />
          : <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-3" />}
        <p className={`text-lg font-bold ${result.pending > 0 ? 'text-amber-600' : 'text-green-600'}`}>
          {result.pending > 0 ? 'Ronde enregistrée sur le téléphone' : 'Ronde terminée !'}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {result.pending > 0
            ? 'Pas de réseau : elle sera envoyée automatiquement dès que la connexion revient. Ne la refaites pas.'
            : libre ? 'Main courante générée automatiquement' : `${done.length}/${checkpoints.length} points — main courante générée automatiquement`}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold">{ronde.name}</p>
        {!libre && <Badge variant="outline">{done.length}/{checkpoints.length} validés</Badge>}
      </div>

      {!libre && !supported && (
        <div className="flex items-start gap-2 text-xs bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-amber-700">
          <Smartphone className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Scan NFC indisponible sur cet appareil (iPhone ou navigateur non compatible). Ouvrez l'application dans Chrome sur Android pour valider les points.</span>
        </div>
      )}

      {scanningFor && (
        <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-4 flex flex-col items-center text-center gap-2">
          <div className="relative w-16 h-16 flex items-center justify-center">
            <span className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
            <ScanLine className="w-7 h-7 text-primary relative" />
          </div>
          <p className="text-sm font-semibold text-primary">Scannez le point : {checkpoints.find((c) => c.id === scanningFor)?.name}</p>
          <p className="text-xs text-muted-foreground">Approchez le badge NFC du dos du téléphone</p>
          <Button size="sm" variant="outline" className="gap-1 mt-1" onClick={() => { stop(); setScanningFor(null); }}>
            <X className="w-3.5 h-3.5" /> Annuler le scan
          </Button>
        </div>
      )}

      {scanError && !scanningFor && (
        <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{scanError}</p>
      )}

      {libre ? (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-2.5">
            Ronde libre : aucun badge ni parcours imposé. Notez vos contrôles, vos observations et les anomalies : tout est tracé avec votre nom, l'heure{ronde.site_name ? ' et le site' : ''}.
          </p>
          <div>
            <p className="text-xs font-semibold mb-1.5">Contrôles effectués</p>
            <div className="flex gap-2">
              <Input value={newControle} onChange={(e) => setNewControle(e.target.value)} placeholder="Ex : Portail nord vérifié" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addControle(); } }} />
              <Button type="button" size="icon" variant="outline" aria-label="Ajouter le contrôle" onClick={addControle}><Plus className="w-4 h-4" /></Button>
            </div>
            <div className="mt-2 space-y-2">
              {controles.map((item, index) => (
                <div key={index} className={`p-2.5 rounded-lg border text-sm ${item.anomaly ? 'border-amber-300 bg-amber-50' : 'border-border'}`}>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    <button type="button" className={`flex items-center gap-1 text-xs px-2 py-1 rounded border ${item.anomaly ? 'border-red-300 bg-red-50 text-red-600' : 'border-border text-muted-foreground'}`} onClick={() => patchControle(index, { anomaly: !item.anomaly })}>
                      <AlertTriangle className="w-3 h-3" />{item.anomaly ? 'Anomalie' : 'Anomalie ?'}
                    </button>
                    <button type="button" aria-label="Retirer" className="text-muted-foreground" onClick={() => setControles((prev) => prev.filter((_, i) => i !== index))}><X className="w-4 h-4" /></button>
                  </div>
                  <input className="mt-2 w-full text-xs border border-input rounded px-2 py-1 bg-background" placeholder="Note (optionnel)…" value={item.note} onChange={(e) => patchControle(index, { note: e.target.value })} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold mb-1.5">Signaler une anomalie</p>
            <div className="flex gap-2">
              <Input value={newAnomalie} onChange={(e) => setNewAnomalie(e.target.value)} placeholder="Décrivez l'anomalie constatée" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAnomalie(); } }} />
              <Button type="button" size="icon" variant="outline" aria-label="Ajouter l'anomalie" onClick={addAnomalie}><AlertTriangle className="w-4 h-4" /></Button>
            </div>
            {extraAnomalies.map((item, index) => (
              <div key={index} className="mt-2 flex items-center gap-2 text-sm p-2.5 rounded-lg border border-red-200 bg-red-50 text-red-700">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                <button type="button" aria-label="Retirer" onClick={() => setExtraAnomalies((prev) => prev.filter((_, i) => i !== index))}><X className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold mb-1.5">Observations</p>
            <Textarea rows={3} value={observations} onChange={(e) => setObservations(e.target.value)} placeholder="Observations libres" />
          </div>
        </div>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {checkpoints.length === 0 && <p className="text-sm text-muted-foreground">Cette ronde n'a aucun point de contrôle.</p>}
          {checkpoints.map((cp, idx) => {
            const entry = done.find((item) => item.checkpoint_id === cp.id);
            const skip = skipped.find((item) => item.checkpoint_id === cp.id);
            const hasTag = Boolean(cp.nfc_tag_id);
            const legacyManualAllowed = !hasTag && !cp.pointeau_id;
            return (
              <div key={cp.id} className={`p-3 rounded-xl border transition-all ${entry ? (entry.anomaly ? 'border-amber-300 bg-amber-50' : 'border-green-300 bg-green-50') : skip ? 'border-slate-300 bg-slate-50' : 'border-border bg-card'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 ${entry ? (entry.anomaly ? 'border-amber-500 bg-amber-500 text-white' : 'border-green-500 bg-green-500 text-white') : 'border-muted-foreground'}`}>
                    {entry ? <CheckCircle2 className="w-4 h-4" /> : skip ? <Ban className="w-4 h-4" /> : <span className="text-xs font-bold">{idx + 1}</span>}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{cp.name}</p>
                    {cp.description && <p className="text-xs text-muted-foreground">{cp.description}</p>}
                  </div>
                  {entry?.nfc_validated && <Badge variant="outline" className="gap-1 text-emerald-700 border-emerald-300 bg-emerald-50"><ScanLine className="w-3 h-3" /> NFC</Badge>}
                </div>
                {entry && (
                  <div className="ml-11 space-y-2">
                    <p className="text-[11px] text-muted-foreground">
                      {entry.time}
                      {entry.latitude !== undefined ? ` · GPS ±${entry.gps_accuracy ?? '?'} m` : entry.gps_error ? ' · position indisponible' : ''}
                      {entry.gps_distance_m !== undefined ? ` · à ${entry.gps_distance_m} m du point` : ''}
                    </p>
                    <button type="button" onClick={() => patchDone(cp.id, { anomaly: !entry.anomaly })}
                      className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${entry.anomaly ? 'border-red-300 bg-red-50 text-red-600' : 'border-border text-muted-foreground hover:border-red-300'}`}>
                      <AlertTriangle className="w-3 h-3" />
                      {entry.anomaly ? '⚠️ Anomalie signalée (entrée MC auto)' : 'Signaler une anomalie'}
                    </button>
                    <input className="w-full text-xs border border-input rounded px-2 py-1 bg-background" placeholder="Note (optionnel)..." value={entry.note} onChange={(e) => patchDone(cp.id, { note: e.target.value })} />
                  </div>
                )}
                {skip && <p className="ml-11 text-xs text-slate-600">Inaccessible : {skip.reason}</p>}
                {!entry && !skip && (
                  <div className="ml-11 flex flex-wrap gap-2">
                    {hasTag && supported && (
                      <Button size="sm" className="h-7 text-xs gap-1" onClick={() => scanCheckpoint(cp)}><ScanLine className="w-3 h-3" /> Scanner le badge</Button>
                    )}
                    {legacyManualAllowed && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => validateManually(cp)}><MapPin className="w-3 h-3" /> Valider manuellement (point sans badge)</Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => markInaccessible(cp)}><Ban className="w-3 h-3" /> Point inaccessible</Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {mustFinishAll && (
        <p className="text-xs text-muted-foreground">Tous les points doivent être contrôlés pour terminer cette ronde (saut de points non autorisé).</p>
      )}
      <p className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 rounded-lg p-2">
        📋 La main courante est générée automatiquement à la fin de la ronde, avec les anomalies. Si le réseau coupe, la ronde est gardée sur le téléphone et envoyée au retour de la connexion.
      </p>

      <Button className="w-full gap-2" onClick={handleFinish} disabled={!canFinish} data-testid="ronde-finish">
        {loading ? 'Enregistrement…' : libre ? 'Terminer la ronde libre' : `Terminer la ronde (${done.length}/${checkpoints.length})`}
      </Button>
    </div>
  );
}
