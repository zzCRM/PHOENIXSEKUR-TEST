import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { isSuperAdmin } from '../lib/superadmin.js';
import { createAndSendInvitation, resendInvitation, roleLabel } from '../lib/invitations.js';
import { getSmtpStatus, isEmailConfigured } from '../lib/email.js';
import {
  getPlatformEmails,
  isPlatformCompanyId,
  isPlatformUser,
} from '../lib/tenant.js';

const router = Router();

function resolveInviteRole(role) {
  const r = String(role || 'user').toLowerCase();
  if (r === 'admin' || r === 'superadmin') return 'admin';
  if (r === 'client') return 'client';
  if (r === 'agent' || r === 'collaborateur' || r === 'user') return 'user';
  return 'user';
}

function requireCompanyAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
  if (isSuperAdmin(req.user) || req.user.role === 'admin') return next();
  return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
}

/** Société cible : un admin société ne peut jamais cibler une autre société. */
function resolveCompanyIdForAdmin(req, { allowBody = false } = {}) {
  if (isSuperAdmin(req.user)) {
    const fromReq = allowBody
      ? (req.body?.company_id || req.query?.company_id)
      : (req.query?.company_id || req.body?.company_id);
    return fromReq || null;
  }
  return req.user.companyId || null;
}

router.get('/smtp-status', requireAuth, requireCompanyAdmin, (_req, res) => {
  res.json(getSmtpStatus());
});

// Liste comptes + invitations (portail entreprise) — strictement la société connectée
router.get('/', requireAuth, requireCompanyAdmin, async (req, res) => {
  try {
    const companyId = resolveCompanyIdForAdmin(req);
    if (!companyId || isPlatformCompanyId(companyId)) {
      if (isSuperAdmin(req.user) && !companyId) {
        return res.status(400).json({
          error: 'Indiquez company_id pour lister une société (Super Admin)',
        });
      }
      return res.status(403).json({ error: 'Société requise' });
    }

    const platformEmails = getPlatformEmails();
    const whereUser = {
      companyId,
      role: { not: 'superadmin' },
      ...(platformEmails.length
        ? { email: { notIn: platformEmails } }
        : {}),
    };
    const whereInvite = {
      acceptedAt: null,
      companyId,
      role: { not: 'superadmin' },
      ...(platformEmails.length
        ? { email: { notIn: platformEmails } }
        : {}),
    };

    const [users, invitations] = await Promise.all([
      prisma.user.findMany({
        where: whereUser,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          role: true,
          companyId: true,
          firstName: true,
          lastName: true,
          isActive: true,
          createdAt: true,
        },
      }),
      prisma.invitation.findMany({
        where: whereInvite,
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    res.json({
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        role_label: roleLabel(u.role),
        company_id: u.companyId,
        first_name: u.firstName,
        last_name: u.lastName,
        is_active: u.isActive,
        status: u.isActive ? 'actif' : 'inactif',
        created_at: u.createdAt,
        type: 'user',
      })),
      invitations: invitations.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        role_label: roleLabel(i.role),
        company_id: i.companyId,
        invited_by: i.invitedBy,
        expires_at: i.expiresAt,
        expired: i.expiresAt < new Date(),
        status: i.expiresAt < new Date() ? 'expirée' : 'en_attente',
        created_at: i.createdAt,
        type: 'invitation',
      })),
      smtp: getSmtpStatus(),
    });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: err.message || 'Impossible de lister les utilisateurs' });
  }
});

