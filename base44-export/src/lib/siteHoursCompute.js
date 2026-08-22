import { getDay, format } from 'date-fns';
import { buildJoursFeriesMap } from './joursFeries';

/**
 * Découpe les heures d'un service en heures de jour (06h-21h) et de nuit (21h-06h).
 * Gère le passage à minuit (services jusqu'à 24h).
 */
export function splitDayNight(startStr, endStr) {
  if (!startStr || !endStr) return { day: 0, night: 0, total: 0 };
  const [sh, sm] = startStr.split(':').map(Number);
  const [eh, em] = endStr.split(':').map(Number);
  let startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;
  if (endMin <= startMin) endMin += 24 * 60; // traverse minuit
  const total = (endMin - startMin) / 60;
  // Fenêtre de jour sur la journée de début : 06h-21h
  const dayStart = 360, dayEnd = 1260;
  let dayOverlap = Math.max(0, Math.min(endMin, dayEnd) - Math.max(startMin, dayStart));
  // Si le service déborde sur le lendemain, ajouter la fenêtre de jour du lendemain
  if (endMin > 1440) {
    const nextDayStart = 1440 + 360, nextDayEnd = 1440 + 1260;
    dayOverlap += Math.max(0, Math.min(endMin, nextDayEnd) - Math.max(startMin, nextDayStart));
  }
  const day = dayOverlap / 60;
  const night = Math.max(0, total - day);
  return { day, night, total };
}

/**
 * Calcule les heures ventilées par site à partir d'une liste de missions.
 * Buckets : jour, nuit, jour_ferie, nuit_ferie, dimanche_jour, dimanche_nuit,
 *           dimanche_jour_ferie, dimanche_nuit_ferie
 */
export function computeSiteHours(missions) {
  if (!missions || missions.length === 0) return {};

  // Carte des jours fériés couvrant toutes les années présentes
  const years = new Set();
  missions.forEach(m => { if (m.date) years.add(new Date(m.date.split('T')[0]).getFullYear()); });
  const feriesMaps = {};
  years.forEach(y => { feriesMaps[y] = buildJoursFeriesMap(y); });

  const bySite = {};

  missions.forEach(m => {
    if (!m.date || !m.site_id || m.status === 'annulee') return;
    const date = new Date(m.date.split('T')[0]);
    const dateKey = format(date, 'yyyy-MM-dd');
    const isFerie = !!feriesMaps[date.getFullYear()]?.[dateKey];
    const isSunday = getDay(date) === 0;
    const { day, night } = splitDayNight(m.start_time, m.end_time);

    const s = bySite[m.site_id] || {
      site_id: m.site_id,
      site_name: m.site_name || '',
      client_id: m.client_id || '',
      client_name: m.client_name || '',
      count: 0, total: 0,
      jour: 0, nuit: 0, jour_ferie: 0, nuit_ferie: 0,
      dimanche_jour: 0, dimanche_nuit: 0,
      dimanche_jour_ferie: 0, dimanche_nuit_ferie: 0,
    };

    if (isSunday && isFerie) {
      s.dimanche_jour_ferie += day;
      s.dimanche_nuit_ferie += night;
    } else if (isSunday) {
      s.dimanche_jour += day;
      s.dimanche_nuit += night;
    } else if (isFerie) {
      s.jour_ferie += day;
      s.nuit_ferie += night;
    } else {
      s.jour += day;
      s.nuit += night;
    }
    s.count += 1;
    s.total += day + night;
    bySite[m.site_id] = s;
  });

  return bySite;
}