import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, MapPin, ScanLine, Smartphone, X } from 'lucide-react';
import { format } from 'date-fns';
import { useNfcScan } from '@/hooks/useNfcScan';

export default function RondeNFC({ ronde, currentService, companyId, agentId, agentName, onFinish }) {
  const checkpoints = ronde.checkpoints || [];
  const [done, setDone] = useState([]);
  const [nfcValidated, setNfcValidated] = useState({}); // cpId -> serialNumber
  const [anomalies, setAnomalies] = useState({});
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(false);
  const [finished, setFinished] = useState(false);
  const [scanningFor, setScanningFor] = useState(null); // cpId en cours de scan
  const [scanError, setScanError] = useState('');

  const { status, tagId, error, supported, scan, stop, reset } = useNfcScan();

  // Valider un point via scan NFC — compare au nfc_tag_id attendu si défini
  const scanCheckpoint = (cp) => {
    if (done.includes(cp.id)) return;
    setScanError('');
    setScanningFor(cp.id);
    scan(45000)
      .then((id) => {
        const expected = cp.nfc_tag_id;
        if (expected && expected !== id && !id.startsWith('NFC-')) {
          // Mismatch : on accepte mais on avertit
          setScanError(`Badge lu (${id}) différent de celui enregistré (${expected}). Point validé malgré tout.`);
        }
        setNfcValidated(prev => ({ ...prev, [cp.id]: id }));
        setDone(prev => [...prev, cp.id]);
        setScanningFor(null);
      })
      .catch(() => {
        // timeout ou erreur : on reste en idle, l'utilisateur peut réessayer ou valider manuellement
        setScanningFor(null);
        if (error) setScanError(error);
      });
  };

  const cancelScan = () => { stop(); setScanningFor(null); };

  // Validation manuelle (secours — utile sur iPhone ou si NFC indisponible)
  const validateCheckpoint = (cp) => {
    if (done.includes(cp.id)) return;
    setDone(prev => [...prev, cp.id]);
  };

  const toggleAnomaly = (cpId) => {
    setAnomalies(prev => ({ ...prev, [cpId]: !prev[cpId] }));
  };

  const handleFinish = async () => {
    setLoading(true);
    const now = format(new Date(), 'HH:mm');
    const today = format(new Date(), 'yyyy-MM-dd');

    const checkpointsDone = done.map(cpId => {
      const cp = checkpoints.find(c => c.id === cpId);
      return {
        checkpoint_id: cpId,
        checkpoint_name: cp?.name || cpId,
        time: now,
        note: notes[cpId] || '',
        anomaly: anomalies[cpId] || false,
        nfc_validated: !!nfcValidated[cpId],
        nfc_serial: nfcValidated[cpId] || '',
      };
    });

    const anomalyList = done.filter(cpId => anomalies[cpId]);
    const hasAnomalies = anomalyList.length > 0;
    const isComplete = done.length === checkpoints.length;

    // Enregistrement ronde
    await base44.entities.RondeExecution.create({
      company_id: companyId,
      ronde_id: ronde.id,
      ronde_name: ronde.name,
      site_id: ronde.site_id,
      site_name: ronde.site_name,
      agent_id: agentId,
      agent_name: agentName,
      mission_id: currentService?.mission_id || '',
      date: today,
      start_time: now,
      end_time: now,
      status: isComplete ? 'terminee' : 'incomplete',
      checkpoints_done: checkpointsDone,
      notes: hasAnomalies
        ? `Anomalies détectées : ${anomalyList.map(id => checkpoints.find(c => c.id === id)?.name || id).join(', ')}`
        : '',
    });

    // Main courante auto - résumé ronde
    const mainCouranteContent = buildRondeReport(ronde, checkpoints, done, anomalies, notes, now, agentName);
    await base44.entities.MainCourante.create({
      company_id: companyId,
      site_id: ronde.site_id,
      site_name: ronde.site_name,
      agent_id: agentId,
      agent_name: agentName,
      date: today,
      time: now,
      type: 'ronde',
      content: mainCouranteContent,
      severity: hasAnomalies ? 'attention' : 'normal',
    });

    // Si anomalies → entrée MC supplémentaire par anomalie
    for (const cpId of anomalyList) {
      const cp = checkpoints.find(c => c.id === cpId);
      await base44.entities.MainCourante.create({
        company_id: companyId,
        site_id: ronde.site_id,
        site_name: ronde.site_name,
        agent_id: agentId,
        agent_name: agentName,
        date: today,
        time: now,
        type: 'incident',
        content: `⚠️ ANOMALIE ronde "${ronde.name}" - Point : ${cp?.name || cpId}${notes[cpId] ? ` - Note : ${notes[cpId]}` : ''}`,
        severity: 'attention',
      });
    }

    // Alerte fin ronde
    await base44.entities.Alerte.create({
      company_id: companyId,
      type: 'fin_ronde',
      agent_id: agentId,
      agent_name: agentName,
      site_id: ronde.site_id,
      site_name: ronde.site_name,
      message: `${agentName} a terminé la ronde "${ronde.name}" sur ${ronde.site_name} à ${now} — ${done.length}/${checkpoints.length} points${hasAnomalies ? ` — ⚠️ ${anomalyList.length} anomalie(s)` : ''}`,
      date: today,
      time: now,
      severity: hasAnomalies ? 'attention' : 'info',
    });

    setLoading(false);
    setFinished(true);
    setTimeout(() => onFinish(), 1500);
  };

  if (finished) {
    return (
      <div className="text-center py-12">
        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-3" />
        <p className="text-lg font-bold text-green-600">Ronde terminée !</p>
        <p className="text-sm text-muted-foreground mt-1">{done.length}/{checkpoints.length} points — Main courante générée automatiquement</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold">{ronde.name}</p>
        <Badge variant="outline">{done.length}/{checkpoints.length} validés</Badge>
      </div>

      {/* Alerte NFC indisponible (iPhone / navigateur sans Web NFC) */}
      {!supported && (
        <div className="flex items-start gap-2 text-xs bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-amber-700">
          <Smartphone className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Scan NFC indisponible sur cet appareil (iPhone ou navigateur non compatible). Validation manuelle disponible pour chaque point.</span>
        </div>
      )}

      {/* Panneau de scan actif */}
      {scanningFor && (
        <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-4 flex flex-col items-center text-center gap-2">
          <div className="relative w-16 h-16 flex items-center justify-center">
            <span className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
            <span className="absolute inset-2 rounded-full border-2 border-primary/40 animate-ping" style={{ animationDelay: '0.25s' }} />
            <ScanLine className="w-7 h-7 text-primary relative" />
          </div>
          <p className="text-sm font-semibold text-primary">Scannez le point : {checkpoints.find(c => c.id === scanningFor)?.name}</p>
          <p className="text-xs text-muted-foreground">Approchez le badge NFC du dos du téléphone</p>
          {scanError && <p className="text-xs text-amber-600 max-w-xs">{scanError}</p>}
          <Button size="sm" variant="outline" className="gap-1 mt-1" onClick={cancelScan}>
            <X className="w-3.5 h-3.5" /> Annuler le scan
          </Button>
        </div>
      )}

      {scanError && !scanningFor && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{scanError}</p>
      )}

      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
        {checkpoints.map((cp, idx) => {
          const isDone = done.includes(cp.id);
          const nfcOk = !!nfcValidated[cp.id];
          return (
            <div key={cp.id} className={`p-3 rounded-xl border transition-all ${isDone ? anomalies[cp.id] ? 'border-amber-300 bg-amber-50' : 'border-green-300 bg-green-50' : 'border-border bg-card'}`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  isDone ? (anomalies[cp.id] ? 'border-amber-500 bg-amber-500 text-white' : 'border-green-500 bg-green-500 text-white') : 'border-muted-foreground'
                }`}>
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-xs font-bold">{idx + 1}</span>}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{cp.name}</p>
                  {cp.description && <p className="text-xs text-muted-foreground">{cp.description}</p>}
                </div>
                {nfcOk && <Badge variant="outline" className="gap-1 text-emerald-700 border-emerald-300 bg-emerald-50"><ScanLine className="w-3 h-3" /> NFC</Badge>}
              </div>
              {isDone && (
                <div className="ml-11 space-y-2">
                  {nfcOk && <p className="text-[11px] font-mono text-muted-foreground">Badge : {nfcValidated[cp.id]}</p>}
                  <button
                    onClick={() => toggleAnomaly(cp.id)}
                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${anomalies[cp.id] ? 'border-red-300 bg-red-50 text-red-600' : 'border-border text-muted-foreground hover:border-red-300'}`}
                  >
                    <AlertTriangle className="w-3 h-3" />
                    {anomalies[cp.id] ? '⚠️ Anomalie signalée (entrée MC auto)' : 'Signaler une anomalie'}
                  </button>
                  <input
                    className="w-full text-xs border border-input rounded px-2 py-1 bg-background"
                    placeholder="Note (optionnel)..."
                    value={notes[cp.id] || ''}
                    onChange={e => setNotes(prev => ({ ...prev, [cp.id]: e.target.value }))}
                  />
                </div>
              )}
              {!isDone && (
                <div className="ml-11 flex flex-wrap gap-2">
                  {supported ? (
                    <Button size="sm" className="h-7 text-xs gap-1" onClick={() => scanCheckpoint(cp)}>
                      <ScanLine className="w-3 h-3" /> Scanner le badge
                    </Button>
                  ) : null}
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => validateCheckpoint(cp)}>
                    <MapPin className="w-3 h-3" /> Valider manuellement
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 rounded-lg p-2">
        📋 La main courante sera générée automatiquement à la fin de la ronde, incluant toutes les anomalies constatées.
      </p>

      <Button
        className="w-full gap-2"
        onClick={handleFinish}
        disabled={loading || done.length === 0}
      >
        {loading ? 'Enregistrement et génération MC...' : `Terminer la ronde (${done.length}/${checkpoints.length})`}
      </Button>
    </div>
  );
}

function buildRondeReport(ronde, checkpoints, done, anomalies, notes, time, agentName) {
  const total = checkpoints.length;
  const doneCount = done.length;
  const anomalyList = done.filter(id => anomalies[id]);
  const skipped = checkpoints.filter(cp => !done.includes(cp.id)).map(cp => cp.name);

  let report = `RAPPORT DE RONDE - "${ronde.name}" - ${ronde.site_name}\n`;
  report += `Agent : ${agentName} | Heure : ${time}\n`;
  report += `Points validés : ${doneCount}/${total}\n\n`;

  if (doneCount > 0) {
    report += `✅ Points contrôlés :\n`;
    done.forEach(id => {
      const cp = checkpoints.find(c => c.id === id);
      if (!cp) return;
      report += `  • ${cp.name}`;
      if (anomalies[id]) report += ` ⚠️ ANOMALIE`;
      if (notes[id]) report += ` — ${notes[id]}`;
      report += `\n`;
    });
  }

  if (skipped.length > 0) {
    report += `\n❌ Points non contrôlés :\n`;
    skipped.forEach(name => { report += `  • ${name}\n`; });
  }

  if (anomalyList.length > 0) {
    report += `\n⚠️ ANOMALIES DÉTECTÉES (${anomalyList.length}) :\n`;
    anomalyList.forEach(id => {
      const cp = checkpoints.find(c => c.id === id);
      report += `  • ${cp?.name || id}${notes[id] ? ` : ${notes[id]}` : ''}\n`;
    });
  } else {
    report += `\n✅ Aucune anomalie constatée.`;
  }

  return report;
}