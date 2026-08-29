import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEventForVacation, inTimeWindow } from './vacationFeed.js';

const night = {
  id: 'svc-1',
  mission_id: 'm-night',
  site_id: 'tenneco',
  date: '2026-08-29',
  actual_start: '00:00',
  planned_end: '06:30',
  status: 'en_service',
};
const dayShift = {
  id: 'svc-2',
  mission_id: 'm-day',
  site_id: 'tenneco',
  date: '2026-08-29',
  actual_start: '06:30',
  planned_end: '19:00',
  status: 'en_service',
};

test('service_id isole la vacation', () => {
  assert.equal(isEventForVacation({ service_id: 'svc-1', time: '03:00' }, night), true);
  assert.equal(isEventForVacation({ service_id: 'svc-2', time: '03:00' }, night), false);
});

test('mission_id isole deux vacations du même site le même jour', () => {
  const e = { mission_id: 'm-day', site_id: 'tenneco', date: '2026-08-29', time: '10:00' };
  assert.equal(isEventForVacation(e, dayShift), true);
  assert.equal(isEventForVacation(e, night), false);
});

test('sans id : fenêtre horaire, pas de mélange 00-06h30 / 06h30-19h', () => {
  const early = { site_id: 'tenneco', date: '2026-08-29', time: '03:10', content: 'nuit' };
  const late = { site_id: 'tenneco', date: '2026-08-29', time: '10:00', content: 'jour' };
  assert.equal(isEventForVacation(early, night, '06:00'), true);
  assert.equal(isEventForVacation(late, night, '06:00'), false);
  assert.equal(isEventForVacation(early, dayShift, '12:00'), false);
  assert.equal(isEventForVacation(late, dayShift, '12:00'), true);
});

test('un autre agent sur le même site n’entre pas dans le fil', () => {
  const other = {
    site_id: 'tenneco', date: '2026-08-29', time: '10:00',
    agent_id: 'agent-b', agent_name: 'Autre Agent',
  };
  const mine = { ...dayShift, agent_id: 'agent-a', agent_name: 'Moi Agent' };
  assert.equal(isEventForVacation(other, mine, '12:00'), false);
});

test('fenêtre de nuit qui chevauche minuit', () => {
  assert.equal(inTimeWindow('23:00', '19:00', '00:00'), true);
  assert.equal(inTimeWindow('08:00', '19:00', '00:00'), false);
});
