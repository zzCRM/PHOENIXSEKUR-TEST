import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';

const enabled = Boolean(process.env.DATABASE_URL);
const skip = enabled ? false : 'DATABASE_URL absent : test d’intégration ignoré';

let server;
let base;
let prisma;
let signToken;
const companyId = `test-${randomUUID()}`;
const autreSociete = `test-${randomUUID()}`;
const tokens = {};

async function api(method, path, { token = tokens.admin, body } = {}) {
  const response = await fetch(`${base}/api/entities${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, body: json };
}

const create = (entity, body, options) => api('POST', `/${entity}`, { ...options, body });

let siteA;
let siteB;
let agentId;

before(async () => {
  if (!enabled) return;
  ({ prisma } = await import('../lib/prisma.js'));
  ({ signToken } = await import('../middleware/auth.js'));
  const { authMiddleware } = await import('../middleware/auth.js');
  const { default: entityRoutes } = await import('./entities.js');
  const app = express();
  app.use(express.json());
  app.use(authMiddleware);
  app.use('/api/entities', entityRoutes);
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;

  tokens.admin = signToken({ id: 'u-admin', email: 'admin@test.fr', role: 'admin', companyId });
  tokens.agent = signToken({ id: 'u-agent', email: 'agent@test.fr', role: 'agent', companyId });
  tokens.client = signToken({ id: 'u-client', email: 'client@test.fr', role: 'client', companyId });
  tokens.autre = signToken({ id: 'u-autre', email: 'autre@test.fr', role: 'admin', companyId: autreSociete });

  const client = await create('Client', { name: 'Client Test' });
  siteA = (await create('Site', { name: 'Site A', client_id: client.body.id, client_name: 'Client Test' })).body;
  siteB = (await create('Site', { name: 'Site B', client_id: client.body.id, client_name: 'Client Test' })).body;
  const agent = (await create('Agent', { first_name: 'A', last_name: 'Gent', email: 'agent@test.fr' })).body;
  agentId = agent.id;
  await api('PUT', `/Site/${siteA.id}`, { body: { agent_ids: [agent.id] } });
});

after(async () => {
  if (!enabled) return;
  for (const model of ['pointeau', 'ronde', 'rondeExecution', 'site', 'client', 'agent']) {
    await prisma[model].deleteMany({ where: { companyId: { in: [companyId, autreSociete] } } });
  }
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});

const pointeauBody = (site, name, tag, status = 'actif') => ({ name, site_id: site.id, status, nfc_tag_id: tag });

test('pointeaux : tag obligatoire pour être actif, brouillon sans tag accepté', { skip }, async () => {
  const refus = await create('Pointeau', pointeauBody(siteA, 'Sans tag', ''));
  assert.equal(refus.status, 400);
  assert.equal(refus.body.code, 'tag_requis');

  const brouillon = await create('Pointeau', pointeauBody(siteA, 'Brouillon', '', 'brouillon'));
  assert.equal(brouillon.status, 201);
  assert.equal(brouillon.body.status, 'brouillon');

  const sansSite = await create('Pointeau', { name: 'X', status: 'brouillon' });
  assert.equal(sansSite.body.code, 'site_requis');

  const siteEtranger = await create('Pointeau', pointeauBody(siteA, 'Autre société', '04:AA', 'actif'), { token: tokens.autre });
  assert.equal(siteEtranger.body.code, 'site_inconnu');

  const activer = await api('PUT', `/Pointeau/${brouillon.body.id}`, { body: { status: 'actif' } });
  assert.equal(activer.body.code, 'tag_requis');
  const avecTag = await api('PUT', `/Pointeau/${brouillon.body.id}`, { body: { status: 'actif', nfc_tag_id: '04:C0:01' } });
  assert.equal(avecTag.status, 200);
  assert.equal(avecTag.body.client_name, 'Client Test');
});

test('pointeaux : un tag est unique par société après normalisation, même en parallèle', { skip }, async () => {
  const premier = await create('Pointeau', pointeauBody(siteA, 'Hall', '04:AB:CD'));
  assert.equal(premier.status, 201);
  const doublon = await create('Pointeau', pointeauBody(siteB, 'Autre site', '04ab-cd'));
  assert.equal(doublon.status, 409);
  assert.equal(doublon.body.code, 'tag_deja_utilise');

  const [un, deux] = await Promise.all([
    create('Pointeau', pointeauBody(siteA, 'Course 1', '04:11:22')),
    create('Pointeau', pointeauBody(siteB, 'Course 2', '04:11:22')),
  ]);
  assert.deepEqual([un.status, deux.status].sort(), [201, 409]);

  const autreSocieteOk = await create('Pointeau', { ...pointeauBody(siteA, 'x', '04:AB:CD') }, { token: tokens.autre });
  assert.equal(autreSocieteOk.status, 400);
});

test('rondes : site obligatoire, pointeaux du site seulement, partage entre rondes du même site', { skip }, async () => {
  const hall = (await create('Pointeau', pointeauBody(siteA, 'Hall A', '04:A0:01'))).body;
  const parking = (await create('Pointeau', pointeauBody(siteA, 'Parking A', '04:A0:02'))).body;
  const etranger = (await create('Pointeau', pointeauBody(siteB, 'Hall B', '04:B0:01'))).body;
  const draft = (await create('Pointeau', pointeauBody(siteA, 'Brouillon A', '', 'brouillon'))).body;

  const sansSite = await create('Ronde', { name: 'Sans site' });
  assert.equal(sansSite.body.code, 'site_requis');

  const mauvaisSite = await create('Ronde', { name: 'Mélange', site_id: siteA.id, points: [{ pointeau_id: etranger.id }] });
  assert.equal(mauvaisSite.status, 409);
  assert.equal(mauvaisSite.body.code, 'pointeau_autre_site');

  const sansTag = await create('Ronde', { name: 'Brouillon', site_id: siteA.id, points: [{ pointeau_id: draft.id }] });
  assert.equal(sansTag.body.code, 'pointeau_inutilisable');

  const generale = await create('Ronde', { name: 'Ouverture', site_id: siteA.id, points: [{ pointeau_id: hall.id }, { pointeau_id: parking.id }] });
  assert.equal(generale.status, 201);
  assert.equal(generale.body.client_name, 'Client Test');
  assert.deepEqual(generale.body.checkpoints.map((cp) => cp.id), [hall.id, parking.id]);

  const seconde = await create('Ronde', { name: 'Fermeture', site_id: siteA.id, points: [{ pointeau_id: hall.id }] });
  assert.equal(seconde.status, 201);

  const sansService = await create('Ronde', { name: 'Générale', site_id: siteA.id });
  assert.equal(sansService.status, 201);

  const deplacer = await api('PUT', `/Ronde/${generale.body.id}`, { body: { site_id: siteB.id } });
  assert.equal(deplacer.body.code, 'pointeau_autre_site');

  const desactiver = await api('PUT', `/Pointeau/${hall.id}`, { body: { status: 'inactif' } });
  assert.equal(desactiver.status, 409);
  assert.equal(desactiver.body.code, 'pointeau_dans_rondes');

  const supprimer = await api('DELETE', `/Pointeau/${hall.id}`);
  assert.equal(supprimer.body.code, 'pointeau_utilise');

  const siteUtilise = await api('DELETE', `/Site/${siteA.id}`);
  assert.equal(siteUtilise.body.code, 'site_avec_rondes');
});

test('exécution : badge vérifié par le serveur, idempotence, heure serveur', { skip }, async () => {
  const hall = (await create('Pointeau', pointeauBody(siteA, 'Hall E', '04:E0:01'))).body;
  const ronde = (await create('Ronde', { name: 'Exec', site_id: siteA.id, points: [{ pointeau_id: hall.id }] })).body;
  const execution = (overrides = {}) => ({
    ronde_id: ronde.id,
    site_id: siteA.id,
    agent_id: agentId,
    client_event_id: randomUUID(),
    client_sent_at: new Date(Date.now() - 5000).toISOString(),
    checkpoints_done: [{ pointeau_id: hall.id, checkpoint_id: hall.id, checkpoint_name: 'Hall E', nfc_validated: true, nfc_serial: '04:e0:01', ...overrides }],
  });

  const mauvais = await create('RondeExecution', execution({ nfc_serial: '04:00:00' }), { token: tokens.agent });
  assert.equal(mauvais.status, 409);
  assert.equal(mauvais.body.code, 'tag_different');

  const manuel = await create('RondeExecution', execution({ nfc_validated: false, nfc_serial: '' }), { token: tokens.agent });
  assert.equal(manuel.body.code, 'tag_different');

  const payload = execution();
  const ok = await create('RondeExecution', payload, { token: tokens.agent });
  assert.equal(ok.status, 201);
  assert.ok(ok.body.received_at);
  assert.ok(ok.body.clock_skew_seconds >= 4);
  assert.equal(ok.body.client_id, siteA.client_id);

  const rejoue = await create('RondeExecution', payload, { token: tokens.agent });
  assert.equal(rejoue.status, 200);
  assert.equal(rejoue.body.id, ok.body.id);

  const suppression = await api('DELETE', `/Ronde/${ronde.id}`);
  assert.equal(suppression.body.code, 'ronde_avec_historique');
  const archive = await api('PUT', `/Ronde/${ronde.id}`, { body: { status: 'inactif' } });
  assert.equal(archive.status, 200);
});

test('ronde libre : aucun pointeau ni tag requis, site facultatif', { skip }, async () => {
  const libre = await create('RondeExecution', { type: 'libre', site_id: siteA.id, agent_id: agentId, checkpoints_done: [], observations: 'RAS' }, { token: tokens.agent });
  assert.equal(libre.status, 201);
  const sansSite = await create('RondeExecution', { type: 'libre', agent_id: agentId, checkpoints_done: [] }, { token: tokens.agent });
  assert.equal(sansSite.status, 201);
});

test('visibilité : l’agent lit les pointeaux de ses sites, le client ne les voit pas', { skip }, async () => {
  const visibles = await api('GET', '/Pointeau', { token: tokens.agent });
  assert.equal(visibles.status, 200);
  assert.ok(visibles.body.length > 0);
  assert.ok(visibles.body.every((item) => item.site_id === siteA.id));

  const client = await api('GET', '/Pointeau', { token: tokens.client });
  assert.equal(client.body.length, 0);

  const ecriture = await create('Pointeau', pointeauBody(siteA, 'Agent', '04:99:99'), { token: tokens.agent });
  assert.equal(ecriture.status, 403);

  const etranger = await api('GET', '/Pointeau', { token: tokens.autre });
  assert.equal(etranger.body.length, 0);
});

test('alertes : un agent peut créer les siennes sur ses sites, pas celles d’un autre ni sur un site étranger', { skip }, async () => {
  const propre = await create('Alerte', { type: 'debut_ronde', agent_id: agentId, site_id: siteA.id, message: 'Début' }, { token: tokens.agent });
  assert.equal(propre.status, 201);
  const autreAgent = await create('Alerte', { type: 'debut_ronde', agent_id: 'quelquun-d-autre', site_id: siteA.id, message: 'Usurpation' }, { token: tokens.agent });
  assert.equal(autreAgent.status, 403);
  const autreSite = await create('Alerte', { type: 'debut_ronde', agent_id: agentId, site_id: siteB.id, message: 'Hors périmètre' }, { token: tokens.agent });
  assert.equal(autreSite.status, 403);
  const lecture = await api('GET', '/Alerte', { token: tokens.agent });
  assert.equal(lecture.body.length, 0);
});

test('idempotence : deux envois simultanés du même client_event_id ne créent qu’un enregistrement', { skip }, async () => {
  const body = { type: 'incident', agent_id: agentId, site_id: siteA.id, client_event_id: `evt-${randomUUID()}`, content: 'Doublon ?' };
  const [a, b, c] = await Promise.all([1, 2, 3].map(() => create('MainCourante', body, { token: tokens.agent })));
  const statuses = [a.status, b.status, c.status].sort();
  assert.deepEqual(statuses, [200, 200, 201]);
  assert.equal(new Set([a.body.id, b.body.id, c.body.id]).size, 1);
});
