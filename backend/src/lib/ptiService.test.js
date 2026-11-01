import test from 'node:test';
import assert from 'node:assert/strict';
import {
  actOnPtiAlert,
  applyPtiDue,
  getEffectivePti,
  getPtiConfig,
  listPtiAlerts,
  savePtiConfig,
  submitPtiAlert,
} from './ptiService.js';

function memoryDb() {
  const settings = new Map();
  const alertes = [];
  const agents = [];
  return {
    companySettings: {
      async findUnique({ where }) {
        return settings.get(where.id) || null;
      },
      async upsert({ where, create, update }) {
        const existing = settings.get(where.id);
        if (!existing) {
          const row = { ...create, createdAt: new Date(), updatedAt: new Date() };
          settings.set(where.id, row);
          return row;
        }
        const row = { ...existing, ...update, id: where.id, updatedAt: new Date() };
        settings.set(where.id, row);
        return row;
      },
    },
    alerte: {
      async create({ data }) {
        const row = { ...data, createdAt: new Date(), updatedAt: new Date() };
        alertes.push(row);
        return row;
      },
      async findMany({ where }) {
        return alertes.filter((row) => !where?.companyId || row.companyId === where.companyId);
      },
      async findUnique({ where }) {
        return alertes.find((row) => row.id === where.id) || null;
      },
      async update({ where, data }) {
        const row = alertes.find((item) => item.id === where.id);
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      },
    },
    agent: {
      async findMany({ where }) {
        return agents.filter((row) => row.companyId === where.companyId);
      },
      async findUnique({ where }) {
        return agents.find((row) => row.id === where.id) || null;
      },
    },
    _agents: agents,
  };
}

const admin = { sub: 'admin-1', email: 'admin@exemple.test', role: 'admin', companyId: 'co-a' };
const supervisor = { sub: 'sup-1', email: 'sup@exemple.test', role: 'supervisor', companyId: 'co-a' };
const agent = { sub: 'user-1', email: 'agent@exemple.test', role: 'agent', companyId: 'co-a' };
const agentB = { sub: 'user-2', email: 'agent-b@exemple.test', role: 'agent', companyId: 'co-b' };

test('enregistrement des paramètres et droits', async () => {
  const db = memoryDb();
  await assert.rejects(() => savePtiConfig(db, supervisor, { protection_imposed: false }), /administrateur/);
  await assert.rejects(() => savePtiConfig(db, agent, { protection_imposed: false }), /administrateur/);
  const saved = await savePtiConfig(db, admin, {
    protection_imposed: true,
    default_profile: 'ronde',
    assignments: { agents: { 'fiche-1': 'travailleur_isole' }, sites: {}, missions: {} },
    profiles: { travailleur_isole: { gps_radius_m: 80 } },
  });
  assert.equal(saved.config.default_profile, 'ronde');
  assert.equal(saved.config.assignments.agents['fiche-1'], 'travailleur_isole');
  assert.equal(saved.config.profiles.travailleur_isole.gps_radius_m, 80);
  assert.equal(saved.config.profiles.poste_fixe.gps_radius_m, 100);
  const read = await getPtiConfig(db, supervisor);
  assert.equal(read.can_edit, false);
  assert.equal(read.config.assignments.agents['fiche-1'], 'travailleur_isole');
  await assert.rejects(() => getPtiConfig(db, agent), /Accès refusé/);
});

