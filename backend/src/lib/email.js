import nodemailer from 'nodemailer';

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

export async function sendInvitationEmail({ to, inviteUrl, invitedByEmail, roleLabel }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const subject = 'Invitation à rejoindre Phoenix Sekur';

  const text = [
    'Bonjour,',
    '',
    invitedByEmail
      ? `${invitedByEmail} vous invite à rejoindre Phoenix Sekur en tant que ${roleLabel}.`
      : `Vous êtes invité(e) à rejoindre Phoenix Sekur en tant que ${roleLabel}.`,
    '',
    'Cliquez sur le lien ci-dessous pour créer votre compte et choisir votre mot de passe :',
    inviteUrl,
    '',
    'Ce lien expire dans 7 jours.',
    '',
    'Si vous n\'êtes pas à l\'origine de cette demande, ignorez cet email.',
    '',
    '— L\'équipe Phoenix Sekur',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111;">
      <h2 style="color: #c0392b;">Phoenix Sekur</h2>
      <p>Bonjour,</p>
      <p>${
        invitedByEmail
          ? `<strong>${invitedByEmail}</strong> vous invite à rejoindre Phoenix Sekur en tant que <strong>${roleLabel}</strong>.`
          : `Vous êtes invité(e) à rejoindre Phoenix Sekur en tant que <strong>${roleLabel}</strong>.`
      }</p>
      <p>Cliquez sur le bouton ci-dessous pour créer votre compte :</p>
      <p style="margin: 28px 0;">
        <a href="${inviteUrl}" style="background:#c0392b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">
          Créer mon compte
        </a>
      </p>
      <p style="font-size: 13px; color: #666;">Ou copiez ce lien :<br><a href="${inviteUrl}">${inviteUrl}</a></p>
      <p style="font-size: 13px; color: #666;">Ce lien expire dans 7 jours.</p>
    </div>
  `;

  const transport = getTransporter();
  if (!transport) {
    console.log(`[email] SMTP non configuré — invitation pour ${to}: ${inviteUrl}`);
    return { sent: false, reason: 'smtp_not_configured' };
  }

  await transport.sendMail({ from, to, subject, text, html });
  console.log(`[email] Invitation envoyée à ${to}`);
  return { sent: true };
}
