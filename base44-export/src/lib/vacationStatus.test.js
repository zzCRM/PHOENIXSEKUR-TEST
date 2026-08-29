import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vacationRunStatus, siteEmergencyNumber } from './vacationStatus.js';

test('sans prise : en attente', () => {
  assert.equal(vacationRunStatus(null), 'en_attente');
});

test('en service (y compris prolongation) : en cours', () => {
  assert.equal(vacationRunStatus({ status: 'en_service', prolongation_motif: 'relève' }), 'en_cours');
});

test('service clôturé : terminé', () => {
  assert.equal(vacationRunStatus({ status: 'termine', actual_end: '11:05' }), 'termine');
  assert.equal(vacationRunStatus({ actual_end: '06:30' }), 'termine');
});

test('numéro d’urgence du site', () => {
  assert.equal(siteEmergencyNumber({ urgences: ['06 12 34 56 78'] }), '0612345678');
  assert.equal(siteEmergencyNumber({ urgences: [] }), '');
});
