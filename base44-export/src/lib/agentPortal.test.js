import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeAgentDroits, assignedSiteIds, DEFAULT_DROITS_AGENT } from './agentPortal.js';

test('droits par défaut : planning, demandes, non planifié, rondes, consignes, carte, contact', () => {
  const d = mergeAgentDroits(null);
  assert.equal(d.acces_planning, true);
  assert.equal(d.acces_conges, true);
  assert.equal(d.acces_service_non_planifie, true);
  assert.equal(d.acces_rondes, true);
  assert.equal(d.acces_consignes, true);
  assert.equal(d.acces_carte_pro, true);
  assert.equal(d.acces_contact_societe, true);
  assert.equal(d.acces_pti, false);
  assert.equal(d.acces_documents, false);
});

test('droits_portail société écrase les défauts', () => {
  const d = mergeAgentDroits({
    acces_planning: true,
    droits_portail: { acces_planning: false, acces_pti: true },
  });
  assert.equal(d.acces_planning, false);
  assert.equal(d.acces_pti, true);
  assert.equal(d.acces_rondes, DEFAULT_DROITS_AGENT.acces_rondes);
});

test('sites affectés = missions + agent_ids du site', () => {
  const ids = assignedSiteIds({
    agentId: 'ag-1',
    missions: [{ site_id: 's1' }],
    sites: [
      { id: 's2', agent_ids: ['ag-1'] },
      { id: 's3', agent_ids: ['other'] },
    ],
  });
  assert.deepEqual(ids.sort(), ['s1', 's2']);
});
