/**
 * Règles PTI pures (paramètres, priorité, alertes, états).
 * Le smartphone n’est pas un DATI certifié. Ces seuils sont des réglages de test.
 * Aucune fonction ne simule un capteur : l’absence de mesure reste une absence.
 */

export const PTI_DISCLAIMER = 'Réglages initiaux de test, pas des seuils de sécurité garantis. Le smartphone de l’agent n’est pas un DATI certifié. Une application web ne garantit pas la détection téléphone verrouillé ou en arrière-plan.';

export const PROFILE_KEYS = ['poste_fixe', 'ronde', 'patrouille_mobile', 'travailleur_isole'];

export const PROFILE_LABELS = {
  poste_fixe: 'Agent de poste fixe',
  ronde: 'Agent de ronde',
  patrouille_mobile: 'Agent de patrouille mobile',
  travailleur_isole: 'Travailleur isolé',
};

export const ALERT_TYPES = ['sos', 'chute', 'immobilite', 'perte_verticalite', 'sortie_zone', 'batterie_faible', 'batterie_critique'];

export const ACTION_LABELS = {
  received: 'Reçue par le serveur',
  acknowledge: 'Acquittement',
  contact: 'Contact de l’agent',
  doubt: 'Levée de doute',
  escalate: 'Escalade',
  close: 'Clôture',
  relance: 'Relance superviseur',
};

export const TIMING_FIELDS = [
  ['sos_hold_sec', 'Appui long SOS (s)', 1, 10],
  ['immobilite_prealerte_sec', 'Préalerte immobilité (s)', 15, 600],
  ['immobilite_confirmation_sec', 'Confirmation immobilité (s)', 5, 120],
  ['zone_prealerte_sec', 'Préalerte sortie de zone (s)', 5, 300],
  ['gps_radius_m', 'Rayon GPS (m)', 20, 5000],
  ['batterie_faible_pct', 'Batterie faible (%)', 5, 60],
  ['batterie_critique_pct', 'Batterie critique (%)', 1, 40],
  ['relance_superviseur_sec', 'Relance superviseur (s)', 10, 600],
  ['escalade_apres_relance_sec', 'Escalade après la relance (s)', 10, 900],
  ['chute_confirmation_sec', 'Confirmation de chute (s)', 2, 30],
  ['chute_annulation_sec', 'Annulation avant envoi (s)', 5, 90],
];

const TIMING_DEFAULTS = {
  sos_hold_sec: 2,
  immobilite_prealerte_sec: 60,
  immobilite_confirmation_sec: 15,
  zone_prealerte_sec: 30,
  gps_radius_m: 100,
  batterie_faible_pct: 20,
  batterie_critique_pct: 10,
  relance_superviseur_sec: 30,
  escalade_apres_relance_sec: 60,
  chute_confirmation_sec: 3,
  chute_annulation_sec: 20,
};

const DETECTION_DEFAULTS = {
  chute: true,
  immobilite: true,
  perte_verticalite: true,
  zone_gps: true,
  sos: true,
  batterie: true,
};

