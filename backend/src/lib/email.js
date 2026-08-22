import nodemailer from 'nodemailer';
import { getPlatformSettings, renderTemplate } from './platform-settings.js';

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

export function isEmailConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function getAppUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const domain = process.env.DOMAIN || process.env.CORS_ORIGIN?.replace(/^https?:\/\//, '');
  if (domain) return `https://${domain.replace(/^https?:\/\//, '')}`;
  return 'http://localhost:5173';
}

function invitationVars({ inviteUrl, invitedByEmail, roleLabel, companyName }) {
  const invitedByLine = invitedByEmail
    ? `${invitedByEmail} vous invite à rejoindre Phoenix Sekur en tant que ${roleLabel}.`
    : `Vous êtes invité(e) à rejoindre Phoenix Sekur en tant que ${roleLabel}.`;

  return {
    invite_url: inviteUrl,
    role_label: roleLabel,
    invited_by: invitedByEmail || '',
    invited_by_line: invitedByLine,
    company_name: companyName || 'Phoenix Sekur',
  };
}

export async function sendInvitationEmail({ to, inviteUrl, invitedByEmail, roleLabel, companyName }) {
  const settings = await getPlatformSettings();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const vars = invitationVars({ inviteUrl, invitedByEmail, roleLabel, companyName });

  const subject = renderTemplate(settings.invitation_subject, vars);
  const text = renderTemplate(settings.invitation_body_text, vars);
  const html = renderTemplate(settings.invitation_body_html, vars);

  const transport = getTransporter();
  if (!transport) {
    console.log(`[email] SMTP non configuré — invitation pour ${to}: ${inviteUrl}`);
    return { sent: false, reason: 'smtp_not_configured' };
  }

  await transport.sendMail({ from, to, subject, text, html });
  console.log(`[email] Invitation envoyée à ${to}`);
  return { sent: true };
}

export async function sendSignupNotifyEmail({ signupRequest }) {
  const settings = await getPlatformSettings();
  const notifyList = (settings.signup_notify_emails || '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  if (notifyList.length === 0) return { sent: false, reason: 'no_notify_emails' };

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const appUrl = getAppUrl();
  const subject = `[Phoenix Sekur] Nouvelle demande d'inscription — ${signupRequest.companyName || signupRequest.email}`;
  const text = [
    'Nouvelle demande d\'inscription depuis le site vitrine :',
    '',
    `Société : ${signupRequest.companyName || '—'}`,
    `Contact : ${signupRequest.firstName || ''} ${signupRequest.lastName || ''}`.trim(),
    `Email : ${signupRequest.email}`,
    `Téléphone : ${signupRequest.phone || '—'}`,
    `Message : ${signupRequest.message || '—'}`,
    '',
    `Gérer dans Super Admin : ${appUrl}/super-admin`,
  ].join('\n');

  const transport = getTransporter();
  if (!transport) {
    console.log(`[email] Notification inscription (SMTP off) : ${signupRequest.email}`);
    return { sent: false, reason: 'smtp_not_configured' };
  }

  for (const to of notifyList) {
    await transport.sendMail({ from, to, subject, text });
  }
  return { sent: true };
}

export async function sendPasswordResetEmail({ to, resetUrl }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const subject = 'Réinitialisation de votre mot de passe — Phoenix Sekur';
  const text = [
    'Bonjour,',
    '',
    'Cliquez sur le lien ci-dessous pour choisir un nouveau mot de passe (valide 1 heure) :',
    resetUrl,
    '',
    '— L\'équipe Phoenix Sekur',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #c0392b;">Phoenix Sekur</h2>
      <p>Cliquez pour réinitialiser votre mot de passe :</p>
      <p><a href="${resetUrl}" style="background:#c0392b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">Nouveau mot de passe</a></p>
    </div>
  `;

  const transport = getTransporter();
  if (!transport) {
    console.log(`[email] Reset password pour ${to}: ${resetUrl}`);
    return { sent: false, reason: 'smtp_not_configured' };
  }

  await transport.sendMail({ from, to, subject, text, html });
  return { sent: true };
}
