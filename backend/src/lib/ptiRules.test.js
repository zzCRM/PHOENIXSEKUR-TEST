import test from 'node:test';
import assert from 'node:assert/strict';
import { detectBrutalFall } from '../../../base44-export/src/lib/fallDetect.js';
import {
  advancePtiAlert,
  applyPtiAction,
  buildReceivedAlert,
  canConfigurePti,
  canHandlePti,
  canTriggerPti,
  classifyCapabilities,
  defaultPtiConfig,
  evaluateBattery,
  evaluateImmobility,
  evaluateSosHold,
  evaluateZone,
  protectionFlags,
  readClientAlert,
  resolvePtiConfig,
  sanitizePtiConfig,
} from './ptiRules.js';

const admin = { role: 'admin', companyId: 'co-a' };
const supervisor = { role: 'supervisor', companyId: 'co-a' };
const agent = { role: 'agent', companyId: 'co-a' };

test('les valeurs initiales sont celles demandées et restent modifiables', () => {
  const cfg = sanitizePtiConfig({
    profiles: {
      ronde: { sos_hold_sec: 4, gps_radius_m: 250 },
    },
  });
  assert.equal(cfg.profiles.poste_fixe.sos_hold_sec, 2);
  assert.equal(cfg.profiles.poste_fixe.immobilite_prealerte_sec, 60);
  assert.equal(cfg.profiles.poste_fixe.immobilite_confirmation_sec, 15);
  assert.equal(cfg.profiles.poste_fixe.zone_prealerte_sec, 30);
  assert.equal(cfg.profiles.poste_fixe.gps_radius_m, 100);
  assert.equal(cfg.profiles.poste_fixe.batterie_faible_pct, 20);
  assert.equal(cfg.profiles.poste_fixe.batterie_critique_pct, 10);
  assert.equal(cfg.profiles.poste_fixe.relance_superviseur_sec, 30);
  assert.equal(cfg.profiles.poste_fixe.escalade_apres_relance_sec, 60);
  assert.equal(cfg.profiles.ronde.sos_hold_sec, 4);
  assert.equal(cfg.profiles.ronde.gps_radius_m, 250);
  assert.equal(cfg.protection_imposed, true);
  assert.equal(cfg.profiles.patrouille_mobile.label, 'Agent de patrouille mobile');
  assert.equal(cfg.profiles.travailleur_isole.label, 'Travailleur isolé');
});

test('la mission remplace le profil sans modifier les autres agents', () => {
  const cfg = defaultPtiConfig();
  cfg.assignments.agents.a1 = 'poste_fixe';
  cfg.assignments.agents.a2 = 'poste_fixe';
  cfg.assignments.sites.s1 = 'ronde';
  cfg.assignments.missions.m9 = 'travailleur_isole';
  cfg.mission_overrides.m1 = { gps_radius_m: 40, immobilite_prealerte_sec: 90 };
  const mission = resolvePtiConfig(cfg, { agentId: 'a1', siteId: 's1', missionId: 'm1' });
  const other = resolvePtiConfig(cfg, { agentId: 'a2', siteId: 's1', missionId: 'm2' });
  const missionProfile = resolvePtiConfig(cfg, { agentId: 'a1', missionId: 'm9' });
  assert.equal(mission.gps_radius_m, 40);
  assert.equal(mission.immobilite_prealerte_sec, 90);
  assert.equal(mission.source, 'mission_override');
  assert.equal(other.profile_key, 'ronde');
  assert.equal(other.gps_radius_m, 100);
  assert.equal(missionProfile.profile_key, 'travailleur_isole');
  assert.equal(cfg.profiles.poste_fixe.gps_radius_m, 100);
  assert.equal(cfg.profiles.poste_fixe.immobilite_prealerte_sec, 60);
});

