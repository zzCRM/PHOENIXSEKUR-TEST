import { nfcTagsMatch } from './pointeaux.js';

export const OUTBOX_KEY = 'phoenix_ronde_outbox_v1';
export const DRAFT_PREFIX = 'phoenix_ronde_draft_v1:';

export function newRunId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function distanceMeters(a, b) {
  const lat1 = Number(a?.latitude);
  const lon1 = Number(a?.longitude);
  const lat2 = Number(b?.latitude);
  const lon2 = Number(b?.longitude);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;
  const rad = (deg) => (deg * Math.PI) / 180;
  const h = Math.sin(rad(lat2 - lat1) / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return Math.round(2 * 6371000 * Math.asin(Math.sqrt(h)));
}

export function matchScan(checkpoints, checkpoint, serial) {
  if (!checkpoint?.nfc_tag_id) return { ok: false, reason: 'sans_tag' };
  if (nfcTagsMatch(serial, checkpoint.nfc_tag_id)) return { ok: true };
  const other = (checkpoints || []).find((cp) => cp.id !== checkpoint.id && nfcTagsMatch(serial, cp.nfc_tag_id));
  return other ? { ok: false, reason: 'autre_point', other } : { ok: false, reason: 'inconnu' };
}

export function isLibre(ronde) {
  return ronde?.libre === true || ronde?.type === 'libre' || String(ronde?.id || '').startsWith('libre-');
}

const pad = (n) => String(n).padStart(2, '0');
export const hm = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
export const ymd = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export function buildReportText({ ronde, checkpoints, done, skipped, anomalies, observations, controles, agentName, time, libre }) {
  const lines = [`RAPPORT DE RONDE${libre ? ' LIBRE' : ''} - "${ronde.name}"${ronde.site_name ? ` - ${ronde.site_name}` : ''}`];
  lines.push(`Agent : ${agentName} | Heure : ${time}`);
  if (libre) {
    if (observations) lines.push('', `Observations : ${observations}`);
    if (controles.length) {
      lines.push('', 'Contrôles effectués :');
      controles.forEach((item) => lines.push(`  • ${item.label}${item.anomaly ? ' ⚠️ ANOMALIE' : ''}${item.note ? ` — ${item.note}` : ''}`));
    }
  } else {
    lines.push(`Points validés : ${done.length}/${checkpoints.length}`, '');
    if (done.length) {
      lines.push('✅ Points contrôlés :');
      done.forEach((entry) => lines.push(`  • ${entry.checkpoint_name}${entry.anomaly ? ' ⚠️ ANOMALIE' : ''}${entry.note ? ` — ${entry.note}` : ''}`));
    }
    const missed = checkpoints.filter((cp) => !done.some((entry) => entry.checkpoint_id === cp.id));
    if (missed.length) {
      lines.push('', '❌ Points non contrôlés :');
      missed.forEach((cp) => {
        const skip = skipped.find((item) => item.checkpoint_id === cp.id);
        lines.push(`  • ${cp.name}${skip ? ` (inaccessible : ${skip.reason})` : ''}`);
      });
    }
  }
  if (anomalies.length) {
    lines.push('', `⚠️ ANOMALIES (${anomalies.length}) :`);
    anomalies.forEach((item) => lines.push(`  • ${item.label}${item.note ? ` : ${item.note}` : ''}`));
  } else {
    lines.push('', '✅ Aucune anomalie constatée.');
  }
  return lines.join('\n');
}

export function buildRunItems({
  runId, ronde, service, companyId, agentId, agentName, startedAt, endedAt,
  done = [], skipped = [], controles = [], observations = '', extraAnomalies = [],
}) {
  const libre = isLibre(ronde);
  const checkpoints = ronde.checkpoints || [];
  const startTime = hm(startedAt);
  const endTime = hm(endedAt);
  const date = ymd(startedAt);

  const pointAnomalies = done
    .filter((entry) => entry.anomaly)
    .map((entry) => ({ label: `Point : ${entry.checkpoint_name}`, note: entry.note || '' }));
  const controleAnomalies = controles
    .filter((item) => item.anomaly)
    .map((item) => ({ label: `Contrôle : ${item.label}`, note: item.note || '' }));
  const skippedAnomalies = skipped.map((item) => ({ label: `Point inaccessible : ${item.checkpoint_name}`, note: item.reason }));
  const anomalies = [...pointAnomalies, ...controleAnomalies, ...skippedAnomalies, ...extraAnomalies];
  const complete = libre ? true : done.length === checkpoints.length;

  const common = {
    company_id: companyId,
    site_id: ronde.site_id || '',
    site_name: ronde.site_name || '',
    client_id: ronde.client_id || service?.client_id || '',
    client_name: ronde.client_name || service?.client_name || '',
    agent_id: agentId,
    agent_name: agentName,
    mission_id: service?.mission_id || '',
  };
  const mcCommon = { ...common, service_id: service?.id || '', date, time: endTime };

  const items = [{
    entity: 'RondeExecution',
    data: {
      ...common,
      client_event_id: `${runId}:exec`,
      type: libre ? 'libre' : 'personnalisee',
      ronde_libre: libre || undefined,
      ronde_id: ronde.id,
      ronde_name: ronde.name,
      service_id: service?.id || '',
      date,
      start_time: startTime,
      end_time: endTime,
      start_at: startedAt.toISOString(),
      end_at: endedAt.toISOString(),
      status: complete ? 'terminee' : 'incomplete',
      checkpoints_done: done,
      checkpoints_skipped: skipped,
      controles,
      observations,
      anomalies,
      notes: anomalies.length ? `Anomalies : ${anomalies.map((item) => item.label).join(' ; ')}` : observations,
    },
  }, {
    entity: 'MainCourante',
    data: {
      ...mcCommon,
      client_event_id: `${runId}:mc-fin`,
      type: 'fin_ronde',
      event_type: 'fin_ronde',
      content: buildReportText({ ronde, checkpoints, done, skipped, anomalies, observations, controles, agentName, time: endTime, libre }),
      severity: anomalies.length ? 'attention' : 'normal',
    },
  }];

  anomalies.forEach((item, index) => {
    items.push({
      entity: 'MainCourante',
      data: {
        ...mcCommon,
        client_event_id: `${runId}:mc-anomalie-${index}`,
        type: 'incident',
        event_type: 'incident',
        content: `⚠️ ANOMALIE ${libre ? 'ronde libre' : `ronde "${ronde.name}"`} - ${item.label}${item.note ? ` - ${item.note}` : ''}`,
        severity: 'attention',
      },
    });
  });

  items.push({
    entity: 'Alerte',
    data: {
      ...common,
      client_event_id: `${runId}:alerte`,
      type: 'fin_ronde',
      message: `${agentName} a terminé la ${libre ? 'ronde libre' : `ronde "${ronde.name}"`}${ronde.site_name ? ` sur ${ronde.site_name}` : ''} à ${endTime}${libre ? '' : ` — ${done.length}/${checkpoints.length} points`}${anomalies.length ? ` — ⚠️ ${anomalies.length} anomalie(s)` : ''}`,
      date,
      time: endTime,
      severity: anomalies.length ? 'attention' : 'info',
    },
  });

  return items.map((item) => ({ ...item, runId }));
}

export function createRondeOutbox(storage, key = OUTBOX_KEY) {
  const read = () => {
    try {
      const parsed = JSON.parse(storage.getItem(key) || '{}');
      return { pending: Array.isArray(parsed.pending) ? parsed.pending : [], rejected: Array.isArray(parsed.rejected) ? parsed.rejected : [] };
    } catch {
      return { pending: [], rejected: [] };
    }
  };
  const write = (state) => storage.setItem(key, JSON.stringify(state));
  let chain = Promise.resolve();

  return {
    pending: () => read().pending,
    rejected: () => read().rejected,
    enqueue(items) {
      const state = read();
      for (const item of items) {
        if (!state.pending.some((other) => other.data.client_event_id === item.data.client_event_id)) state.pending.push(item);
      }
      write(state);
    },
    dismissRejected(runId) {
      const state = read();
      state.rejected = state.rejected.filter((item) => item.runId !== runId);
      write(state);
    },
    flush(send) {
      chain = chain.then(() => doFlush(send), () => doFlush(send));
      return chain;
    },
  };

  async function doFlush(send) {
      const state = read();
      const remaining = [];
      const sent = [];
      let blocked = false;
      const rejectedRuns = new Map();
      for (const item of state.pending) {
        if (rejectedRuns.has(item.runId)) {
          state.rejected.push({ ...item, error: rejectedRuns.get(item.runId) });
          continue;
        }
        if (blocked) {
          remaining.push(item);
          continue;
        }
        try {
          await send(item);
          sent.push(item);
        } catch (error) {
          const status = error?.status;
          const retryable = status === undefined || status >= 500 || status === 401 || status === 408 || status === 429;
          if (retryable) {
            blocked = true;
            remaining.push(item);
          } else {
            const message = error?.message || `Refusé (${status})`;
            state.rejected.push({ ...item, error: message });
            if (item.entity === 'RondeExecution') rejectedRuns.set(item.runId, message);
          }
        }
      }
      const settled = new Set(state.pending.filter((item) => !remaining.includes(item)).map((item) => item.data.client_event_id));
      const latest = read();
      const pending = latest.pending.filter((item) => !settled.has(item.data.client_event_id));
      write({ pending, rejected: state.rejected });
      return { sent: sent.length, pending: pending.length, rejected: state.rejected.length };
  }
}
