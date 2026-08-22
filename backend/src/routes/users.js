import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { isSuperAdmin } from '../lib/superadmin.js';
import { createAndSendInvitation, roleLabel } from '../lib/invitations.js';
import { getSmtpStatus, isEmailConfigured } from '../lib/email.js';

const router = Router();

function resolveInviteRole(role) {
  const r = String(role || 'user').toLowerCase();
  if (r === 'admin' || r === 'superadmin') return 'admin';
  if (r === 'client') return 'client';
  if (r === 'agent' || r === 'collaborateur') return 'user';
  return 'user';
}

// Remplace base44.users.inviteUser — envoie un email avec lien de création de compte
router.post('/invite', requireAuth, async (req, res) => {
  try {
    const { email, role = 'user' } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email requis' });
    }

    const superadmin = isSuperAdmin(req.user);
    if (!superadmin && !req.user.companyId) {
      return res.status(403).json({ error: 'Société requise' });
    }
    const companyId = req.body.company_id || req.user.companyId;
    const appRole = resolveInviteRole(role);
    const normalizedEmail = email.trim().toLowerCase();

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
      message = `Invitation créée, mais l'email n'a pas pu être envoyé (SMTP non configuré). Copiez le lien ci-dessous.`;
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
      // Toujours renvoyer le lien (utile si le mail n'arrive pas / spam)
      invite_url: inviteUrl,
      smtp_configured: isEmailConfigured(),
      message,
    });
  } catch (err) {
    console.error('Invite error:', err);
    res.status(500).json({ error: err.message || 'Invitation impossible' });
  }
});

router.get('/smtp-status', requireAuth, (req, res) => {
  if (!isSuperAdmin(req.user) && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  res.json(getSmtpStatus());
});

export default router;
