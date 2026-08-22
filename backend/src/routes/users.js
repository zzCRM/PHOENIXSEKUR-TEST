import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { isSuperAdmin } from '../lib/superadmin.js';
import { createAndSendInvitation, roleLabel } from '../lib/invitations.js';

const router = Router();

// Remplace base44.users.inviteUser — envoie un email avec lien de création de compte
router.post('/invite', requireAuth, async (req, res) => {
  try {
    const { email, role = 'user' } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const superadmin = isSuperAdmin(req.user);
    if (!superadmin && !req.user.companyId) {
      return res.status(403).json({ error: 'Company required' });
    }
    const companyId = req.body.company_id || req.user.companyId;
    const appRole = role === 'admin' ? 'admin' : 'user';
    const normalizedEmail = email.trim().toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return res.json({
        success: true,
        message: 'Utilisateur déjà enregistré',
        email: normalizedEmail,
        email_sent: false,
        temporary_password: null,
      });
    }

    const { inviteUrl, emailSent, emailReason } = await createAndSendInvitation({
      email: normalizedEmail,
      role: appRole,
      companyId,
      invitedBy: req.user.email,
    });

    const message = emailSent
      ? `Invitation envoyée par email à ${normalizedEmail}`
      : `Invitation créée pour ${normalizedEmail}. Configurez SMTP pour l'envoi automatique (lien dans les logs serveur).`;

    res.json({
      success: true,
      email: normalizedEmail,
      role: appRole,
      role_label: roleLabel(appRole),
      email_sent: emailSent,
      invite_url: emailSent ? undefined : inviteUrl,
      email_reason: emailReason,
      message,
    });
  } catch (err) {
    console.error('Invite error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