test('priorité mission, puis site, puis agent, puis défaut', () => {
  const cfg = defaultPtiConfig();
  cfg.default_profile = 'poste_fixe';
  cfg.assignments.agents.a1 = 'ronde';
  cfg.assignments.sites.s1 = 'patrouille_mobile';
  cfg.assignments.missions.m1 = 'travailleur_isole';
  assert.equal(resolvePtiConfig(cfg, { agentId: 'a1', siteId: 's1', missionId: 'm1' }).profile_key, 'travailleur_isole');
  assert.equal(resolvePtiConfig(cfg, { agentId: 'a1', siteId: 's1' }).profile_key, 'patrouille_mobile');
  assert.equal(resolvePtiConfig(cfg, { agentId: 'a1' }).profile_key, 'ronde');
  assert.equal(resolvePtiConfig(cfg, {}).profile_key, 'poste_fixe');
});

test('un événement isolé ne confirme ni la chute ni l’immobilité', () => {
  assert.equal(detectBrutalFall([{ t: 1, mag: 30, tilt: 80, linear: 20 }]), false);
  assert.equal(evaluateImmobility({
    samples: [{ t: 1000, still: true }],
    now: 80_000,
    prealertSec: 60,
    confirmSec: 15,
    motionAvailable: true,
  }).phase, 'waiting');
  assert.equal(evaluateImmobility({
    samples: [{ t: 0, still: true }, { t: 30_000, still: true }, { t: 80_000, still: true }],
    now: 80_000,
    prealertSec: 60,
    confirmSec: 15,
    motionAvailable: false,
  }).phase, 'unavailable');
  const confirmed = evaluateImmobility({
    samples: [{ t: 0, still: true }, { t: 40_000, still: true }, { t: 80_000, still: true }],
    now: 80_000,
    prealertSec: 60,
    confirmSec: 15,
    motionAvailable: true,
  });
  assert.equal(confirmed.phase, 'confirmed');
});

test('la sortie de zone attend la préalerte', () => {
  assert.equal(evaluateZone({ outside: true, outsideSince: 0, now: 10_000, prealertSec: 30 }).phase, 'prealert');
  assert.equal(evaluateZone({ outside: true, outsideSince: 0, now: 30_000, prealertSec: 30 }).phase, 'confirmed');
  assert.equal(evaluateZone({ outside: false, outsideSince: 0, now: 40_000, prealertSec: 30 }).phase, 'ok');
  assert.equal(evaluateSosHold(1000, 2).ready, false);
  assert.equal(evaluateSosHold(2000, 2).ready, true);
  assert.equal(evaluateBattery(null, 20, 10).phase, 'unavailable');
  assert.equal(evaluateBattery(9, 20, 10).phase, 'critique');
});

test('l’accusé serveur ignore une transmission revendiquée par le téléphone', () => {
  const input = readClientAlert({
    type: 'sos',
    client_event_id: 'evt-1',
    transmission_status: 'received',
    received_at: '1999-01-01T00:00:00.000Z',
    battery_level: 15,
    latitude: 48.8,
    longitude: 2.3,
  });
  assert.equal(input.transmission_status, undefined);
  const alert = buildReceivedAlert({
    id: 'pti_1',
    companyId: 'co-a',
    actor: { id: 'ag', email: 'a@exemple.test' },
    input,
    effective: resolvePtiConfig(defaultPtiConfig(), {}),
    now: '2026-11-01T07:00:00.000Z',
  });
  assert.equal(alert.transmission_status, 'received');
  assert.equal(alert.received_at, '2026-11-01T07:00:00.000Z');
  assert.equal(alert.history[0].action, 'received');
  assert.equal(alert.history[0].by, 'ag');
});

