import test from 'node:test';
import assert from 'node:assert/strict';
import {
  IntegrityError,
  checkPointeau,
  checkRonde,
  checkRondeExecution,
  normalizeNfcTag,
  pointeauTagKey,
} from '../../../shared/pointeaux.js';

const site = { id: 's1', name: 'Site A', client_id: 'c1', client_name: 'Client' };
const autreSite = { id: 's2', name: 'Site B', client_id: 'c1', client_name: 'Client' };

const refuse = (fn, code) => assert.throws(fn, (err) => err instanceof IntegrityError && err.code === code);

const pointeau = (id, overrides = {}) => ({
  id,
  name: `Point ${id}`,
  site_id: 's1',
  status: 'actif',
  nfc_tag_id: `04:A1:${id}`,
  ...overrides,
});

test('normalisation des tags : casse, :, - et espaces', () => {
  assert.equal(normalizeNfcTag('04:a1-b2 c3'), '04A1B2C3');
  assert.equal(normalizeNfcTag('04A1B2C3'), normalizeNfcTag('04:a1:b2:c3'));
  assert.equal(normalizeNfcTag(null), '');
});

test('la clé de tag n’existe que pour les pointeaux actifs ou inactifs', () => {
  assert.equal(pointeauTagKey({ status: 'actif', nfc_tag_id: '04:aa' }), '04AA');
  assert.equal(pointeauTagKey({ status: 'inactif', nfc_tag_id: '04:aa' }), '04AA');
  assert.equal(pointeauTagKey({ status: 'brouillon', nfc_tag_id: '04:aa' }), null);
  assert.equal(pointeauTagKey({ status: 'archive', nfc_tag_id: '04:aa' }), null);
  assert.equal(pointeauTagKey({ status: 'actif', nfc_tag_id: '' }), null);
});

test('pointeau actif sans tag refusé, brouillon sans tag accepté', () => {
  refuse(() => checkPointeau({ next: { name: 'P', site_id: 's1', status: 'actif' }, site }), 'tag_requis');
  const brouillon = checkPointeau({ next: { name: 'P', site_id: 's1', status: 'brouillon' }, site });
  assert.equal(brouillon.columns.tagKey, null);
  assert.equal(brouillon.columns.status, 'brouillon');
});

test('pointeau sans site ou avec un site inconnu refusé, client dérivé du site', () => {
  refuse(() => checkPointeau({ next: { name: 'P', status: 'brouillon' }, site: null }), 'site_requis');
  refuse(() => checkPointeau({ next: { name: 'P', site_id: 'zz', status: 'brouillon' }, site: null }), 'site_inconnu');
  const ok = checkPointeau({ next: { name: 'P', site_id: 's1', client_id: 'pirate' }, site });
  assert.equal(ok.data.client_id, 'c1');
});

test('un pointeau ne change pas de site et un actif ne perd pas son tag', () => {
  refuse(
    () => checkPointeau({ next: pointeau('a', { site_id: 's2' }), previous: pointeau('a'), site: autreSite }),
    'site_immuable',
  );
  refuse(
    () => checkPointeau({ next: pointeau('a', { nfc_tag_id: '' }), previous: pointeau('a'), site }),
    'tag_retire',
  );
  const desactive = checkPointeau({ next: pointeau('a', { status: 'inactif' }), previous: pointeau('a'), site });
  assert.equal(desactive.columns.tagKey, '04A1A');
});

test('un tag de début ou fin de service d’un site ne peut pas devenir un pointeau', () => {
  const sites = [{ ...site, nfc_tag_id: '04:A1:B2' }];
  refuse(() => checkPointeau({ next: pointeau('x', { nfc_tag_id: '04a1b2' }), site, sites }), 'tag_reserve_service');
});

test('ronde : site obligatoire à la création, service jamais exigé', () => {
  refuse(() => checkRonde({ next: { name: 'R' }, site: null, operation: 'create' }), 'site_requis');
  refuse(() => checkRonde({ next: { name: 'R', site_id: 'zz' }, site: null, operation: 'create' }), 'site_inconnu');
  const generale = checkRonde({ next: { name: 'Ronde générale', site_id: 's1', client_id: 'faux' }, site, operation: 'create' });
  assert.equal(generale.data.site_id, 's1');
  assert.equal(generale.data.client_id, 'c1');
  assert.equal('service_id' in generale.data, false);
});

