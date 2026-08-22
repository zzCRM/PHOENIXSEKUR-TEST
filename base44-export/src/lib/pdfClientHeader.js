/**
 * Helper partagé pour dessiner un bloc d'identité (logo + nom + adresse + email + tél
 * + mentions légales : SIRET, SIREN, TVA, forme juridique, n° d'autorisation CNAPS, RC Pro)
 * sur un document jsPDF. Utilisable pour un Client ou pour CompanySettings (même forme).
 *
 * entity shape: { logo_url?, company_name?, address?, postal_code?, city?, email?, phone?,
 *   siret?, siren?, tva_number?, legal_form?, cnaps_number?, insurance_number? }
 * @returns {Promise<number>} nouvelle position y après le bloc
 */
async function loadImageDataUrl(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    let format = 'JPEG';
    if (blob.type.includes('png')) format = 'PNG';
    else if (blob.type.includes('webp')) format = 'WEBP';
    return { dataUrl, format };
  } catch {
    return null;
  }
}

export async function drawEntityHeader(doc, entity, opts = {}) {
  const { x = 14, y = 14, pageW, maxLogoH = 16, align = 'left', includeLegal = true } = opts;
  if (!entity) return y;

  const img = await loadImageDataUrl(entity.logo_url);
  let textX = x;
  let blockBottom = y;
  let logoW = 0;

  if (img) {
    const logoH = maxLogoH;
    logoW = maxLogoH * 3;
    let logoX = x;
    if (align === 'right') logoX = (pageW || 210) - x - logoW;
    try {
      doc.addImage(img.dataUrl, img.format, logoX, y, logoW, logoH);
      textX = align === 'right' ? logoX - 4 : x + logoW + 4;
      blockBottom = y + logoH;
    } catch {
      /* ignore image errors */
    }
  }

  const nameX = align === 'right' ? (pageW || 210) - x : textX;
  const nameAlign = align === 'right' ? 'right' : 'left';

  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(entity.company_name || '', nameX, y + 4, { align: nameAlign });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);

  let ty = y + 9;
  const addrParts = [
    entity.address,
    [entity.postal_code, entity.city].filter(Boolean).join(' '),
  ].filter(Boolean);
  if (addrParts.length) {
    doc.text(addrParts.join(', '), nameX, ty, { align: nameAlign });
    ty += 4;
  }
  if (entity.email) {
    doc.text(`Email : ${entity.email}`, nameX, ty, { align: nameAlign });
    ty += 4;
  }
  if (entity.phone) {
    doc.text(`Tél : ${entity.phone}`, nameX, ty, { align: nameAlign });
    ty += 4;
  }

  // Mentions légales complètes
  if (includeLegal) {
    const legal = [];
    if (entity.siret) legal.push(`SIRET : ${entity.siret}`);
    if (entity.siren) legal.push(`SIREN : ${entity.siren}`);
    if (entity.tva_number) legal.push(`TVA : ${entity.tva_number}`);
    if (entity.legal_form) legal.push(entity.legal_form);
    if (entity.cnaps_number) legal.push(`N° autorisation CNAPS : ${entity.cnaps_number}`);
    if (entity.insurance_number) legal.push(`RC Pro : ${entity.insurance_number}`);
    if (legal.length) {
      const maxW = align === 'right' ? (nameX - x) : ((pageW || 210) - nameX - x);
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      const wrapped = doc.splitTextToSize(legal.join('   •   '), maxW);
      wrapped.forEach((l) => {
        doc.text(l, nameX, ty, { align: nameAlign });
        ty += 3.2;
      });
      blockBottom = Math.max(blockBottom, ty);
    }
  }

  blockBottom = Math.max(blockBottom, ty);
  return blockBottom + 2;
}

/**
 * Pied de page légal complet (SIRET, TVA, n° d'autorisation CNAPS, RC Pro, adresse…)
 * dessiné sur toutes les pages du document.
 */
export function drawLegalFooter(doc, entity, opts = {}) {
  if (!entity) return;
  const { pageW, pageH, margin = 12, baseY } = opts;
  const parts = [];
  if (entity.company_name) parts.push(entity.company_name);
  if (entity.legal_form) parts.push(entity.legal_form);
  if (entity.siret) parts.push(`SIRET ${entity.siret}`);
  if (entity.tva_number) parts.push(`TVA ${entity.tva_number}`);
  if (entity.cnaps_number) parts.push(`N° autorisation CNAPS ${entity.cnaps_number}`);
  if (entity.insurance_number) parts.push(`RC Pro n° ${entity.insurance_number}`);
  const addr = [entity.address, [entity.postal_code, entity.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  if (addr) parts.push(addr);
  if (entity.phone) parts.push(`Tél ${entity.phone}`);
  if (entity.email) parts.push(entity.email);
  const line = parts.join('   •   ');

  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    const lines = doc.splitTextToSize(line, (pageW || 210) - margin * 2);
    const bottomY = baseY || ((pageH || 297) - 9);
    let yy = bottomY - (lines.length - 1) * 3.2;
    lines.forEach((l) => {
      doc.text(l, (pageW || 210) / 2, yy, { align: 'center' });
      yy += 3.2;
    });
  }
}