import nodemailer from 'nodemailer';
import { getAppUrl } from './email.js';
import { getPlatformSettings, getEmailTemplate, renderTemplate } from './platform-settings.js';

let transporter;

function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST || process.env.SMTP_SERVER;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER || process.env.SMTP_USERNAME;
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
  if (!host || !user || !pass) return null;
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user, pass },
    tls: { minVersion: 'TLSv1.2' },
  });
  return transporter;
}

export async function sendReportEmail({
  to, subject, text, html, pdfBase64, filename,
  companyName, start, end, modules, stats,
}) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const mailer = getTransporter();

  if (!mailer) {
    console.log(`[email] Rapport (SMTP off) → ${to}: ${subject}`);
    return { sent: false, reason: 'smtp_not_configured' };
  }

  const settings = await getPlatformSettings();
  const tpl = getEmailTemplate(settings, 'report_client');
  const statsSummary = [
    `Rondes : ${stats?.rondes ?? 0}`,
    `Main courante : ${stats?.main_courante ?? 0}`,
    `Incidents : ${stats?.incidents ?? 0}`,
    `Missions : ${stats?.planning ?? 0}`,
  ].join('\n');
  const vars = {
    company_name: companyName || 'Phoenix Sekur',
    period_start: start || '',
    period_end: end || '',
    modules: (modules || []).join(', '),
    stats_summary: statsSummary,
    app_url: getAppUrl(),
  };

  const finalSubject = subject || renderTemplate(tpl.subject, vars);
  const finalText = text || renderTemplate(tpl.body_text, vars);
  const finalHtml = html || renderTemplate(tpl.body_html, vars);

  const attachments = pdfBase64 ? [{
    filename: filename || 'rapport-securite.pdf',
    content: Buffer.from(pdfBase64, 'base64'),
    contentType: 'application/pdf',
  }] : [];

  await mailer.sendMail({
    from,
    to,
    subject: finalSubject,
    text: finalText,
    html: finalHtml || String(finalText || '').replace(/\n/g, '<br>'),
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
