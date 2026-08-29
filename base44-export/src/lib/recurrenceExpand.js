import { addDays, addWeeks, addMonths, format, parseISO, getDay } from 'date-fns';
import { getJoursFeries } from './joursFeries.js';

const JOUR_INDEX = {
  Dimanche: 0,
  Lundi: 1,
  Mardi: 2,
  Mercredi: 3,
  Jeudi: 4,
  Vendredi: 5,
  Samedi: 6,
};

function dateKey(d) {
  return format(d, 'yyyy-MM-dd');
}

function feriesSet(startYear, endYear) {
  const set = new Set();
  for (let y = startYear; y <= endYear; y += 1) {
    getJoursFeries(y).forEach((f) => {
      const d = f.date instanceof Date ? f.date : new Date(f.date);
      set.add(dateKey(d));
    });
  }
  return set;
}

/**
 * Développe les dates d'une vacation récurrente (max 400 occurrences).
 */
export function expandRecurrenceDates(form) {
  if (!form?.date) return [];
  const start = parseISO(form.date);
  if (Number.isNaN(start.getTime())) return [];

  if (!form.recurrence) return [dateKey(start)];

  const end = form.date_fin_recurrence ? parseISO(form.date_fin_recurrence) : start;
  if (Number.isNaN(end.getTime()) || end < start) return [dateKey(start)];

  const freq = Math.max(1, Number(form.recurrence_frequence) || 1);
  const type = form.recurrence_type || 'Quotidienne';
  const excludeFeries = !!form.recurrence_exclure_feries;
  const feries = excludeFeries || type === 'Jours fériés'
    ? feriesSet(start.getFullYear(), end.getFullYear())
    : new Set();

  const dates = [];
  const push = (d) => {
    const key = dateKey(d);
    if (key < dateKey(start) || key > dateKey(end)) return;
    if (excludeFeries && feries.has(key) && type !== 'Jours fériés') return;
    if (!dates.includes(key)) dates.push(key);
  };

  if (type === 'Jours fériés') {
    feries.forEach((key) => {
      if (key >= dateKey(start) && key <= dateKey(end)) dates.push(key);
    });
    dates.sort();
    return dates.slice(0, 400);
  }

  if (type === 'Quotidienne') {
    let cursor = start;
    let i = 0;
    while (cursor <= end && dates.length < 400 && i < 800) {
      push(cursor);
      cursor = addDays(cursor, freq);
      i += 1;
    }
    return dates;
  }

  if (type === 'Hebdomadaire') {
    const wanted = (form.recurrence_jours || [])
      .map((j) => JOUR_INDEX[j])
      .filter((n) => n !== undefined);
    const days = wanted.length ? wanted : [getDay(start)];
    let weekStart = start;
    let weeks = 0;
    while (weekStart <= end && dates.length < 400 && weeks < 120) {
      days.forEach((dow) => {
        const delta = (dow - getDay(weekStart) + 7) % 7;
        push(addDays(weekStart, delta));
      });
      weekStart = addWeeks(weekStart, freq);
      weeks += 1;
    }
    return dates.sort();
  }

  if (type === 'Mensuelle') {
    const daysOfMonth = (form.recurrence_jours_mois || [])
      .map(Number)
      .filter((n) => n >= 1 && n <= 31);
    const days = daysOfMonth.length ? daysOfMonth : [start.getDate()];
    let monthCursor = new Date(start.getFullYear(), start.getMonth(), 1);
    let months = 0;
    while (monthCursor <= end && dates.length < 400 && months < 60) {
      days.forEach((dom) => {
        const d = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), dom);
        if (d.getMonth() === monthCursor.getMonth()) push(d);
      });
      monthCursor = addMonths(monthCursor, freq);
      months += 1;
    }
    return dates.sort();
  }

  return [dateKey(start)];
}

export function normalizeDateKey(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.split('T')[0];
  try {
    return format(new Date(value), 'yyyy-MM-dd');
  } catch {
    return '';
  }
}

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isMissionVisibleToAgent(m, {
  agentId,
  userId,
  agentEmail,
  agentName,
  firstName,
  lastName,
} = {}) {
  if (!m || m.status === 'annulee') return false;
  if (m.visible_agent === false || m.planifier_visible === false) return false;

  const ids = [agentId, userId].filter(Boolean);
  if (ids.length && (ids.includes(m.agent_id) || ids.includes(m.agentId))) return true;

  if (agentEmail && String(m.agent_email || '').toLowerCase() === String(agentEmail).toLowerCase()) {
    return true;
  }

  const missionName = normalizeName(m.agent_name);
  if (!missionName) return false;

  const tokens = [lastName, firstName, agentName]
    .flatMap((part) => normalizeName(part).split(' '))
    .filter((t) => t.length >= 3);

  return tokens.some((token) => missionName.includes(token));
}
