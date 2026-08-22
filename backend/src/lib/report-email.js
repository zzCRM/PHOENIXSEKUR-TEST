import nodemailer from 'nodemailer';
import { isEmailConfigured, getAppUrl } from './email.js';

let transporter;

function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return transporter;
}

export async function sendReportEmail({ to, subject, text, html, pdfBase64, filename }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const mailer = getTransporter();

  if (!mailer) {
    console.log(`[email] Rapport (SMTP off) → ${to}: ${subject}`);
    return { sent: false, reason: 'smtp_not_configured' };
  }

  const attachments = pdfBase64 ? [{
    filename: filename || 'rapport-securite.pdf',
    content: Buffer.from(pdfBase64, 'base64'),
    contentType: 'application/pdf',
  }] : [];

  await mailer.sendMail({
    from,
    to,
    subject,
    text,
    html: html || text.replace(/\n/g, '<br>'),
    attachments,
  });

  return { sent: true };
}

export function buildReportSummaryText({ companyName, start, end, modules, stats }) {
  return [
    `Rapport de sécurité — ${companyName || 'Phoenix Sekur'}`,
    `Période : ${start} → ${end}`,
    '',
    'Résumé :',
    `- Rondes : ${stats.rondes ?? 0}`,
    `- Main courante : ${stats.main_courante ?? 0}`,
    `- Incidents : ${stats.incidents ?? 0}`,
    `- Missions : ${stats.planning ?? 0}`,
    '',
    `Modules : ${(modules || []).join(', ')}`,
    '',
    `Consultez l'application : ${getAppUrl()}`,
  ].join('\n');
}
