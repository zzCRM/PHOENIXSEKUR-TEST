import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { drawEntityHeader, drawLegalFooter } from './pdfClientHeader';

/**
 * Génère le PDF d'une facture avec l'en-tête client (logo + adresse + email + tél).
 * @param {Object} invoice
 * @param {Object} client - entité Client liée
 */
export async function exportInvoicePdf(invoice, client, company) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;

  // En-tête client (logo + coordonnées)
  let y = await drawEntityHeader(doc, client, { x: margin, y: margin, pageW, maxLogoH: 16 });

  // Bloc facture (à droite)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59);
  doc.text('FACTURE', pageW - margin, margin + 6, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`N° ${invoice.invoice_number || ''}`, pageW - margin, margin + 12, { align: 'right' });
  if (invoice.date) doc.text(`Date : ${format(new Date(invoice.date), 'dd/MM/yyyy', { locale: fr })}`, pageW - margin, margin + 17, { align: 'right' });
  if (invoice.due_date) doc.text(`Échéance : ${format(new Date(invoice.due_date), 'dd/MM/yyyy', { locale: fr })}`, pageW - margin, margin + 22, { align: 'right' });

  y = Math.max(y, margin + 28) + 6;

  // Tableau des lignes
  const colX = { desc: margin, qty: margin + 115, pu: margin + 140, tot: pageW - margin };
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, y, pageW - margin * 2, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Description', colX.desc + 2, y + 5.5);
  doc.text('Qté', colX.qty, y + 5.5, { align: 'center' });
  doc.text('P.U. HT', colX.pu, y + 5.5, { align: 'center' });
  doc.text('Total HT', colX.tot - 2, y + 5.5, { align: 'right' });
  y += 8;

  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'normal');
  (invoice.items || []).forEach((it, i) => {
    if (y > pageH - 45) { doc.addPage(); y = margin; }
    if (i % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(margin, y, pageW - margin * 2, 7, 'F'); }
    doc.setFontSize(8);
    doc.text(doc.splitTextToSize(it.description || '', 105), colX.desc + 2, y + 5);
    doc.text(String(it.quantity ?? ''), colX.qty, y + 5, { align: 'center' });
    doc.text(`${(it.unit_price || 0).toFixed(2)} €`, colX.pu, y + 5, { align: 'center' });
    doc.text(`${(it.total || 0).toFixed(2)} €`, colX.tot - 2, y + 5, { align: 'right' });
    y += 7;
  });

  // Totaux
  y += 4;
  const labelX = pageW - margin - 50;
  const totalHT = invoice.total_ht || 0;
  const totalTVA = invoice.total_tva || 0;
  const totalTTC = invoice.total_ttc || 0;
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('Total HT', labelX, y); doc.text(`${totalHT.toFixed(2)} €`, pageW - margin - 2, y, { align: 'right' }); y += 6;
  doc.text(`TVA (${invoice.tva_rate || 0}%)`, labelX, y); doc.text(`${totalTVA.toFixed(2)} €`, pageW - margin - 2, y, { align: 'right' }); y += 6;
  doc.setFillColor(30, 41, 59);
  doc.rect(labelX - 2, y - 4, pageW - margin - labelX, 9, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('Total TTC', labelX, y + 1.5); doc.text(`${totalTTC.toFixed(2)} €`, pageW - margin - 2, y + 1.5, { align: 'right' });

  if (invoice.notes) {
    y += 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Notes :', margin, y);
    doc.text(doc.splitTextToSize(invoice.notes, pageW - margin * 2), margin, y + 4);
  }

  // Pied de page
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Facture ${invoice.invoice_number || ''} — page ${p}/${totalPages}`, pageW / 2, pageH - 6, { align: 'center' });
  }

  drawLegalFooter(doc, company, { pageW, pageH });

  doc.save(`facture-${invoice.invoice_number || 'export'}.pdf`);
}