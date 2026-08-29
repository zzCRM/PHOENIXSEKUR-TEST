import { randomBytes } from 'crypto';
import { prisma } from './prisma.js';
import { getAppUrl, sendPasswordResetEmail } from './email.js';

export const PORTAL_ROLES = {
  entreprise: ['admin', 'superadmin'],
  collaborateur: ['user', 'agent'],
  client: ['client'],
};

export const PORTAL_LABELS = {
  entreprise: 'Société de sécurité',
  collaborateur: 'Salarié',
  client: 'Client',
};

export function roleMatchesPortal(user, portal) {
  if (!portal || !PORTAL_ROLES[portal]) return true;
  if (portal === 'entreprise' && user.role === 'superadmin') return true;
  if (portal === 'entreprise' && user.role === 'admin') return true;
  return PORTAL_ROLES[portal].includes(user.role);
}

export function portalMismatchMessage(portal) {
  const label = PORTAL_LABELS[portal] || portal;
  return `Ce compte n'est pas autorisé pour la connexion ${label}. Vérifiez le type de connexion choisi.`;
}

export async function createPasswordReset(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    return { sent: true, message: 'Si un compte existe, un email a été envoyé.' };
  }

  await prisma.passwordReset.updateMany({
    where: { email: normalizedEmail, usedAt: null, expiresAt: { gt: new Date() } },
    data: { expiresAt: new Date() },
  });

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 h

  await prisma.passwordReset.create({
    data: { token, email: normalizedEmail, expiresAt },
  });

  const vitrineUrl = process.env.VITRINE_URL || 'https://www.phoenixsekur.com';
  const resetUrl = `${vitrineUrl.replace(/\/$/, '')}/reinitialiser.html?token=${token}`;

  const emailResult = await sendPasswordResetEmail({ to: normalizedEmail, resetUrl });

  return {
    sent: emailResult.sent !== false,
    resetUrl: emailResult.sent ? undefined : resetUrl,
    message: 'Si un compte existe, un email de réinitialisation a été envoyé.',
  };
}

export async function getValidPasswordReset(token) {
  const row = await prisma.passwordReset.findUnique({ where: { token } });
  if (!row || row.usedAt || row.expiresAt < new Date()) return null;
  return row;
}
