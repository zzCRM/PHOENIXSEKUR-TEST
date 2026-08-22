// Règles de conformité : Code du travail français + CCN des entreprises de prévention et de sécurité (IDCC 1351).
// Centralisé ici pour mettre à jour facilement quand la réglementation évolue.
import { startOfWeek, endOfWeek, addDays, differenceInMilliseconds } from 'date-fns';

export const LABOR_RULES = {
  version: 'CCN EPS 1351 — Code du travail 2024',
  weeklyLegalHours: 35,       // durée légale (heures supp au-delà)
  weeklyMaxHours: 48,         // maximum absolu hebdomadaire (L3121-20)
  weeklyAvgMaxHours: 44,      // moyenne max sur 12 semaines consécutives
  dailyMaxHours: 12,           // max journalier (sécurité : dérogation 12h, L3121-19)
  dailyRestHours: 11,          // repos quotidien minimum consécutif (L3131-1)
  weeklyRestHours: 35,         // repos hebdomadaire minimum consécutif (L3132-2)
  nightStartHour: 21,          // début période de nuit
  nightEndHour: 6,             // fin période de nuit
  nightMaxHoursPerNight: 8,    // max par nuit
  nightMaxWeeklyHours: 40,     // max hebdo en nuit (44h sur 12 semaines)
};

function parseDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0);
}

export function missionRange(m) {
  if (!m || !m.date || !m.start_time || !m.end_time) return null;
  const start = parseDateTime(m.date, m.start_time);
  let end = parseDateTime(m.date, m.end_time);
  if (!start || !end) return null;
  if (end <= start) end = addDays(end, 1); // vacation de nuit traversant minuit
  return { start, end };
}

export function missionHours(m) {
  const r = missionRange(m);
  if (!r) return 0;
  return differenceInMilliseconds(r.end, r.start) / 3_600_000;
}

function hoursBetween(a, b) {
  return differenceInMilliseconds(b, a) / 3_600_000;
}

function mergeRanges(ranges) {
  if (!ranges.length) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged = [{ start: new Date(sorted[0].start), end: new Date(sorted[0].end) }];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i].start <= last.end) {
      last.end = new Date(Math.max(last.end, sorted[i].end));
    } else {
      merged.push({ start: new Date(sorted[i].start), end: new Date(sorted[i].end) });
    }
  }
  return merged;
}

// Détecte une période de nuit (21h-06h) dans une vacation
export function isNightMission(m) {
  const r = missionRange(m);
  if (!r) return false;
  const sh = r.start.getHours();
  return sh >= 21 || sh < 6 || (r.end.getHours() >= 1 && r.end.getHours() <= 6 && r.end > r.start);
}

/**
 * Vérifie la conformité d'une nouvelle vacation pour un agent,
 * à partir de ses missions déjà planifiées dans la même semaine.
 * @returns {Array<{type, severity, message}>} liste des alertes
 */
