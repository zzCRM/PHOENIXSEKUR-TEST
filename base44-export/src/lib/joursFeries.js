import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Calcule le dimanche de Pâques pour une année (algorithme de Meeus/Jones/Butcher).
 */
function paques(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/**
 * Retourne la liste des jours fériés français pour une année donnée.
 * @param {number} year
 * @returns {Array<{date: Date, name: string}>}
 */
export function getJoursFeries(year) {
  const fixes = [
    { month: 0, day: 1, name: "Jour de l'An" },
    { month: 4, day: 1, name: "Fête du Travail" },
    { month: 4, day: 8, name: "Victoire 1945" },
    { month: 6, day: 14, name: "Fête Nationale" },
    { month: 7, day: 15, name: "Assomption" },
    { month: 10, day: 1, name: "Toussaint" },
    { month: 10, day: 11, name: "Armistice 1918" },
    { month: 11, day: 25, name: "Noël" },
  ].map(f => ({ date: new Date(year, f.month, f.day), name: f.name }));

  const dimanchePaques = paques(year);
  const religieux = [
    { date: addDays(dimanchePaques, 1), name: "Lundi de Pâques" },
    { date: addDays(dimanchePaques, 39), name: "Ascension" },
    { date: addDays(dimanchePaques, 50), name: "Lundi de Pentecôte" },
  ];

  return [...fixes, ...religieux].sort((a, b) => a.date - b.date);
}

/**
 * Map clé "yyyy-MM-dd" -> nom du jour férié, pour une année donnée.
 */
export function buildJoursFeriesMap(year) {
  const map = {};
  getJoursFeries(year).forEach(j => {
    map[format(j.date, 'yyyy-MM-dd')] = j.name;
  });
  return map;
}