import nodemailer from 'nodemailer';
import {
  getPlatformSettings,
  renderTemplate,
  getEmailTemplate,
  invitationTemplateIdForRole,
} from './platform-settings.js';

let transporter;
let transporterKey = '';

function smtpConfig() {
  const host = process.env.SMTP_HOST || process.env.SMTP_SERVER || '';
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER || process.env.SMTP_USERNAME || '';
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '';
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || user;
  return { host, port, user, pass, from };
}

function getTransporter() {
  const { host, port, user, pass } = smtpConfig();
  if (!host || !user || !pass) return null;

  const key = `${host}:${port}:${user}:${pass.length}`;
  if (transporter && transporterKey === key) return transporter;

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user, pass },
    tls: { minVersion: 'TLSv1.2' },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
  transporterKey = key;
  return transporter;
}

export function isEmailConfigured() {
  const { host, user, pass } = smtpConfig();
  return !!(host && user && pass);
}

export function getSmtpStatus() {
  const { host, port, user, from } = smtpConfig();
  return {
    configured: isEmailConfigured(),
    host: host || null,
    port,
    user: user || null,
    from: from || null,
  };
}

export function getAppUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const domain = process.env.DOMAIN || process.env.CORS_ORIGIN?.replace(/^https?:\/\//, '');
  if (domain) return `https://${domain.replace(/^https?:\/\//, '')}`;
  return 'http://localhost:5173';
}

function invitationVars({ inviteUrl, invitedByEmail, roleLabel, companyName }) {
  const company = companyName || 'Phoenix Sekur';
  const invitedByLine = invitedByEmail
    ? `${invitedByEmail} vous invite à rejoindre ${company} sur Phoenix Sekur en tant que ${roleLabel}.`
    : `Vous êtes invité(e) à rejoindre ${company} sur Phoenix Sekur en tant que ${roleLabel}.`;

  return {
    invite_url: inviteUrl,
    role_label: roleLabel,
    invited_by: invitedByEmail || '',
    invited_by_line: invitedByLine,
    company_name: company,
  };
}

export async function sendInvitationEmail({
  to, inviteUrl, invitedByEmail, roleLabel, companyName, role,
}) {
  const settings = await getPlatformSettings();
  const { from, user } = smtpConfig();
  const vars = invitationVars({ inviteUrl, invitedByEmail, roleLabel, companyName });
  const templateId = invitationTemplateIdForRole(role);
  const tpl = getEmailTemplate(settings, templateId);

  const subject = renderTemplate(tpl.subject, vars);
  const text = renderTemplate(tpl.body_text, vars);
  const html = renderTemplate(tpl.body_html, vars);

  const transport = getTransporter();
  if (!transport) {
    console.error(`[email] SMTP non configuré — invitation ${to}: ${inviteUrl}`);
    return { sent: false, reason: 'smtp_not_configured', inviteUrl };
  }

  try {
    const info = await transport.sendMail({
      from: from || user,
      to,
      subject,
      text,
      html,
    });
    console.log(`[email] Invitation envoyée à ${to} (id=${info.messageId})`);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[email] Échec envoi invitation à ${to}:`, err.message);
    transporter = null;
    transporterKey = '';
    return {
      sent: false,
      reason: 'smtp_error',
      error: err.message,
      inviteUrl,
    };
  }
}

export async function sendSignupNotifyEmail({ signupRequest }) {
  const settings = await getPlatformSettings();
  const notifyList = (settings.signup_notify_emails || '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  if (notifyList.length === 0) return { sent: false, reason: 'no_notify_emails' };

  const { from, user } = smtpConfig();
  const appUrl = getAppUrl();
  const vars = {
    company_name: signupRequest.companyName || signupRequest.email || '—',
    contact_name: `${signupRequest.firstName || ''} ${signupRequest.lastName || ''}`.trim() || '—',
    email: signupRequest.email || '—',
    phone: signupRequest.phone || '—',
    message: signupRequest.message || '—',
    admin_url: `${appUrl}/super-admin`,
  };
  const tpl = getEmailTemplate(settings, 'signup_notify');
  const subject = renderTemplate(tpl.subject, vars);
  const text = renderTemplate(tpl.body_text, vars);
  const html = renderTemplate(tpl.body_html, vars);

  const transport = getTransporter();
  if (!transport) {
    console.log(`[email] Notification inscription (SMTP off) : ${signupRequest.email}`);
    return { sent: false, reason: 'smtp_not_configured' };
  }

  try {
    for (const to of notifyList) {
      await transport.sendMail({ from: from || user, to, subject, text, html });
    }
    return { sent: true };
  } catch (err) {
    console.error('[email] Signup notify failed:', err.message);
    transporter = null;
    transporterKey = '';
    return { sent: false, reason: 'smtp_error', error: err.message };
  }
}

export async function sendPasswordResetEmail({ to, resetUrl }) {
  const settings = await getPlatformSettings();
  const { from, user } = smtpConfig();
  const vars = { reset_url: resetUrl, company_name: 'Phoenix Sekur' };
  const tpl = getEmailTemplate(settings, 'password_reset');
  const subject = renderTemplate(tpl.subject, vars);
  const text = renderTemplate(tpl.body_text, vars);
  const html = renderTemplate(tpl.body_html, vars);

  const transport = getTransporter();
  if (!transport) {
    console.log(`[email] Reset password pour ${to}: ${resetUrl}`);
    return { sent: false, reason: 'smtp_not_configured', resetUrl };
  }

  try {
    await transport.sendMail({ from: from || user, to, subject, text, html });
    return { sent: true };
  } catch (err) {
    console.error(`[email] Reset failed for ${to}:`, err.message);
    transporter = null;
    transporterKey = '';
    return { sent: false, reason: 'smtp_error', error: err.message, resetUrl };
  }
}
