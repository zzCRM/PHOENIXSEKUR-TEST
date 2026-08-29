import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vacationRunStatus, siteEmergencyNumber, clientEmergencyNumber, resolveEmergencyTel } from './vacationStatus.js';

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

test('numéro d’urgence de la fiche client', () => {
  assert.equal(clientEmergencyNumber({ urgence_phone: '01 23 45 67 89', phone: '0600000000' }), '0123456789');
  assert.equal(clientEmergencyNumber({ phone: '06 11 22 33 44' }), '0611223344');
  assert.equal(resolveEmergencyTel({ urgence_phone: '0177889900' }, { urgences: ['0600000000'] }), '0177889900');
  assert.equal(resolveEmergencyTel({ phone: '06 22 22 22 22' }, { urgences: ['0633333333'] }), '0622222222');
  assert.equal(resolveEmergencyTel(null, { urgences: ['06 33 33 33 33'] }), '0633333333');
});
