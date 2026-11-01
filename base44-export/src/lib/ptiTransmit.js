import { base44 } from '@/api/base44Client';
import { createOutbox } from '@/lib/ptiOutbox';

function browserStorage() {
  if (typeof localStorage !== 'undefined') return localStorage;
  const mem = new Map();
  return {
    getItem: (key) => (mem.has(key) ? mem.get(key) : null),
    setItem: (key, value) => mem.set(key, String(value)),
  };
}

let box;
export function ptiOutbox() {
  if (!box) box = createOutbox(browserStorage());
  return box;
}

export function newPtiEventId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `pti_${crypto.randomUUID()}`;
  return `pti_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export async function flushPtiOutbox() {
  return ptiOutbox().flush((body) => base44.pti.submitAlert(body));
}

export async function transmitPtiAlert(payload) {
  const clientEventId = payload?.client_event_id || newPtiEventId();
  ptiOutbox().enqueue({ ...payload, client_event_id: clientEventId });
  await flushPtiOutbox();
  return ptiOutbox().list().find((item) => item.client_event_id === clientEventId) || null;
}