export const CAPABILITY_CATALOG = [
  { key: 'geolocation_foreground', label: 'GPS au premier plan', android: 'api', ios: 'api', native_required: false, note: 'Disponible seulement tant que la page est ouverte. Non vérifié sur un appareil tant qu’une position réelle n’est pas lue.' },
  { key: 'geolocation_background', label: 'GPS en arrière-plan', android: 'unavailable', ios: 'unavailable', native_required: true, note: 'Une PWA ne garantit pas le suivi écran éteint. Application native à prévoir.' },
  { key: 'motion', label: 'Mouvement / chute', android: 'api', ios: 'permission', native_required: true, note: 'Sans événement réel du téléphone, aucune chute n’est déclarée.' },
  { key: 'verticality', label: 'Perte de verticalité', android: 'derived', ios: 'derived', native_required: true, note: 'Déduite de l’accéléromètre s’il envoie des mesures. Pas de capteur dédié.' },
  { key: 'immobility', label: 'Immobilité', android: 'derived', ios: 'derived', native_required: true, note: 'Compte seulement une suite de mesures. Un échantillon isolé ne déclenche rien.' },
  { key: 'battery', label: 'Niveau de batterie', android: 'api', ios: 'unavailable', native_required: true, note: 'Safari iPhone n’expose en général pas le niveau. On n’affiche pas de pourcentage inventé.' },
  { key: 'visible_notification', label: 'Notification écran allumé', android: 'api', ios: 'limited', native_required: false, note: 'Ne réveille pas un téléphone verrouillé de façon fiable.' },
  { key: 'push_background', label: 'Notification arrière-plan', android: 'unavailable', ios: 'unavailable', native_required: true, note: 'Pas de push natif dans cette version.' },
  { key: 'vibration', label: 'Vibreur', android: 'api', ios: 'unavailable', native_required: false, note: 'iOS ignore la vibration web.' },
  { key: 'sos', label: 'Bouton SOS', android: 'page', ios: 'page', native_required: true, note: 'Actif dans la page ouverte. Inutile si l’application est tuée : cela demande une app native.' },
];

function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function blankProfile(key) {
  return {
    key,
    label: PROFILE_LABELS[key],
    enabled: true,
    gps_use_site_radius: false,
    ...TIMING_DEFAULTS,
    detections: { ...DETECTION_DEFAULTS },
  };
}

export function defaultPtiConfig() {
  const profiles = {};
  for (const key of PROFILE_KEYS) profiles[key] = blankProfile(key);
  return {
    version: 1,
    disclaimer: PTI_DISCLAIMER,
    protection_imposed: true,
    default_profile: 'poste_fixe',
    profiles,
    assignments: { agents: {}, sites: {}, missions: {} },
    mission_overrides: {},
    notifications: {
      centre: true,
      sms: false,
      push: false,
    },
  };
}

function cleanDetections(input) {
  const out = { ...DETECTION_DEFAULTS };
  if (!input || typeof input !== 'object') return out;
  for (const key of Object.keys(DETECTION_DEFAULTS)) {
    if (typeof input[key] === 'boolean') out[key] = input[key];
  }
  return out;
}

function cleanProfile(key, input) {
  const base = blankProfile(key);
  const src = input && typeof input === 'object' ? input : {};
  const next = { ...base, key, label: PROFILE_LABELS[key], enabled: src.enabled !== false };
  for (const [field, , min, max] of TIMING_FIELDS) {
    next[field] = clamp(src[field], min, max, base[field]);
  }
  if (next.batterie_critique_pct >= next.batterie_faible_pct) {
    next.batterie_critique_pct = Math.max(1, next.batterie_faible_pct - 1);
  }
  next.gps_use_site_radius = src.gps_use_site_radius === true;
  next.detections = cleanDetections(src.detections);
  return next;
}

function cleanOverride(input) {
  if (!input || typeof input !== 'object') return null;
  const out = {};
  for (const [field, , min, max] of TIMING_FIELDS) {
    if (input[field] == null || input[field] === '') continue;
    out[field] = clamp(input[field], min, max, TIMING_DEFAULTS[field]);
  }
  if (input.detections && typeof input.detections === 'object') {
    const detections = {};
    for (const key of Object.keys(DETECTION_DEFAULTS)) {
      if (typeof input.detections[key] === 'boolean') detections[key] = input.detections[key];
    }
    if (Object.keys(detections).length) out.detections = detections;
  }
  return Object.keys(out).length ? out : null;
}

function cleanAssignmentMap(input, profiles) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  for (const [id, profileKey] of Object.entries(input)) {
    if (!id || typeof profileKey !== 'string' || !profiles[profileKey]) continue;
    out[String(id)] = profileKey;
  }
  return out;
}