test('attribution de profil et transmission avec accusé', async () => {
  const db = memoryDb();
  db._agents.push({ id: 'fiche-1', companyId: 'co-a', data: { email: 'agent@exemple.test', phone: '0600000000' } });
  await savePtiConfig(db, admin, {
    assignments: { agents: { 'fiche-1': 'patrouille_mobile' }, sites: { s1: 'ronde' }, missions: {} },
    mission_overrides: { m1: { gps_radius_m: 45 } },
  });
  const effective = await getEffectivePti(db, agent, { agent_id: 'fiche-1', site_id: 's1', mission_id: 'm1' });
  assert.equal(effective.gps_radius_m, 45);
  assert.equal(effective.source, 'mission_override');
  const other = await getEffectivePti(db, agent, { agent_id: 'fiche-1', site_id: 's1', mission_id: 'm2' });
  assert.equal(other.profile_key, 'ronde');
  assert.equal(other.gps_radius_m, 100);

  const first = await submitPtiAlert(db, agent, {
    type: 'sos',
    client_event_id: 'local-1',
    agent_id: 'fiche-1',
    agent_name: 'MARTIN Lea',
    mission_id: 'm1',
    site_id: 's1',
    site_name: 'Entrepôt',
    latitude: 43.6,
    longitude: 1.4,
    accuracy_m: 12,
    battery_level: 18,
    connection_state: 'online',
    transmission_status: 'local_pending',
    detail: 'SOS',
  }, '2026-11-01T08:00:00.000Z');
  assert.equal(first.transmission_status, 'received');
  assert.equal(first.received_at, '2026-11-01T08:00:00.000Z');
  assert.equal(first.company_id, 'co-a');
  const again = await submitPtiAlert(db, agent, {
    type: 'sos',
    client_event_id: 'local-1',
    agent_id: 'fiche-1',
  }, '2026-11-01T08:05:00.000Z');
  assert.equal(again.id, first.id);
  assert.equal(again.received_at, first.received_at);
  const listed = await listPtiAlerts(db, supervisor);
  assert.equal(listed.length, 1);
  await assert.rejects(() => submitPtiAlert(db, supervisor, { type: 'sos', client_event_id: 'x' }), /agent/);
  await assert.rejects(() => submitPtiAlert(db, agentB, {
    type: 'sos',
    client_event_id: 'local-b',
    agent_id: 'fiche-1',
  }), /fiche/);
});

test('traitement, historique, escalade et isolation société', async () => {
  const db = memoryDb();
  db._agents.push({ id: 'fiche-1', companyId: 'co-a', data: { email: 'agent@exemple.test', phone: '0600000000' } });
  const created = await submitPtiAlert(db, agent, {
    type: 'chute',
    client_event_id: 'local-2',
    agent_id: 'fiche-1',
    agent_name: 'MARTIN Lea',
  }, '2026-11-01T08:00:00.000Z');
  await assert.rejects(() => actOnPtiAlert(db, agent, created.id, { action: 'acknowledge' }), /encadrement/);
  const ack = await actOnPtiAlert(db, supervisor, created.id, { action: 'acknowledge' }, '2026-11-01T08:00:05.000Z');
  assert.equal(ack.alert.ack_status, 'acknowledged');
  assert.equal(ack.alert.history.at(-1).by, 'sup-1');
  const contact = await actOnPtiAlert(db, supervisor, created.id, { action: 'contact', detail: 'Appel' }, '2026-11-01T08:00:06.000Z');
  assert.equal(contact.phone, '0600000000');
  await actOnPtiAlert(db, supervisor, created.id, { action: 'doubt', result: 'Agent joint' }, '2026-11-01T08:00:07.000Z');
  await assert.rejects(() => actOnPtiAlert(db, supervisor, created.id, { action: 'close', motif: '' }), /Motif/);
  const closed = await actOnPtiAlert(db, supervisor, created.id, { action: 'close', motif: 'Fausse alerte' }, '2026-11-01T08:00:08.000Z');
  assert.equal(closed.alert.history.length, 5);
  const own = await listPtiAlerts(db, agent);
  assert.equal(own.length, 1);
  const foreign = await listPtiAlerts(db, agentB);
  assert.equal(foreign.length, 0);
  await assert.rejects(() => actOnPtiAlert(db, { ...supervisor, companyId: 'co-b' }, created.id, { action: 'escalate' }), /introuvable/);
});

test('relance automatique échue puis escalade', async () => {
  const db = memoryDb();
  const created = await submitPtiAlert(db, agent, {
    type: 'immobilite',
    client_event_id: 'local-3',
    agent_id: 'user-1',
  }, '2026-11-01T08:00:00.000Z');
  const none = await applyPtiDue(db, supervisor, '2026-11-01T08:00:10.000Z');
  assert.equal(none.length, 0);
  const relance = await applyPtiDue(db, supervisor, '2026-11-01T08:00:31.000Z');
  assert.equal(relance.length, 1);
  assert.equal(relance[0].history.some((item) => item.action === 'relance'), true);
  const escalade = await applyPtiDue(db, supervisor, '2026-11-01T08:01:32.000Z');
  assert.equal(escalade[0].ack_status, 'escalated');
  assert.equal(escalade[0].id, created.id);
  await assert.rejects(() => applyPtiDue(db, agent, '2026-11-01T09:00:00.000Z'), /Accès refusé/);
});
