import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const typeLabels = { gardiennage: 'Gardiennage & Surveillance', surveillance: 'Surveillance', intervention: 'Intervention', ronde: 'Ronde', evenementiel: 'Événementiel' };
const statusLabels = { planifiee: 'Planifié', en_cours: 'En cours', terminee: 'Terminé', non_realise: 'Non réalisé', annulee: 'Annulé' };

const hoursBetween = (s, e) => {
  if (!s || !e) return 0;
  const [h1, m1] = s.split(':').map(Number);
  const [h2, m2] = e.split(':').map(Number);
  let d = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (d < 0) d += 1440;
  return d / 60;
};

const buildRows = (missions, sites) => {
  const siteMap = Object.fromEntries((sites || []).map(s => [s.id, s]));
  return missions.map(m => {
    const site = siteMap[m.site_id];
    const addr = site ? `${site.address || ''} ${site.postal_code || ''} ${site.city || ''}`.trim() : '';
    const dur = hoursBetween(m.start_time, m.end_time);
    return {
      date: m.date ? format(new Date(m.date), 'dd/MM/yyyy', { locale: fr }) : '—',
      client: m.client_name || '—',
      site: m.site_name || '—',
      adresse: addr || '—',
      agent: m.agent_name || 'Non affecté',
      type: typeLabels[m.type] || m.type || '—',
      poste: m.title || '—',
      statut: statusLabels[m.status] || m.status || '—',
      duree: dur ? `${String(Math.floor(dur)).padStart(2, '0')}h${String(Math.round((dur % 1) * 60)).padStart(2, '0')}` : '—',
    };
  });
};

export function exportMissionsCsv(missions, sites) {
  const rows = buildRows(missions, sites);
  const headers = ['Date', 'Client', 'Site', 'Adresse', 'Collaborateur', 'Spécialité', 'Intitulé', 'Statut', 'Durée'];
  const lines = [headers, ...rows.map(r => [r.date, r.client, r.site, r.adresse, r.agent, r.type, r.poste, r.statut, r.duree])];
  const csv = lines.map(l => l.map(v => `"${(v ?? '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `missions_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`; a.click(); URL.revokeObjectURL(url);
}

export function exportMissionsPdf(missions, sites) {
  const rows = buildRows(missions, sites);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 12;
  const headers = ['Date', 'Client', 'Site', 'Adresse', 'Collaborateur', 'Spécialité', 'Intitulé', 'Statut', 'Durée'];
  const colWidths = [22, 38, 34, 50, 38, 38, 38, 24, 20];
  const tableW = colWidths.reduce((a, b) => a + b, 0);
  let x = (pageW - tableW) / 2;
  let y = 18;

  doc.setFontSize(14); doc.setFont(undefined, 'bold');
  doc.text('Liste des missions', pageW / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(8); doc.setFont(undefined, 'normal');
  doc.text(`Généré le ${format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })}`, pageW / 2, y, { align: 'center' });
  y += 6;

  // Header
  doc.setFillColor(33, 33, 33); doc.setTextColor(255, 255, 255); doc.setFont(undefined, 'bold'); doc.setFontSize(8);
  let cx = x;
  headers.forEach((h, i) => {
    doc.rect(cx, y, colWidths[i], 7, 'F');
    doc.text(h, cx + 1.5, y + 4.8);
    cx += colWidths[i];
  });
  y += 7;

  doc.setTextColor(30, 30, 30); doc.setFont(undefined, 'normal');
  rows.forEach((r, idx) => {
    const vals = [r.date, r.client, r.site, r.adresse, r.agent, r.type, r.poste, r.statut, r.duree];
    const rowH = 6;
    if (idx % 2 === 0) { doc.setFillColor(245, 245, 245); cx = x; colWidths.forEach(w => { doc.rect(cx, y, w, rowH, 'F'); cx += w; }); }
    cx = x;
    vals.forEach((v, i) => {
      doc.text(String(v).substring(0, Math.floor(colWidths[i] / 1.7)), cx + 1.5, y + 4.2);
      cx += colWidths[i];
    });
    y += rowH;
    if (y > doc.internal.pageSize.getHeight() - 14) {
      doc.addPage(); y = 18;
      // reprint header
      doc.setFillColor(33, 33, 33); doc.setTextColor(255, 255, 255); doc.setFont(undefined, 'bold');
      cx = x;
      headers.forEach((h, i) => { doc.rect(cx, y, colWidths[i], 7, 'F'); doc.text(h, cx + 1.5, y + 4.8); cx += colWidths[i]; });
      y += 7;
      doc.setTextColor(30, 30, 30); doc.setFont(undefined, 'normal');
    }
  });

  doc.save(`missions_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
}