export function sanitizePtiConfig(input) {
  const defaults = defaultPtiConfig();
  const src = input && typeof input === 'object' ? input : {};
  const profiles = {};
  for (const key of PROFILE_KEYS) {
    profiles[key] = cleanProfile(key, src.profiles?.[key]);
  }
  const defaultProfile = profiles[src.default_profile] ? src.default_profile : defaults.default_profile;
  const missionOverrides = {};
  const rawOverrides = src.mission_overrides && typeof src.mission_overrides === 'object' ? src.mission_overrides : {};
  for (const [missionId, override] of Object.entries(rawOverrides)) {
    const clean = cleanOverride(override);
    if (clean) missionOverrides[String(missionId)] = clean;
  }
  return {
    version: 1,
    disclaimer: PTI_DISCLAIMER,
    protection_imposed: src.protection_imposed !== false,
    default_profile: defaultProfile,
    profiles,
    assignments: {
      agents: cleanAssignmentMap(src.assignments?.agents, profiles),
      sites: cleanAssignmentMap(src.assignments?.sites, profiles),
      missions: cleanAssignmentMap(src.assignments?.missions, profiles),
    },
    mission_overrides: missionOverrides,
    notifications: {
      centre: src.notifications?.centre !== false,
      sms: src.notifications?.sms === true,
      push: src.notifications?.push === true,
    },
  };
}

export function resolvePtiConfig(config, { agentId, siteId, missionId, siteRadius } = {}) {
  const cfg = sanitizePtiConfig(config);
  const profileKey = cfg.assignments.missions[missionId]
    || cfg.assignments.sites[siteId]
    || cfg.assignments.agents[agentId]
    || cfg.default_profile;
  const profile = cfg.profiles[profileKey];
  const override = (missionId && cfg.mission_overrides[missionId]) || null;
  let source = 'default';
  if (missionId && cfg.assignments.missions[missionId]) source = 'mission_profile';
  else if (siteId && cfg.assignments.sites[siteId]) source = 'site';
  else if (agentId && cfg.assignments.agents[agentId]) source = 'agent';
  if (override) source = 'mission_override';

  const timings = { ...profile };
  if (override) {
    for (const [field] of TIMING_FIELDS) {
      if (override[field] != null) timings[field] = override[field];
    }
    if (override.detections) timings.detections = { ...profile.detections, ...override.detections };
  }
  let radius = timings.gps_radius_m;
  if (!(override && override.gps_radius_m != null) && profile.gps_use_site_radius && Number.isFinite(Number(siteRadius))) {
    radius = clamp(siteRadius, 20, 5000, timings.gps_radius_m);
  }
  return {
    profile_key: profileKey,
    profile_label: profile.label,
    source,
    imposed: cfg.protection_imposed,
    enabled: profile.enabled,
    gps_radius_m: radius,
    gps_use_site_radius: profile.gps_use_site_radius,
    sos_hold_sec: timings.sos_hold_sec,
    immobilite_prealerte_sec: timings.immobilite_prealerte_sec,
    immobilite_confirmation_sec: timings.immobilite_confirmation_sec,
    zone_prealerte_sec: timings.zone_prealerte_sec,
    batterie_faible_pct: timings.batterie_faible_pct,
    batterie_critique_pct: timings.batterie_critique_pct,
    relance_superviseur_sec: timings.relance_superviseur_sec,
    escalade_apres_relance_sec: timings.escalade_apres_relance_sec,
    chute_confirmation_sec: timings.chute_confirmation_sec,
    chute_annulation_sec: timings.chute_annulation_sec,
    detections: { ...timings.detections },
    notifications: { ...cfg.notifications, sms_available: false, push_available: false },
    disclaimer: PTI_DISCLAIMER,
  };
}

export function canConfigurePti(user) {
  return user?.role === 'admin' || user?.role === 'superadmin';
}

export function canHandlePti(user) {
  return canConfigurePti(user) || user?.role === 'supervisor';
}

export function canTriggerPti(user) {
  const role = user?.role;
  return canHandlePti(user) || role === 'agent' || role === 'user' || role === 'collaborateur';
}

