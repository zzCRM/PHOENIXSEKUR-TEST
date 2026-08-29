import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { base44 } from '@/api/base44Client';
import { drawEntityHeader, drawLegalFooter } from '@/lib/pdfClientHeader';

export async function exportMainCourantePdf({
  entries = [],
  companyId,
  title = 'Main courante',
  subtitle = '',
  filename = 'main-courante.pdf',
  client = null,
}) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const headerBottom = await drawEntityHeader(doc, client, { x: 14, y: 14, pageW, maxLogoH: 14 });
  const titleY = headerBottom + 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(title, 14, titleY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (subtitle) doc.text(subtitle, 14, titleY + 6);
  doc.text(`Exporté le : ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr })}`, 14, subtitle ? titleY + 12 : titleY + 6);

  let y = subtitle ? titleY + 20 : titleY + 14;
  const rows = [...entries].sort((a, b) => `${a.date || ''} ${a.time || ''}`.localeCompare(`${b.date || ''} ${b.time || ''}`));
  rows.forEach((entry, i) => {
    if (y > 265) { doc.addPage(); y = 20; }
    const label = entry.event_label || entry.type || '';
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text(`${entry.date || ''} ${entry.time || ''} — [${label}] ${entry.site_name || ''}`, 14, y);
    doc.setFont(undefined, 'normal');
    const lines = doc.splitTextToSize(entry.content || '', 180);
    lines.forEach((line) => {
      if (y > 265) { doc.addPage(); y = 20; }
      y += 5;
      doc.text(line, 14, y);
    });
    if (entry.agent_name) {
      y += 5;
      doc.setTextColor(120);
      doc.text(`Agent : ${entry.agent_name}`, 14, y);
      doc.setTextColor(0);
    }
    y += 8;
    if (i < rows.length - 1) {
      doc.setDrawColor(220);
      doc.line(14, y - 2, 196, y - 2);
    }
  });

  const s = companyId ? await base44.entities.CompanySettings.filter({ company_id: companyId }) : [];
  drawLegalFooter(doc, s[0], { pageW, pageH: doc.internal.pageSize.getHeight() });
  doc.save(filename);
}
