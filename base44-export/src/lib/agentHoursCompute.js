import { getDay, format } from 'date-fns';
import { buildJoursFeriesMap } from './joursFeries';
import { splitDayNight } from './siteHoursCompute';

/**
 * Heures ventilées par collaborateur (agent) à partir des missions.
 */
export function computeAgentHours(missions) {
  if (!missions?.length) return {};

  const years = new Set();
  missions.forEach((m) => { if (m.date) years.add(new Date(m.date.split('T')[0]).getFullYear()); });
  const feriesMaps = {};
  years.forEach((y) => { feriesMaps[y] = buildJoursFeriesMap(y); });

  const byAgent = {};

  missions.forEach((m) => {
    if (!m.date || !m.agent_id || m.status === 'annulee') return;
    const date = new Date(m.date.split('T')[0]);
    const dateKey = format(date, 'yyyy-MM-dd');
    const isFerie = !!feriesMaps[date.getFullYear()]?.[dateKey];
    const isSunday = getDay(date) === 0;
    const { day, night } = splitDayNight(m.start_time, m.end_time);

    const a = byAgent[m.agent_id] || {
      agent_id: m.agent_id,
      agent_name: m.agent_name || '',
      count: 0,
      total: 0,
      jour: 0,
      nuit: 0,
      jour_ferie: 0,
      nuit_ferie: 0,
      dimanche_jour: 0,
      dimanche_nuit: 0,
      dimanche_jour_ferie: 0,
      dimanche_nuit_ferie: 0,
    };

    if (isSunday && isFerie) {
      a.dimanche_jour_ferie += day;
      a.dimanche_nuit_ferie += night;
    } else if (isSunday) {
      a.dimanche_jour += day;
      a.dimanche_nuit += night;
    } else if (isFerie) {
      a.jour_ferie += day;
      a.nuit_ferie += night;
    } else {
      a.jour += day;
      a.nuit += night;
    }
    a.count += 1;
    a.total += day + night;
    byAgent[m.agent_id] = a;
  });

  return byAgent;
}