test('acquittement, levée de doute, escalade et clôture gardent l’auteur', () => {
  let alert = buildReceivedAlert({
    id: 'pti_2',
    companyId: 'co-a',
    actor: { id: 'ag', email: 'a@exemple.test' },
    input: readClientAlert({ type: 'chute', client_event_id: 'evt-2' }),
    effective: resolvePtiConfig(defaultPtiConfig(), {}),
    now: '2026-11-01T07:00:00.000Z',
  });
  const actor = { id: 'sup', email: 'sup@exemple.test' };
  alert = applyPtiAction(alert, 'acknowledge', { actor, now: '2026-11-01T07:00:10.000Z' });
  alert = applyPtiAction(alert, 'contact', { actor, detail: 'Appel passé', now: '2026-11-01T07:00:20.000Z' });
  alert = applyPtiAction(alert, 'doubt', { actor, result: 'Agent joint, fausse alerte', now: '2026-11-01T07:00:30.000Z' });
  alert = applyPtiAction(alert, 'escalate', { actor, now: '2026-11-01T07:01:00.000Z' });
  alert = applyPtiAction(alert, 'close', { actor, motif: 'Fausse alerte confirmée', now: '2026-11-01T07:02:00.000Z' });
  assert.deepEqual(alert.history.map((item) => item.action), ['received', 'acknowledge', 'contact', 'doubt', 'escalate', 'close']);
  assert.equal(alert.history[4].by, 'sup');
  assert.equal(alert.ack_status, 'closed');
  assert.equal(alert.close_motif, 'Fausse alerte confirmée');
  assert.throws(() => applyPtiAction(alert, 'acknowledge', { actor }), /clôturée/);
  assert.throws(() => applyPtiAction({ ...alert, ack_status: 'pending' }, 'close', { actor, motif: '  ' }), /Motif/);
});

test('la relance puis l’escalade respectent les délais enregistrés', () => {
  const alert = buildReceivedAlert({
    id: 'pti_3',
    companyId: 'co-a',
    actor: { id: 'ag' },
    input: readClientAlert({ type: 'immobilite', client_event_id: 'evt-3' }),
    effective: { relance_superviseur_sec: 30, escalade_apres_relance_sec: 60, profile_key: 'poste_fixe' },
    now: '2026-11-01T07:00:00.000Z',
  });
  const tooSoon = advancePtiAlert(alert, '2026-11-01T07:00:20.000Z');
  assert.equal(tooSoon.changed, false);
  const relance = advancePtiAlert(alert, '2026-11-01T07:00:31.000Z');
  assert.equal(relance.changed, true);
  assert.equal(relance.alert.history.at(-1).action, 'relance');
  assert.equal(relance.alert.ack_status, 'pending');
  const escalade = advancePtiAlert(relance.alert, '2026-11-01T07:01:31.000Z');
  assert.equal(escalade.alert.ack_status, 'escalated');
  assert.equal(escalade.alert.history.at(-1).action, 'escalate');
  const acked = applyPtiAction(alert, 'acknowledge', { actor: { id: 'sup' }, now: '2026-11-01T07:00:05.000Z' });
  assert.equal(advancePtiAlert(acked, '2026-11-01T08:00:00.000Z').changed, false);
});

test('droits et fonctions indisponibles', () => {
  assert.equal(canConfigurePti(admin), true);
  assert.equal(canConfigurePti(supervisor), false);
  assert.equal(canHandlePti(supervisor), true);
  assert.equal(canTriggerPti(agent), true);
  assert.equal(canConfigurePti(agent), false);
  const caps = classifyCapabilities({ platform: 'ios', userAgent: 'iPhone', hasGeolocation: true });
  assert.equal(caps.features.geolocation_background, 'unavailable');
  assert.equal(caps.features.battery, 'unavailable');
  assert.equal(caps.features.push_background, 'unavailable');
  assert.equal(caps.background_guaranteed, false);
  assert.equal(caps.device_tested, false);
  const flags = protectionFlags({
    onDuty: true,
    imposed: true,
    detections: { zone_gps: true, chute: true },
    features: { gps: 'unavailable', motion: 'denied', network: 'offline', server: 'offline' },
    pendingCount: 1,
    lastReceived: { transmission_status: 'local_pending' },
  });
  assert.equal(flags.banners.includes('alert_confirmed'), false);
  assert.equal(flags.banners.includes('alert_pending'), true);
  assert.equal(flags.banners.includes('network_unavailable'), true);
  assert.equal(flags.banners.includes('permission_missing'), true);
  const confirmed = protectionFlags({
    onDuty: true,
    detections: {},
    lastReceived: { transmission_status: 'received', id: 'pti_9' },
  });
  assert.equal(confirmed.banners.includes('alert_confirmed'), true);
});
