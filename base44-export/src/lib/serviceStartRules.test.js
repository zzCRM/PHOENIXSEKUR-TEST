import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canStartPlannedService,
  resolvePriseMode,
  nfcMatches,
  isWithinSiteGeofence,
} from './serviceStartRules.js';

test('bloque la prise avant l’heure planifiée', () => {
  const mission = { date: '2026-08-29', start_time: '06:30', end_time: '19:00' };
  const before = new Date('2026-08-29T06:00:00');
  const atTime = new Date('2026-08-29T06:30:00');
  assert.equal(canStartPlannedService(mission, before).ok, false);
  assert.equal(canStartPlannedService(mission, atTime).ok, true);
});

test('refuse de reprendre un service après l’heure de fin', () => {
  const mission = { date: '2026-08-29', start_time: '06:30', end_time: '11:00' };
  const during = new Date('2026-08-29T09:00:00');
  const after = new Date('2026-08-29T12:00:00');
  assert.equal(canStartPlannedService(mission, during).ok, true);
  const late = canStartPlannedService(mission, after);
  assert.equal(late.ok, false);
  assert.equal(late.tooLate, true);
});

test('vacation de nuit : la fin est le lendemain', () => {
  const mission = { date: '2026-08-29', start_time: '19:00', end_time: '06:30' };
  assert.equal(canStartPlannedService(mission, new Date('2026-08-29T22:00:00')).ok, true);
  assert.equal(canStartPlannedService(mission, new Date('2026-08-30T05:00:00')).ok, true);
  assert.equal(canStartPlannedService(mission, new Date('2026-08-30T08:00:00')).ok, false);
});

test('service non planifié toujours autorisé', () => {
  assert.equal(canStartPlannedService({ unplanned: true, start_time: '22:00' }, new Date('2026-08-29T10:00:00')).ok, true);
});

test('mode NFC si pointage arrivée', () => {
  assert.equal(resolvePriseMode({ pointage_arrivee: true }), 'nfc');
  assert.equal(resolvePriseMode({ prise_service_mode: 'geolocalisation' }), 'geolocalisation');
});

test('NFC insensible à la casse et aux séparateurs', () => {
  assert.equal(nfcMatches('04:A2:1F', '04a21f'), true);
  assert.equal(nfcMatches('AAA', 'BBB'), false);
});

test('géofence refuse hors rayon', () => {
  const site = { latitude: 48.8566, longitude: 2.3522, geofence_radius: 100 };
  const far = { latitude: 48.87, longitude: 2.37 };
  const near = { latitude: 48.8567, longitude: 2.3523 };
  assert.equal(isWithinSiteGeofence(far, site).ok, false);
  assert.equal(isWithinSiteGeofence(near, site).ok, true);
});
