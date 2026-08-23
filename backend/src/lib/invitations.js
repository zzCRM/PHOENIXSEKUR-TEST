import { randomBytes } from 'crypto';
import { prisma } from './prisma.js';
import { getAppUrl, sendInvitationEmail } from './email.js';

const ROLE_LABELS = {
  admin: 'Administrateur société',
  user: 'Collaborateur',
  agent: 'Collaborateur',
  client: 'Client',
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

  let companyName = null;
  if (companyId) {
    try {
      const row = await prisma.companySettings.findFirst({
        where: { companyId },
        select: { data: true },
      });
      const data = row?.data && typeof row.data === 'object' ? row.data : {};
      companyName = data.company_name || data.companyName || null;
    } catch (err) {
      console.warn('[invite] Impossible de charger le nom de société:', err.message);
    }
  }

  const emailResult = await sendInvitationEmail({
    to: normalizedEmail,
    inviteUrl,
    invitedByEmail: invitedBy,
    roleLabel: roleLabel(role),
    companyName,
    role,
  });

  return {
    token,
    inviteUrl,
    emailSent: !!emailResult.sent,
    emailReason: emailResult.reason || null,
    emailError: emailResult.error || null,
  };
}

export async function resendInvitation(invitationId, invitedBy) {
  const invitation = await prisma.invitation.findUnique({ where: { id: invitationId } });
  if (!invitation) return null;
  if (invitation.acceptedAt) {
    throw new Error('Invitation déjà acceptée');
  }

  const token = randomBytes(32).toString('hex');
  const expiresAt = invitationExpiryDate();

  const updated = await prisma.invitation.update({
    where: { id: invitationId },
    data: { token, expiresAt, invitedBy: invitedBy || invitation.invitedBy },
  });

  const inviteUrl = `${getAppUrl()}/invitation/${token}`;

  let companyName = null;
  if (updated.companyId) {
    try {
      const row = await prisma.companySettings.findFirst({
        where: { companyId: updated.companyId },
        select: { data: true },
      });
      const data = row?.data && typeof row.data === 'object' ? row.data : {};
      companyName = data.company_name || data.companyName || null;
    } catch (err) {
      console.warn('[invite] Impossible de charger le nom de société (resend):', err.message);
    }
  }

  const emailResult = await sendInvitationEmail({
    to: updated.email,
    inviteUrl,
    invitedByEmail: updated.invitedBy,
    roleLabel: roleLabel(updated.role),
    companyName,
    role: updated.role,
  });

  return {
    invitation: updated,
    inviteUrl,
    emailSent: !!emailResult.sent,
    emailReason: emailResult.reason || null,
    emailError: emailResult.error || null,
  };
}

export async function getValidInvitation(token) {
  const invitation = await prisma.invitation.findUnique({ where: { token } });
  if (!invitation) return null;
  if (invitation.acceptedAt) return null;
  if (invitation.expiresAt < new Date()) return null;
  return invitation;
}
