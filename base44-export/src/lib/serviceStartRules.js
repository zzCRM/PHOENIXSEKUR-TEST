import { isOutsideGeofence } from './geoUtils.js';

function dateKey(value) {
  if (!value) return '';
  return String(value).split('T')[0];
}

function parseDateTime(date, time) {
  const day = dateKey(date);
  if (!day || !time) return null;
  const t = time.length === 5 ? `${time}:00` : time;
  const d = new Date(`${day}T${t}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Heure de début planifiée (date + start_time). */
export function plannedStartAt(mission) {
  if (!mission) return null;
  return parseDateTime(mission.date, mission.start_time);
}

/**
 * Interdit la prise de service avant l'heure planifiée.
 * Les services non planifiés restent libres.
 */
export function canStartPlannedService(mission, now = new Date()) {
  if (!mission || mission.unplanned) return { ok: true, late: false };
  const start = plannedStartAt(mission);
  if (!start) return { ok: true, late: false };
  if (now < start) {
    return {
      ok: false,
      late: false,
      reason: `La prise de service est bloquée jusqu’à ${mission.start_time} (heure planifiée).`,
    };
  }
  const lateMs = now.getTime() - start.getTime();
  return { ok: true, late: lateMs > 3 * 60 * 1000 };
}

export function resolvePriseMode(site) {
  if (!site) return 'libre';
  if (site.prise_service_mode === 'nfc' || site.pointage_arrivee) return 'nfc';
  if (site.prise_service_mode === 'geolocalisation') return 'geolocalisation';
  return 'libre';
}

export function resolveFinMode(site) {
  if (!site) return 'libre';
  if (site.prise_service_mode === 'nfc' || site.pointage_depart) return 'nfc';
  if (site.prise_service_mode === 'geolocalisation') return 'geolocalisation';
  return 'libre';
}

function checkpointTag(site, role) {
  const list = site?.checkpoints_service || [];
  const hit = list.find((c) => c.actif !== false && c.role === role && c.nfc_tag_id);
  return hit?.nfc_tag_id || '';
}

export function expectedStartNfc(site) {
  return site?.nfc_tag_id || checkpointTag(site, 'debut') || '';
}

export function expectedEndNfc(site) {
  return site?.nfc_tag_fin_id || checkpointTag(site, 'fin') || site?.nfc_tag_id || '';
}

export function nfcMatches(expected, scanned) {
  if (!expected || !scanned) return false;
  const a = String(expected).trim().toLowerCase();
  const b = String(scanned).trim().toLowerCase();
  return a === b || b.replace(/[:-]/g, '') === a.replace(/[:-]/g, '');
}

export function isWithinSiteGeofence(position, site) {
  if (!position || site?.latitude == null || site?.longitude == null) return { ok: false, reason: 'Périmètre du site non configuré.' };
  const radius = Number(site.geofence_radius) || 200;
  const outside = isOutsideGeofence(
    position.latitude,
    position.longitude,
    Number(site.latitude),
    Number(site.longitude),
    radius,
  );
  if (outside) {
    return { ok: false, reason: `Vous êtes hors du périmètre de prise de service (${radius} m).` };
  }
  return { ok: true, radius };
}