test('ronde : seuls les pointeaux actifs avec tag du même site sont acceptés', () => {
  const pointeaux = new Map([
    ['a', pointeau('a')],
    ['b', pointeau('b')],
    ['autre', pointeau('autre', { site_id: 's2' })],
    ['brouillon', pointeau('brouillon', { status: 'brouillon', nfc_tag_id: '' })],
    ['inactif', pointeau('inactif', { status: 'inactif' })],
  ]);
  const base = { name: 'R', site_id: 's1' };
  const avec = (...ids) => ({ ...base, points: ids.map((pointeau_id) => ({ pointeau_id })) });

  refuse(() => checkRonde({ next: avec('autre'), site, pointeauxById: pointeaux, operation: 'create' }), 'pointeau_autre_site');
  refuse(() => checkRonde({ next: avec('brouillon'), site, pointeauxById: pointeaux, operation: 'create' }), 'pointeau_inutilisable');
  refuse(() => checkRonde({ next: avec('inactif'), site, pointeauxById: pointeaux, operation: 'create' }), 'pointeau_inutilisable');
  refuse(() => checkRonde({ next: avec('inconnu'), site, pointeauxById: pointeaux, operation: 'create' }), 'pointeau_inconnu');
  refuse(() => checkRonde({ next: avec('a', 'a'), site, pointeauxById: pointeaux, operation: 'create' }), 'pointeau_doublon');

  const ok = checkRonde({ next: avec('b', 'a'), site, pointeauxById: pointeaux, operation: 'create' });
  assert.deepEqual(ok.data.points, [{ pointeau_id: 'b', ordre: 1 }, { pointeau_id: 'a', ordre: 2 }]);
  assert.deepEqual(ok.data.checkpoints.map((cp) => cp.id), ['b', 'a']);
  assert.equal(ok.data.checkpoints[0].nfc_tag_id, '04:A1:b');

  const autreRonde = checkRonde({ next: avec('a'), site, pointeauxById: pointeaux, operation: 'create' });
  assert.deepEqual(autreRonde.data.points, [{ pointeau_id: 'a', ordre: 1 }]);
});

test('ronde ancienne sans site : modifiable tant qu’on ne touche pas au site ni aux points', () => {
  const ancienne = { name: 'Ancienne', checkpoints: [{ id: '1', name: 'x' }] };
  const statut = checkRonde({ next: { ...ancienne, status: 'inactif' }, previous: ancienne, changedKeys: ['status'], site: null, operation: 'update' });
  assert.equal(statut.data.status, 'inactif');
  refuse(
    () => checkRonde({ next: { ...ancienne, name: 'Autre' }, previous: ancienne, changedKeys: ['checkpoints'], site: null, operation: 'update' }),
    'site_requis',
  );
});

test('exécution : un point doit être validé par le bon badge, sur une ronde du nouveau modèle', () => {
  const ronde = { id: 'r1', site_id: 's1', points: [{ pointeau_id: 'a', ordre: 1 }] };
  const pointeaux = new Map([['a', pointeau('a')], ['autre', pointeau('autre')]]);
  const execution = (done) => ({ ronde_id: 'r1', site_id: 's1', checkpoints_done: done });
  const point = (overrides = {}) => ({ pointeau_id: 'a', checkpoint_id: 'a', nfc_validated: true, nfc_serial: '04:a1:a', ...overrides });

  checkRondeExecution({ next: execution([point()]), ronde, site, pointeauxById: pointeaux });
  refuse(() => checkRondeExecution({ next: execution([point({ nfc_serial: '04:ff:ff' })]), ronde, site, pointeauxById: pointeaux }), 'tag_different');
  refuse(() => checkRondeExecution({ next: execution([point({ nfc_validated: false })]), ronde, site, pointeauxById: pointeaux }), 'tag_different');
  refuse(() => checkRondeExecution({ next: execution([point({ pointeau_id: 'autre', checkpoint_id: 'autre' })]), ronde, site, pointeauxById: pointeaux }), 'point_hors_ronde');
  refuse(() => checkRondeExecution({ next: execution([point(), point()]), ronde, site, pointeauxById: pointeaux }), 'point_double');
  refuse(() => checkRondeExecution({ next: { ...execution([]), site_id: 's2' }, ronde, site: autreSite, pointeauxById: pointeaux }), 'ronde_autre_site');
});

test('exécution : les anciennes rondes et la ronde libre restent acceptées', () => {
  const ancienne = { id: 'r0', site_id: 's1', checkpoints: [{ id: '1' }] };
  checkRondeExecution({
    next: { ronde_id: 'r0', site_id: 's1', checkpoints_done: [{ checkpoint_id: '1', nfc_validated: false }] },
    ronde: ancienne,
    site,
  });
  const libre = checkRondeExecution({ next: { type: 'libre', site_id: 's1', checkpoints_done: [] }, ronde: null, site });
  assert.equal(libre.data.type, 'libre');
  checkRondeExecution({ next: { type: 'libre', checkpoints_done: [] }, ronde: null, site: null });
  refuse(() => checkRondeExecution({ next: { type: 'libre', site_id: 'zz' }, ronde: null, site: null }), 'site_inconnu');
});
