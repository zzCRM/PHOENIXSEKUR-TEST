import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expandRecurrenceDates, normalizeDateKey, isMissionVisibleToAgent } from './recurrenceExpand.js';

test('sans récurrence : une seule date', () => {
  assert.deepEqual(expandRecurrenceDates({ date: '2026-08-29' }), ['2026-08-29']);
});

test('quotidienne sur 5 jours', () => {
  const dates = expandRecurrenceDates({
    date: '2026-08-29',
    date_fin_recurrence: '2026-09-02',
    recurrence: true,
    recurrence_type: 'Quotidienne',
    recurrence_frequence: 1,
  });
  assert.deepEqual(dates, ['2026-08-29', '2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02']);
});

test('hebdomadaire le samedi uniquement', () => {
  const dates = expandRecurrenceDates({
    date: '2026-08-29',
    date_fin_recurrence: '2026-09-19',
    recurrence: true,
    recurrence_type: 'Hebdomadaire',
    recurrence_frequence: 1,
    recurrence_jours: ['Samedi'],
  });
  assert.deepEqual(dates, ['2026-08-29', '2026-09-05', '2026-09-12', '2026-09-19']);
});

test('normalizeDateKey retire l’heure ISO', () => {
  assert.equal(normalizeDateKey('2026-08-29T00:00:00.000Z'), '2026-08-29');
});

test('vacation visible par agent_id fiche', () => {
  assert.equal(isMissionVisibleToAgent(
    { agent_id: 'ag-1', status: 'planifiee' },
    { agentId: 'ag-1', userId: 'user-9' },
  ), true);
});

test('vacation visible par nom (BOULAGHMOUDI)', () => {
  assert.equal(isMissionVisibleToAgent(
    { agent_name: 'Agent des services de BOULAGHMOUDI Mohamed', status: 'planifiee' },
    { lastName: 'Boulaghmoudi', firstName: 'Mohamed' },
  ), true);
});

test('vacation d’un autre agent masquée', () => {
  assert.equal(isMissionVisibleToAgent(
    { agent_id: 'other', agent_name: 'Dupont Jean', status: 'planifiee' },
    { agentId: 'ag-1', lastName: 'Boulaghmoudi' },
  ), false);
});