export function checkAgentCompliance(existingMissions, newMission) {
  const violations = [];
  if (!newMission || !newMission.date || !newMission.start_time || !newMission.end_time) return violations;

  const newRange = missionRange(newMission);
  if (!newRange) return violations;

  const weekStart = startOfWeek(new Date(newMission.date), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(newMission.date), { weekStartsOn: 1 });

  const weekMissions = (existingMissions || []).filter(m => {
    if (m.status === 'annulee') return false;
    const r = missionRange(m);
    if (!r) return false;
    return r.start < weekEnd && r.end > weekStart;
  });

  const allMissions = [...weekMissions, newMission];
  const ranges = allMissions.map(missionRange).filter(Boolean);

  // 1. Quota hebdomadaire
  const weeklyHours = ranges.reduce((s, r) => s + hoursBetween(r.start, r.end), 0);
  if (weeklyHours > LABOR_RULES.weeklyMaxHours) {
    violations.push({
      type: 'weekly_max',
      severity: 'urgent',
      message: `Dépassement du quota hebdomadaire : ${weeklyHours.toFixed(1)}h planifiées / ${LABOR_RULES.weeklyMaxHours}h max (Code trav. art. L3121-20)`,
    });
  } else if (weeklyHours > LABOR_RULES.weeklyLegalHours) {
    violations.push({
      type: 'weekly_legal',
      severity: 'attention',
      message: `Au-delà de la durée légale 35h : ${weeklyHours.toFixed(1)}h cette semaine — heures supplémentaires à déclarer`,
    });
  }

  // 2. Quota journalier (jour de la nouvelle vacation)
  const sameDay = allMissions.filter(m => m.date === newMission.date);
  const dailyHours = sameDay.reduce((s, m) => s + missionHours(m), 0);
  if (dailyHours > LABOR_RULES.dailyMaxHours) {
    violations.push({
      type: 'daily_max',
      severity: 'urgent',
      message: `Dépassement du quota journalier : ${dailyHours.toFixed(1)}h / ${LABOR_RULES.dailyMaxHours}h max (Code trav. art. L3121-19)`,
    });
  }

  // 3. Repos quotidien (11h) — écart entre vacations consécutives
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i++) {
    const gap = hoursBetween(sorted[i - 1].end, sorted[i].start);
    if (gap >= 0 && gap < LABOR_RULES.dailyRestHours) {
      violations.push({
        type: 'daily_rest',
        severity: 'urgent',
        message: `Repos quotidien insuffisant : ${gap.toFixed(1)}h entre deux services (min ${LABOR_RULES.dailyRestHours}h — Code trav. art. L3131-1)`,
      });
      break;
    }
  }

  // 4. Repos hebdomadaire (35h) — plus grand bloc de repos continu dans la semaine
  const merged = mergeRanges(ranges);
  let maxRest = merged.length ? hoursBetween(weekStart, merged[0].start) : hoursBetween(weekStart, weekEnd);
  for (let i = 0; i < merged.length - 1; i++) {
    maxRest = Math.max(maxRest, hoursBetween(merged[i].end, merged[i + 1].start));
  }
  if (merged.length) maxRest = Math.max(maxRest, hoursBetween(merged[merged.length - 1].end, weekEnd));
  if (maxRest < LABOR_RULES.weeklyRestHours) {
    violations.push({
      type: 'weekly_rest',
      severity: 'attention',
      message: `Repos hebdomadaire non respecté : plus grand repos continu = ${maxRest.toFixed(1)}h (min ${LABOR_RULES.weeklyRestHours}h — Code trav. art. L3132-2)`,
    });
  }

  // 5. Travail de nuit (21h-06h)
  if (isNightMission(newMission)) {
    // 5a. Durée quotidienne max 8h (Code trav. art. L3122-6)
    const sameDayNight = allMissions.filter(m => m.date === newMission.date && isNightMission(m));
    const nightDailyHours = sameDayNight.reduce((s, m) => s + missionHours(m), 0);
    if (nightDailyHours > LABOR_RULES.nightMaxHoursPerNight) {
      violations.push({
        type: 'night_daily_max',
        severity: 'urgent',
        message: `Travail de nuit : ${nightDailyHours.toFixed(1)}h cette nuit / ${LABOR_RULES.nightMaxHoursPerNight}h max par jour`,
        source: { label: 'Code trav. art. L3122-6', url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000035653023' },
      });
    }
    // 5b. Moyenne hebdomadaire max 40h (Code trav. art. L3122-7)
    const nightMissions = allMissions.filter(isNightMission);
    const nightWeeklyHours = nightMissions.reduce((s, m) => s + missionHours(m), 0);
    if (nightWeeklyHours > LABOR_RULES.nightMaxWeeklyHours) {
      violations.push({
        type: 'night_weekly_max',
        severity: 'attention',
        message: `Travail de nuit : ${nightWeeklyHours.toFixed(1)}h cette semaine / ${LABOR_RULES.nightMaxWeeklyHours}h max (moyenne sur 12 semaines)`,
        source: { label: 'Code trav. art. L3122-7', url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000033020165' },
      });
    }
  }

  return violations;
}