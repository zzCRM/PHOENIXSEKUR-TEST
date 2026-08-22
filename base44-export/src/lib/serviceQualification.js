import { getDay, format } from 'date-fns';
import { buildJoursFeriesMap } from './joursFeries';

/**
 * Détection des heures de nuit (21h00 - 06h00).
 * Un service est "nuit" s'il chevauche la fenêtre 21h-06h.
 */

/**
 * Durée d'un service en heures décimales (gère le passage à minuit).
 */
export function serviceDurationHours(startStr, endStr) {
  if (!startStr || !endStr) return 0;
  const [sh, sm] = startStr.split(':').map(Number);
  const [eh, em] = endStr.split(':').map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60;
  return diff / 60;
}

/**
 * Indique si un service chevauche la plage de nuit (21h00 - 06h00).
 */
export function isNightService(startStr, endStr) {
  if (!startStr || !endStr) return false;
  const [sh, sm] = startStr.split(':').map(Number);
  const [eh, em] = endStr.split(':').map(Number);
  let startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;
  if (endMin <= startMin) endMin += 24 * 60; // traverse minuit

  const overlap = (a, b, c, d) => Math.max(0, Math.min(b, d) - Math.max(a, c));
  // Fenêtres de nuit : [0h, 6h] le matin, [21h, 24h] le soir, [24h, 30h] pour la nuit suivante (services traversant minuit)
  return overlap(startMin, endMin, 0, 360) > 0
      || overlap(startMin, endMin, 1260, 1440) > 0
      || overlap(startMin, endMin, 1440, 1800) > 0;
}

/**
 * Qualifie un service selon une priorité : férié > dimanche > nuit > jour.
 * @returns {{ bucket, isFerie, isSunday, isNight, durationHours, label, color }}
 */
export function qualifyService(date, startStr, endStr, feriesMap) {
  const dateKey = format(date, 'yyyy-MM-dd');
  const isFerie = !!(feriesMap && feriesMap[dateKey]);
  const isSunday = getDay(date) === 0;
  const isNight = isNightService(startStr, endStr);
  const durationHours = serviceDurationHours(startStr, endStr);

  let bucket = 'jour';
  if (isFerie) bucket = 'ferie';
  else if (isSunday) bucket = 'dimanche';
  else if (isNight) bucket = 'nuit';

  const labels = {
    jour: 'Jour',
    nuit: 'Nuit (21h-06h)',
    dimanche: 'Dimanche',
    ferie: 'Jour férié',
  };
  const colors = {
    jour: 'bg-emerald-500',
    nuit: 'bg-indigo-500',
    dimanche: 'bg-amber-500',
    ferie: 'bg-red-500',
  };

  return { bucket, isFerie, isSunday, isNight, durationHours, label: labels[bucket], color: colors[bucket] };
}

/**
 * Génère les lignes de facturation séparées par type (jour/nuit/dimanche/férié)
 * pour une liste de missions d'un mois donné, groupées par client.
 * @returns { clientId: { client_name, lines: { bucket, hours, count, missions: [] } } }
 */
export function buildFacturationLines(missions, feriesMap) {
  const byClient = {};

  missions.forEach(m => {
    if (!m.date || m.status === 'annulee') return;
    const date = new Date(m.date.split('T')[0]);
    const q = qualifyService(date, m.start_time, m.end_time, feriesMap);
    const clientKey = m.client_id || m.client_name || 'inconnu';
    if (!byClient[clientKey]) {
      byClient[clientKey] = { client_name: m.client_name || 'Client inconnu', lines: {} };
    }
    if (!byClient[clientKey].lines[q.bucket]) {
      byClient[clientKey].lines[q.bucket] = { bucket: q.bucket, label: q.label, hours: 0, count: 0, missions: [] };
    }
    byClient[clientKey].lines[q.bucket].hours += q.durationHours;
    byClient[clientKey].lines[q.bucket].count += 1;
    byClient[clientKey].lines[q.bucket].missions.push(m);
  });

  return byClient;
}