router.post('/invite', requireAuth, requireCompanyAdmin, async (req, res) => {
  try {
    const { email, role = 'user' } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requis' });

    const superadmin = isSuperAdmin(req.user);
    const companyId = resolveCompanyIdForAdmin(req, { allowBody: true });

    if (!superadmin && !companyId) {
      return res.status(403).json({ error: 'Société requise' });
    }
    if (!superadmin && req.body.company_id && req.body.company_id !== req.user.companyId) {
      return res.status(403).json({ error: 'Impossible d\'inviter hors de votre société' });
    }
    if (!companyId || isPlatformCompanyId(companyId)) {
      return res.status(400).json({
        error: superadmin
          ? 'Indiquez company_id (société cliente) pour inviter'
          : 'Société requise',
      });
    }

    const appRole = resolveInviteRole(role);

    // Une société de sécurité invite uniquement collaborateurs ou clients (pas d'admin)
    if (!superadmin && appRole === 'admin') {
      return res.status(400).json({
        error: 'Impossible d\'inviter un administrateur. Choisissez collaborateur ou client.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (getPlatformEmails().includes(normalizedEmail)) {
      return res.status(400).json({ error: 'Cet email est réservé à la plateforme' });
    }

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return res.json({
        success: true,
        message: 'Un compte existe déjà pour cet email — aucune invitation envoyée',
        email: normalizedEmail,
        email_sent: false,
        already_registered: true,
      });
    }

    const { inviteUrl, emailSent, emailReason, emailError } = await createAndSendInvitation({
      email: normalizedEmail,
      role: appRole,
      companyId,
      invitedBy: req.user.email,
    });

    let message;
    if (emailSent) {
      message = `Invitation envoyée par email à ${normalizedEmail}`;
    } else if (emailReason === 'smtp_not_configured') {
      message = `Invitation créée, mais l'email n'a pas pu être envoyé (SMTP non chargé sur le serveur). Copiez le lien ci-dessous.`;
    } else if (emailReason === 'smtp_error') {
      message = `Invitation créée, mais l'envoi email a échoué : ${emailError || 'erreur SMTP'}. Copiez le lien ci-dessous.`;
    } else {
      message = `Invitation créée pour ${normalizedEmail}. Transmettez le lien manuellement.`;
    }

    res.json({
      success: true,
      email: normalizedEmail,
      role: appRole,
      role_label: roleLabel(appRole),
      email_sent: emailSent,
      email_reason: emailReason || null,
      email_error: emailError || null,
      invite_url: inviteUrl,
      smtp_configured: isEmailConfigured(),
      message,
    });
  } catch (err) {
    console.error('Invite error:', err);
    res.status(500).json({ error: err.message || 'Invitation impossible' });
  }
});

router.post('/invitations/:id/resend', requireAuth, requireCompanyAdmin, async (req, res) => {
  try {
    const invitation = await prisma.invitation.findUnique({ where: { id: req.params.id } });
    if (!invitation) return res.status(404).json({ error: 'Invitation introuvable' });
    if (!isSuperAdmin(req.user) && invitation.companyId !== req.user.companyId) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const result = await resendInvitation(invitation.id, req.user.email);
    res.json({
      success: true,
      email_sent: result.emailSent,
      email_reason: result.emailReason || null,
      email_error: result.emailError || null,
      invite_url: result.inviteUrl,
      smtp_configured: isEmailConfigured(),
      message: result.emailSent
        ? 'Invitation renvoyée par email'
        : `Email non envoyé (${result.emailReason || 'smtp'}). Copiez le lien.`,
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Renvoi impossible' });
  }
});

router.delete('/invitations/:id', requireAuth, requireCompanyAdmin, async (req, res) => {
  try {
    const invitation = await prisma.invitation.findUnique({ where: { id: req.params.id } });
    if (!invitation) return res.status(404).json({ error: 'Invitation introuvable' });
    if (!isSuperAdmin(req.user) && invitation.companyId !== req.user.companyId) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    await prisma.invitation.delete({ where: { id: invitation.id } });
    res.json({ success: true, deleted: invitation.email });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Suppression impossible' });
  }
});

router.patch('/:id', requireAuth, requireCompanyAdmin, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (!isSuperAdmin(req.user) && user.companyId !== req.user.companyId) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    if (isPlatformUser(user) && !isSuperAdmin(req.user)) {
      return res.status(403).json({ error: 'Compte plateforme — non modifiable' });
    }

    const data = {};
    if (typeof req.body.is_active === 'boolean') data.isActive = req.body.is_active;
    if (req.body.role) data.role = resolveInviteRole(req.body.role);

    const updated = await prisma.user.update({ where: { id: user.id }, data });
    res.json({
      id: updated.id,
      email: updated.email,
      role: updated.role,
      is_active: updated.isActive,
      status: updated.isActive ? 'actif' : 'inactif',
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Mise à jour impossible' });
  }
});

router.delete('/:id', requireAuth, requireCompanyAdmin, async (req, res) => {
  try {
    if (req.params.id === req.user.sub) {
      return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (!isSuperAdmin(req.user) && user.companyId !== req.user.companyId) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    if (isPlatformUser(user) && !isSuperAdmin(req.user)) {
      return res.status(403).json({ error: 'Impossible de supprimer un compte plateforme' });
    }

    await prisma.user.delete({ where: { id: user.id } });
    res.json({ success: true, deleted: user.email });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Suppression impossible' });
  }
});

export default router;