function numIn(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

export function readClientAlert(body) {
  const src = body && typeof body === 'object' ? body : {};
  const type = ALERT_TYPES.includes(src.type) ? src.type : null;
  const clientEventId = String(src.client_event_id || '').trim().slice(0, 80);
  return {
    type,
    client_event_id: clientEventId,
    agent_id: src.agent_id ? String(src.agent_id) : null,
    agent_name: String(src.agent_name || '').slice(0, 120),
    mission_id: src.mission_id ? String(src.mission_id) : null,
    site_id: src.site_id ? String(src.site_id) : null,
    site_name: String(src.site_name || '').slice(0, 160),
    service_id: src.service_id ? String(src.service_id) : null,
    occurred_at: src.occurred_at || null,
    latitude: numIn(src.latitude, -90, 90),
    longitude: numIn(src.longitude, -180, 180),
    accuracy_m: numIn(src.accuracy_m, 0, 100000),
    battery_level: numIn(src.battery_level, 0, 100),
    connection_state: ['online', 'offline', 'unknown'].includes(src.connection_state) ? src.connection_state : 'unknown',
    detail: String(src.detail || '').slice(0, 500),
  };
}

function parisStamp(iso) {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const time = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
  return { date, time };
}

export function buildReceivedAlert({ id, companyId, actor, input, effective, now }) {
  const at = now || new Date().toISOString();
  const occurred = input.occurred_at && !Number.isNaN(Date.parse(input.occurred_at)) ? new Date(input.occurred_at).toISOString() : at;
  const stamp = parisStamp(occurred);
  const type = input.type === 'sortie_zone' ? 'geofence' : 'pti_alerte';
  const message = input.detail || `Alerte PTI ${input.type}`;
  return {
    id,
    company_id: companyId,
    pti: true,
    is_test: false,
    client_event_id: input.client_event_id,
    type,
    pti_type: input.type,
    agent_id: input.agent_id,
    agent_name: input.agent_name,
    mission_id: input.mission_id,
    site_id: input.site_id,
    site_name: input.site_name,
    service_id: input.service_id,
    message,
    detail: input.detail,
    date: stamp.date,
    time: stamp.time,
    occurred_at: occurred,
    latitude: input.latitude,
    longitude: input.longitude,
    accuracy_m: input.accuracy_m,
    battery_level: input.battery_level,
    connection_state: input.connection_state,
    transmission_status: 'received',
    received_at: at,
    ack_status: 'pending',
    severity: 'urgent',
    read: false,
    profile_key: effective?.profile_key || null,
    relance_superviseur_sec: effective?.relance_superviseur_sec ?? TIMING_DEFAULTS.relance_superviseur_sec,
    escalade_apres_relance_sec: effective?.escalade_apres_relance_sec ?? TIMING_DEFAULTS.escalade_apres_relance_sec,
    history: [{
      at,
      by: actor?.id || actor?.sub || null,
      by_name: actor?.name || actor?.email || 'serveur',
      action: 'received',
      detail: 'Accusé de réception du serveur',
    }],
  };
}

export function isServerReceipt(record) {
  return Boolean(record && record.transmission_status === 'received' && record.id && record.received_at);
}

function withHistory(alert, entry) {
  return { ...alert, history: [...(alert.history || []), entry] };
}

export function applyPtiAction(alert, action, { actor, detail, result, motif, now } = {}) {
  if (!alert?.pti) {
    const error = new Error('Alerte PTI introuvable');
    error.status = 404;
    throw error;
  }
  if (alert.ack_status === 'closed') {
    const error = new Error('Alerte déjà clôturée');
    error.status = 409;
    throw error;
  }
  const at = now || new Date().toISOString();
  const entry = {
    at,
    by: actor?.id || actor?.sub || null,
    by_name: actor?.name || actor?.email || 'encadrement',
    action,
    detail: '',
  };
  if (action === 'acknowledge') {
    entry.detail = detail || 'Alerte acquittée';
    return { ...withHistory(alert, entry), ack_status: 'acknowledged', acknowledged_at: at, acknowledged_by: entry.by };
  }
  if (action === 'contact') {
    entry.detail = detail || 'Contact de l’agent';
    return withHistory(alert, entry);
  }
  if (action === 'doubt') {
    const text = String(result || detail || '').trim();
    if (!text) {
      const error = new Error('Résultat de levée de doute requis');
      error.status = 400;
      throw error;
    }
    entry.detail = text;
    return { ...withHistory(alert, entry), doubt_result: text, doubt_at: at };
  }
  if (action === 'escalate') {
    entry.detail = detail || 'Escalade déclenchée';
    return { ...withHistory(alert, entry), ack_status: 'escalated', escalated_at: at };
  }
  if (action === 'close') {
    const text = String(motif || detail || '').trim();
    if (!text) {
      const error = new Error('Motif de clôture requis');
      error.status = 400;
      throw error;
    }
    entry.detail = text;
    return { ...withHistory(alert, entry), ack_status: 'closed', closed_at: at, close_motif: text };
  }
  const error = new Error('Action inconnue');
  error.status = 400;
  throw error;
}

export function advancePtiAlert(alert, nowIso) {
  if (!alert?.pti || alert.is_test) return { alert, changed: false };
  if (alert.ack_status === 'closed' || alert.ack_status === 'acknowledged') return { alert, changed: false };
  const now = Date.parse(nowIso);
  const received = Date.parse(alert.received_at);
  if (!Number.isFinite(now) || !Number.isFinite(received)) return { alert, changed: false };
  let next = alert;
  let changed = false;
  const relanceSec = alert.relance_superviseur_sec || TIMING_DEFAULTS.relance_superviseur_sec;
  const escaladeSec = alert.escalade_apres_relance_sec || TIMING_DEFAULTS.escalade_apres_relance_sec;
  const hasRelance = (next.history || []).some((item) => item.action === 'relance');
  if (next.ack_status === 'pending' && !hasRelance && now >= received + relanceSec * 1000) {
    next = withHistory(next, {
      at: nowIso,
      by: 'system',
      by_name: 'Système',
      action: 'relance',
      detail: 'Relance superviseur échue',
    });
    changed = true;
  }
  const relanceAt = (next.history || []).find((item) => item.action === 'relance')?.at;
  const hasEscalade = (next.history || []).some((item) => item.action === 'escalate');
  if (relanceAt && !hasEscalade && next.ack_status !== 'closed' && now >= Date.parse(relanceAt) + escaladeSec * 1000) {
    next = applyPtiAction(next, 'escalate', {
      actor: { id: 'system', name: 'Système' },
      detail: 'Escalade automatique après relance',
      now: nowIso,
    });
    changed = true;
  }
  return { alert: next, changed };
}

export function evaluateImmobility({ samples, now, prealertSec, confirmSec, motionAvailable }) {
  if (!motionAvailable) return { phase: 'unavailable' };
  const list = Array.isArray(samples) ? samples : [];
  const still = list.filter((sample) => sample && sample.still && Number.isFinite(sample.t));
  if (still.length < 3) return { phase: 'waiting' };
  const newest = still[still.length - 1].t;
  const oldest = still[0].t;
  const span = newest - oldest;
  const pre = Math.max(1, prealertSec) * 1000;
  const confirm = Math.max(1, confirmSec) * 1000;
  if (now - newest > 5000) return { phase: 'waiting' };
  if (span < pre) return { phase: 'ok' };
  if (span < pre + confirm) return { phase: 'prealert' };
  return { phase: 'confirmed' };
}

export function evaluateZone({ outside, outsideSince, now, prealertSec }) {
  if (!outside || !Number.isFinite(outsideSince)) return { phase: 'ok' };
  const waited = now - outsideSince;
  if (waited < Math.max(1, prealertSec) * 1000) return { phase: 'prealert' };
  return { phase: 'confirmed' };
}

export function evaluateSosHold(holdMs, requiredSec) {
  const need = Math.max(1, requiredSec) * 1000;
  const held = Math.max(0, Number(holdMs) || 0);
  return { ready: held >= need, ratio: Math.min(1, held / need) };
}

export function evaluateBattery(levelPct, faible, critique) {
  if (levelPct == null || !Number.isFinite(Number(levelPct))) return { phase: 'unavailable' };
  const level = Number(levelPct);
  if (level <= critique) return { phase: 'critique' };
  if (level <= faible) return { phase: 'faible' };
  return { phase: 'ok' };
}

export function protectionFlags({
  onDuty = false,
  imposed = true,
  locallyEnabled = true,
  detections = {},
  features = {},
  pendingCount = 0,
  lastReceived = null,
} = {}) {
  const enabled = imposed ? Boolean(onDuty) : Boolean(onDuty && locallyEnabled);
  const needsMotion = Boolean(detections.chute || detections.immobilite || detections.perte_verticalite);
  const needsGps = Boolean(detections.zone_gps);
  const needsBattery = Boolean(detections.batterie);
  const motionBad = needsMotion && features.motion !== 'available';
  const gpsBad = needsGps && features.gps !== 'available';
  const batteryBad = needsBattery && features.battery !== 'available';
  const missing = [motionBad, gpsBad, batteryBad].filter(Boolean).length;
  const watched = [needsMotion, needsGps, needsBattery].filter(Boolean).length;
  let protection = 'inactive';
  if (enabled && missing === 0) protection = 'active';
  else if (enabled && missing > 0 && (watched === 0 || missing < watched || features.gps === 'available' || features.motion === 'available')) protection = 'partial';
  else if (enabled) protection = 'partial';

  const banners = [];
  if (protection === 'active') banners.push('protection_active');
  if (protection === 'partial') banners.push('protection_partial');
  if (features.motion === 'denied' || features.gps === 'denied') banners.push('permission_missing');
  if (needsGps && (features.gps === 'unavailable' || features.gps === 'denied' || features.gps === 'unverified')) banners.push('gps_unavailable');
  if (features.network === 'offline' || features.server === 'offline') banners.push('network_unavailable');
  if (pendingCount > 0) banners.push('alert_pending');
  if (lastReceived && lastReceived.transmission_status === 'received' && lastReceived.id) banners.push('alert_confirmed');
  return { protection, banners, missing };
}

export function detectPlatform(userAgent = '') {
  const ua = String(userAgent).toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'other';
}

export function classifyCapabilities(snapshot = {}) {
  const platform = snapshot.platform || detectPlatform(snapshot.userAgent || '');
  const motion = !snapshot.hasMotionApi
    ? 'unavailable'
    : snapshot.motionPermission === 'denied'
      ? 'denied'
      : snapshot.motionSamples > 0
        ? 'available'
        : 'unverified';
  const gps = !snapshot.hasGeolocation
    ? 'unavailable'
    : snapshot.geoState === 'denied'
      ? 'denied'
      : snapshot.geoFix
        ? 'available'
        : 'unverified';
  const battery = !snapshot.hasBatteryApi
    ? 'unavailable'
    : Number.isFinite(snapshot.batteryLevel)
      ? 'available'
      : 'unverified';
  return {
    platform,
    runtime: 'pwa',
    device_tested: false,
    background_guaranteed: false,
    features: {
      geolocation_foreground: gps,
      geolocation_background: 'unavailable',
      motion,
      verticality: motion === 'available' ? 'available' : motion,
      immobility: motion === 'available' ? 'available' : motion,
      battery: platform === 'ios' && !snapshot.hasBatteryApi ? 'unavailable' : battery,
      visible_notification: snapshot.notificationPermission === 'granted' ? 'available' : snapshot.hasNotification ? 'unverified' : 'unavailable',
      push_background: 'unavailable',
      vibration: platform === 'ios' || !snapshot.hasVibrate ? 'unavailable' : 'unverified',
      sos: 'available',
    },
  };
}
