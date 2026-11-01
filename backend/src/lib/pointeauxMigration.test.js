import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, planMigration } from './pointeauxMigration.js';

const sites = [
  { id: 's1', company_id: 'c', client_id: 'cl1', name: 'Site 1', client_name: 'Client' },
  { id: 's2', company_id: 'c', client_id: 'cl1', name: 'Site 2', client_name: 'Client' },
];

const rondes = [
  { id: 'r1', company_id: 'c', site_id: 's1', name: 'Ronde 1', checkpoints: [
    { id: 'p1', name: 'Hall', nfc_tag_id: '04:AA:01' },
    { id: 'p2', name: 'Sans tag', nfc_tag_id: '' },
    { id: 'p2', name: 'Id en double', nfc_tag_id: '04:AA:02' },
  ] },
  { id: 'r2', company_id: 'c', site_id: 's1', name: 'Ronde 2', checkpoints: [{ id: 'q1', name: 'Hall copie', nfc_tag_id: '04aa01' }] },
  { id: 'r3', company_id: 'c', name: 'Sans site', checkpoints: [{ id: 'z1', name: 'Parking', nfc_tag_id: '04:BB:01' }] },
  { id: 'r4', company_id: 'c', site_id: 's2', name: 'Conflit', checkpoints: [{ id: 'k1', name: 'Hall autre site', nfc_tag_id: '04:AA:01' }] },
  { id: 'r5', company_id: 'c', site_id: 'fantome', name: 'Orphelin', checkpoints: [] },
  { id: 'r6', company_id: 'c', site_id: 's1', name: 'Mélange', checkpoints: [{ id: 'm1', name: 'Autre site', site_id: 's2', nfc_tag_id: '04:CC:01' }] },
];

const executions = [
  { id: 'e1', ronde_id: 'r1', checkpoints_done: [{ checkpoint_id: 'p1' }, { checkpoint_id: 'disparu' }] },
  { id: 'e2', ronde_id: 'absente', checkpoints_done: 3 },
  { id: 'e3', ronde_id: 'libre-s1', checkpoints_done: [] },
];

test('le diagnostic repère les cas ambigus sans rien modifier', () => {
  const snapshot = JSON.stringify({ sites, rondes, executions });
  const report = analyze({ sites, rondes, executions, missions: [{ id: 'm', ronde_id: 'inconnue' }] });
  assert.equal(JSON.stringify({ sites, rondes, executions }), snapshot);
  assert.equal(report.rondes_sans_site.length, 1);
  assert.equal(report.rondes_site_inconnu.length, 1);
  assert.equal(report.points_sans_tag.length, 1);
  assert.equal(report.points_id_en_double_dans_ronde.length, 1);
  assert.equal(report.points_site_different_de_la_ronde.length, 1);
  assert.equal(report.tags_en_double.entre_sites.length, 1);
  assert.equal(report.tags_en_double.meme_site.length, 0);
  assert.equal(report.executions_ronde_inconnue.length, 1);
  assert.equal(report.executions_points_non_tableau.length, 1);
  assert.equal(report.executions_point_introuvable.length, 1);
  assert.equal(report.missions_ronde_inconnue.length, 1);
});

test('la simulation ne crée jamais de pointeau actif sans tag ni ne devine un site', () => {
  const plan = planMigration({ sites, rondes });
  assert.equal(plan.a_completer_sans_tag.length, 1);
  assert.ok(plan.a_creer.every((item) => item.nfc_tag_id && item.status === 'actif'));
  const types = plan.a_resoudre_manuellement.map((item) => item.type).sort();
  assert.deepEqual(types, ['point_site_different', 'ronde_sans_site_valide', 'ronde_sans_site_valide', 'tag_sur_plusieurs_sites']);
  assert.equal(plan.a_creer.some((item) => item.nfc_tag_id === '04:BB:01'), false);
});

test('une décision manuelle débloque un cas et la fusion se fait par site et par tag', () => {
  const plan = planMigration({ sites, rondes }, { rondes_site: { r3: 's1' }, tags: { '04AA01': 's1' } });
  const hall = plan.a_creer.find((item) => item.nfc_tag_id === '04:AA:01');
  assert.equal(hall.site_id, 's1');
  assert.deepEqual(hall.legacy_refs, [
    { ronde_id: 'r1', checkpoint_id: 'p1' },
    { ronde_id: 'r2', checkpoint_id: 'q1' },
  ]);
  assert.ok(plan.a_creer.find((item) => item.nfc_tag_id === '04:BB:01'));
});

test('un pointeau déjà présent n’est pas recréé', () => {
  const plan = planMigration(
    { sites, rondes: [rondes[1]], pointeaux: [{ id: 'px', company_id: 'c', status: 'actif', nfc_tag_id: '04:AA:01' }] },
  );
  assert.equal(plan.a_creer.length, 0);
  assert.equal(plan.deja_presents[0].pointeau_id, 'px');
});
