import { randomBytes } from 'crypto';
import { prisma } from './prisma.js';
import { getAppUrl, sendInvitationEmail } from './email.js';

const ROLE_LABELS = {
  admin: 'Administrateur',
  user: 'Agent / Collaborateur',
  superadmin: 'Super Administrateur',
};

export function invitationExpiryDate(days = 7) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export function roleLabel(role) {
  return ROLE_LABELS[role] || role;
}

export async function createAndSendInvitation({
  email,
  role,
  companyId,
  invitedBy,
}) {
  const normalizedEmail = email.trim().toLowerCase();
  const token = randomBytes(32).toString('hex');
  const expiresAt = invitationExpiryDate();

  await prisma.invitation.updateMany({
    where: {
      email: normalizedEmail,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { expiresAt: new Date() },
  });

  await prisma.invitation.create({
    data: {
      token,
      email: normalizedEmail,
      role,
      companyId,
      invitedBy: invitedBy || null,
      expiresAt,
    },
  });

  const inviteUrl = `${getAppUrl()}/invitation/${token}`;
  const emailResult = await sendInvitationEmail({
    to: normalizedEmail,
    inviteUrl,
    invitedByEmail: invitedBy,
    roleLabel: roleLabel(role),
  });

  return {
    token,
    inviteUrl,
    emailSent: emailResult.sent,
    emailReason: emailResult.reason,
  };
}

export async function getValidInvitation(token) {
  const invitation = await prisma.invitation.findUnique({ where: { token } });
  if (!invitation) return null;
  if (invitation.acceptedAt) return null;
  if (invitation.expiresAt < new Date()) return null;
  return invitation;
}
