import test from 'node:test';
import assert from 'node:assert/strict';
import { createOutbox, memoryStorage } from './ptiOutbox.js';
import { protectionFlags } from './ptiRules.js';

test('perte de réseau : l’alerte reste locale tant que le serveur n’accuse pas réception', async () => {
  const outbox = createOutbox(memoryStorage());
  outbox.enqueue({
    client_event_id: 'evt-1',
    type: 'sos',
    transmission_status: 'received',
    received_at: '1999-01-01T00:00:00.000Z',
  });
  let stored = outbox.list()[0];
  assert.equal(stored.transmission_status, 'local_pending');
  assert.equal(stored.payload.transmission_status, undefined);

  await outbox.flush(async () => {
    throw new Error('réseau coupé');
  });
  stored = outbox.list()[0];
  assert.equal(stored.transmission_status, 'local_pending');
  assert.match(stored.last_error, /réseau/);

  await outbox.flush(async () => ({ ok: true }));
  stored = outbox.list()[0];
  assert.equal(stored.transmission_status, 'local_pending');
  assert.equal(stored.last_error, 'accusé de réception absent');

  const flags = protectionFlags({
    onDuty: true,
    pendingCount: outbox.pending().length,
    lastReceived: stored,
  });
  assert.equal(flags.banners.includes('alert_pending'), true);
  assert.equal(flags.banners.includes('alert_confirmed'), false);

  await outbox.flush(async () => ({
    id: 'pti_serveur',
    transmission_status: 'received',
    received_at: '2026-11-01T08:00:00.000Z',
  }));
  stored = outbox.list()[0];
  assert.equal(stored.transmission_status, 'received');
  assert.equal(stored.server_id, 'pti_serveur');
  assert.equal(outbox.pending().length, 0);
  const confirmed = protectionFlags({
    onDuty: true,
    pendingCount: 0,
    lastReceived: { id: stored.server_id, transmission_status: stored.transmission_status },
  });
  assert.equal(confirmed.banners.includes('alert_confirmed'), true);
});
