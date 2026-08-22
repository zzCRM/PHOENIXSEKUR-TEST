import jsPDF from 'jspdf';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { buildJoursFeriesMap } from './joursFeries';
import { qualifyService, serviceDurationHours } from './serviceQualification';
import { drawEntityHeader } from './pdfClientHeader';

const STATUS_COLORS_HEX = {
  planifiee: [16, 185, 129],
  en_cours: [5, 150, 105],
  terminee: [45, 212, 191],
  annulee: [156, 163, 175],
};

/**
 * Exporte le planning du mois en PDF paysage A4, regroupé par site ou par collaborateur.
 * @param {Object} opts
 * @param {'site'|'collaborateur'} opts.mode
 * @param {Date} opts.monthDate
 * @param {Array} opts.missions
 * @param {string} opts.companyName
 */
export async function exportPlanningPdf({ mode, monthDate, missions, company }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 8;

  // En-tête émetteur : logo + coordonnées de la société (aligné à droite)
  await drawEntityHeader(doc, company, { x: margin, y: margin, pageW, align: 'right', maxLogoH: 12 });
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const year = monthDate.getFullYear();
  const feriesMap = { ...buildJoursFeriesMap(year), ...buildJoursFeriesMap(year - 1), ...buildJoursFeriesMap(year + 1) };

  // Filtrer missions du mois
  const monthMissions = missions.filter(m => {
    if (!m.date) return false;
    const d = new Date(m.date.split('T')[0]);
    return d >= monthStart && d <= monthEnd;
  });

  // Grouper
  const groups = {};
  monthMissions.forEach(m => {
    const key = mode === 'site'
      ? (m.site_id || m.site_name || 'inconnu')
      : (m.agent_id || m.agent_name || 'non-assigné');
    if (!groups[key]) {
      groups[key] = mode === 'site'
        ? { label: m.site_name || 'Site inconnu', sub: m.client_name || '', missions: [] }
        : { label: m.agent_name || 'Non assigné', sub: '', missions: [] };
    }
    groups[key].missions.push(m);
  });

  const monthLabel = format(monthDate, 'MMMM yyyy', { locale: fr });
  const modeLabel = mode === 'site' ? 'par site' : 'par collaborateur';

  // --- Page de garde ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(30, 41, 59);
  doc.text('Planning mensuel', margin, 25);
  doc.setFontSize(13);
  doc.setTextColor(100, 116, 139);
  doc.text(`${monthLabel} — regroupé ${modeLabel}`, margin, 33);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(company?.company_name || '', margin, 40);
  doc.text(`Édité le ${format(new Date(), 'dd/MM/yyyy à HH:mm')}`, margin, 45);

  // Légende
  let legendX = margin;
  let legendY = 52;
  const legendItems = [
    { label: 'Jour', color: [16, 185, 129] },
    { label: 'Nuit', color: [79, 70, 229] },
    { label: 'Dimanche', color: [245, 158, 11] },
    { label: 'Férié', color: [239, 68, 68] },
  ];
  doc.setFontSize(8);
  legendItems.forEach(it => {
    doc.setFillColor(...it.color);
    doc.rect(legendX, legendY - 2, 3, 3, 'F');
    doc.setTextColor(71, 85, 105);
    doc.text(it.label, legendX + 4, legendY);
    legendX += 22;
  });

  // --- Tableau du planning ---
  const tableTop = 62;
  const leftColW = 55;
  const dayColW = (pageW - margin * 2 - leftColW) / days.length;
  const rowH = 7;

  // En-tête : colonne gauche
  doc.setFillColor(108, 117, 125);
  doc.rect(margin, tableTop, leftColW, rowH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text(mode === 'site' ? 'Sites' : 'Collaborateurs', margin + 2, tableTop + 4.5);

  // En-tête : jours
  days.forEach((day, i) => {
    const x = margin + leftColW + i * dayColW;
    const isFerie = !!feriesMap[format(day, 'yyyy-MM-dd')];
    const isWeekend = getDay(day) === 0 || getDay(day) === 6;
    if (isFerie) doc.setFillColor(254, 226, 226);
    else if (isWeekend) doc.setFillColor(241, 245, 249);
    else doc.setFillColor(248, 250, 252);
    doc.rect(x, tableTop, dayColW, rowH, 'F');
    doc.setTextColor(isFerie ? [185, 28, 28] : isWeekend ? [100, 116, 139] : [51, 65, 85]);
    doc.setFontSize(6.5);
    doc.text(String(format(day, 'd')), x + dayColW / 2, tableTop + 3, { align: 'center' });
    doc.setFontSize(5.5);
    doc.text(['D', 'L', 'M', 'M', 'J', 'V', 'S'][getDay(day)], x + dayColW / 2, tableTop + 6, { align: 'center' });
  });

  // Lignes par groupe
  let y = tableTop + rowH;
  const groupKeys = Object.keys(groups);

  if (groupKeys.length === 0) {
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(10);
    doc.text('Aucune mission planifiée ce mois-ci.', margin + 2, y + 5);
  }

  groupKeys.forEach(key => {
    // Nouvelle page si on déborde
    if (y + rowH > pageH - margin - 10) {
      doc.addPage();
      y = margin;
      // répéter l'en-tête des jours
      doc.setFillColor(108, 117, 125);
      doc.rect(margin, y, leftColW, rowH, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text(mode === 'site' ? 'Sites' : 'Collaborateurs', margin + 2, y + 4.5);
      days.forEach((day, i) => {
        const x = margin + leftColW + i * dayColW;
        const isFerie = !!feriesMap[format(day, 'yyyy-MM-dd')];
        const isWeekend = getDay(day) === 0 || getDay(day) === 6;
        if (isFerie) doc.setFillColor(254, 226, 226);
        else if (isWeekend) doc.setFillColor(241, 245, 249);
        else doc.setFillColor(248, 250, 252);
        doc.rect(x, y, dayColW, rowH, 'F');
        doc.setTextColor(isFerie ? [185, 28, 28] : isWeekend ? [100, 116, 139] : [51, 65, 85]);
        doc.setFontSize(6.5);
        doc.text(String(format(day, 'd')), x + dayColW / 2, y + 3, { align: 'center' });
      });
      y += rowH;
    }

    const g = groups[key];
    // Ligne de titre du groupe
    doc.setFillColor(226, 232, 240);
    doc.rect(margin, y, pageW - margin * 2, rowH, 'F');
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(g.label, margin + 2, y + 4.5);
    if (g.sub) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(g.sub, margin + leftColW - 2, y + 4.5, { align: 'right' });
    }
    y += rowH;

    // Missions du groupe placées dans le tableau
    days.forEach((day, i) => {
      const x = margin + leftColW + i * dayColW;
      const dateKey = format(day, 'yyyy-MM-dd');
      const isFerie = !!feriesMap[dateKey];
      const isWeekend = getDay(day) === 0 || getDay(day) === 6;
      if (isFerie) doc.setFillColor(254, 242, 242);
      else if (isWeekend) doc.setFillColor(248, 250, 252);
      else doc.setFillColor(255, 255, 255);
      doc.rect(x, y, dayColW, rowH, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.1);
      doc.line(x, y, x, y + rowH);

      const dayMissions = g.missions.filter(m => m.date && m.date.split('T')[0] === dateKey);
      if (dayMissions.length > 0) {
        const m = dayMissions[0];
        const q = qualifyService(day, m.start_time, m.end_time, feriesMap);
        const colorMap = { jour: [16, 185, 129], nuit: [79, 70, 229], dimanche: [245, 158, 11], ferie: [239, 68, 68] };
        doc.setFillColor(...(colorMap[q.bucket] || [16, 185, 129]));
        doc.rect(x + 0.5, y + 1, dayColW - 1, rowH - 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        const txt = dayMissions.length > 1 ? `${dayMissions.length}` : '1';
        doc.text(txt, x + dayColW / 2, y + rowH / 2 + 1, { align: 'center' });
      }
    });
    y += rowH;
  });

  // --- Page synthèse : répartition par type ---
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text('Synthèse du mois', margin, 20);
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`${monthLabel} — ${monthMissions.length} service(s)`, margin, 27);

  // Tableau récap par type
  const buckets = { jour: 0, nuit: 0, dimanche: 0, ferie: 0 };
  const hours = { jour: 0, nuit: 0, dimanche: 0, ferie: 0 };
  monthMissions.forEach(m => {
    if (!m.date || m.status === 'annulee') return;
    const d = new Date(m.date.split('T')[0]);
    const q = qualifyService(d, m.start_time, m.end_time, feriesMap);
    buckets[q.bucket] += 1;
    hours[q.bucket] += q.durationHours;
  });

  const recapTop = 38;
  doc.setFillColor(108, 117, 125);
  doc.rect(margin, recapTop, pageW - margin * 2, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Type de service', margin + 3, recapTop + 5.5);
  doc.text('Nb services', margin + 90, recapTop + 5.5);
  doc.text('Heures', margin + 150, recapTop + 5.5);

  const rows = [
    { label: 'Jour (normal)', count: buckets.jour, hours: hours.jour, color: [16, 185, 129] },
    { label: 'Nuit (21h-06h)', count: buckets.nuit, hours: hours.nuit, color: [79, 70, 229] },
    { label: 'Dimanche', count: buckets.dimanche, hours: hours.dimanche, color: [245, 158, 11] },
    { label: 'Jour férié', count: buckets.ferie, hours: hours.ferie, color: [239, 68, 68] },
  ];
  let ry = recapTop + 8;
  rows.forEach((r, i) => {
    if (i % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(margin, ry, pageW - margin * 2, 8, 'F'); }
    doc.setFillColor(...r.color);
    doc.rect(margin, ry + 1.5, 2.5, 5, 'F');
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(r.label, margin + 8, ry + 5.5);
    doc.text(String(r.count), margin + 90, ry + 5.5);
    doc.text(`${r.hours.toFixed(1)} h`, margin + 150, ry + 5.5);
    ry += 8;
  });

  // Total
  doc.setFillColor(226, 232, 240);
  doc.rect(margin, ry, pageW - margin * 2, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('TOTAL', margin + 8, ry + 6);
  doc.text(String(monthMissions.length), margin + 90, ry + 6);
  const totalH = Object.values(hours).reduce((s, h) => s + h, 0);
  doc.text(`${totalH.toFixed(1)} h`, margin + 150, ry + 6);

  // Pied de page sur chaque page
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Planning ${modeLabel} — ${monthLabel} — page ${i}/${pageCount}`, pageW - margin, pageH - 4, { align: 'right' });
  }

  const fileName = `planning-${mode}-${format(monthDate, 'yyyy-MM')}.pdf`;
  doc.save(fileName);
}