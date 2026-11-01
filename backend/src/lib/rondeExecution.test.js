import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRunItems,
  createRondeOutbox,
  distanceMeters,
  matchScan,
} from '../../../base44-export/src/lib/rondeExecution.js';

const memoryStorage = () => {
  const store = new Map();
  return { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
};

const ronde = {
  id: 'r1', name: 'Ouverture', site_id: 's1', site_name: 'Site A', client_id: 'c1', client_name: 'Client',
  checkpoints: [
    { id: 'a', name: 'Hall', nfc_tag_id: '04:AA:01' },
    { id: 'b', name: 'Parking', nfc_tag_id: '04:AA:02' },
  ],
};

test('un badge n’est accepté que pour son propre point', () => {
  assert.equal(matchScan(ronde.checkpoints, ronde.checkpoints[0], '04aa01').ok, true);
  const autre = matchScan(ronde.checkpoints, ronde.checkpoints[0], '04:aa:02');
  assert.equal(autre.ok, false);
  assert.equal(autre.reason, 'autre_point');
  assert.equal(autre.other.id, 'b');
  assert.equal(matchScan(ronde.checkpoints, ronde.checkpoints[0], 'FF').reason, 'inconnu');
  assert.equal(matchScan(ronde.checkpoints, { id: 'x', name: 'Sans tag' }, '04AA01').reason, 'sans_tag');
});

test('distance GPS en mètres', () => {
  const d = distanceMeters({ latitude: 48.8566, longitude: 2.3522 }, { latitude: 48.8576, longitude: 2.3522 });
  assert.ok(d > 100 && d < 125);
  assert.equal(distanceMeters({}, { latitude: 1, longitude: 1 }), null);
});

test('le lot d’une ronde NFC contient exécution, main courante, anomalies et alerte avec identifiants stables', () => {
  const start = new Date('2026-11-01T09:00:00');
  const end = new Date('2026-11-01T09:20:00');
  const done = [
    { pointeau_id: 'a', checkpoint_id: 'a', checkpoint_name: 'Hall', nfc_validated: true, nfc_serial: '04:AA:01', anomaly: true, note: 'Porte ouverte', latitude: 1, longitude: 2 },
  ];
  const items = buildRunItems({ runId: 'run1', ronde, service: { id: 'svc', mission_id: 'm' }, companyId: 'co', agentId: 'ag', agentName: 'Agent', startedAt: start, endedAt: end, done });
  assert.deepEqual(items.map((i) => i.entity), ['RondeExecution', 'MainCourante', 'MainCourante', 'Alerte']);
  assert.deepEqual(items.map((i) => i.data.client_event_id), ['run1:exec', 'run1:mc-fin', 'run1:mc-anomalie-0', 'run1:alerte']);
  const execution = items[0].data;
  assert.equal(execution.status, 'incomplete');
  assert.equal(execution.client_id, 'c1');
  assert.equal(execution.checkpoints_done[0].pointeau_id, 'a');
  assert.equal(execution.start_at, start.toISOString());
  assert.match(items[2].data.content, /Porte ouverte/);
});

test('la ronde libre n’a ni point ni tag et se termine complète', () => {
  const libre = { id: 'libre-s1', libre: true, name: 'Ronde libre', site_id: 's1', site_name: 'Site A', checkpoints: [] };
  const items = buildRunItems({
    runId: 'run2', ronde: libre, service: null, companyId: 'co', agentId: 'ag', agentName: 'Agent',
    startedAt: new Date('2026-11-01T10:00:00'), endedAt: new Date('2026-11-01T10:10:00'),
    controles: [{ label: 'Portail', anomaly: true, note: 'Cadenas forcé' }], observations: 'RAS ailleurs',
  });
  const execution = items[0].data;
  assert.equal(execution.type, 'libre');
  assert.equal(execution.status, 'terminee');
  assert.equal(execution.checkpoints_done.length, 0);
  assert.equal(execution.anomalies.length, 1);
  assert.equal(items.filter((i) => i.entity === 'MainCourante').length, 3 - 1);
});

test('l’outbox rejoue sans doublon, conserve les envois hors ligne et isole les refus', async () => {
  const outbox = createRondeOutbox(memoryStorage());
  const lot = (runId) => [
    { entity: 'RondeExecution', runId, data: { client_event_id: `${runId}:exec` } },
    { entity: 'MainCourante', runId, data: { client_event_id: `${runId}:mc` } },
  ];
  outbox.enqueue(lot('r1'));
  outbox.enqueue(lot('r1'));
  assert.equal(outbox.pending().length, 2);

  const horsLigne = await outbox.flush(async () => { throw new TypeError('Failed to fetch'); });
  assert.deepEqual(horsLigne, { sent: 0, pending: 2, rejected: 0 });

  const envoyes = [];
  const ok = await outbox.flush(async (item) => { envoyes.push(item.data.client_event_id); });
  assert.deepEqual(ok, { sent: 2, pending: 0, rejected: 0 });
  assert.deepEqual(envoyes, ['r1:exec', 'r1:mc']);

  outbox.enqueue(lot('r2'));
  const refus = await outbox.flush(async (item) => {
    if (item.entity === 'RondeExecution') { const e = new Error('Badge différent'); e.status = 409; throw e; }
  });
  assert.deepEqual(refus, { sent: 0, pending: 0, rejected: 2 });
  assert.equal(outbox.rejected()[0].error, 'Badge différent');
  outbox.dismissRejected('r2');
  assert.equal(outbox.rejected().length, 0);
});

test('flush : deux appels simultanés n’envoient chaque élément qu’une fois et ne perdent pas un ajout en cours', async () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const outbox = createRondeOutbox(storage, 'test');
  const item = (id) => ({ entity: 'MainCourante', runId: 'r', data: { client_event_id: id } });
  outbox.enqueue([item('a'), item('b')]);
  const sent = [];
  const send = async (it) => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (it.data.client_event_id === 'a') outbox.enqueue([item('c')]);
    sent.push(it.data.client_event_id);
  };
  await Promise.all([outbox.flush(send), outbox.flush(send)]);
  assert.deepEqual(sent, ['a', 'b', 'c']);
  assert.equal(outbox.pending().length, 0);
});
