import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

import { isSuperAdmin } from '../lib/superadmin.js';

// Remplace base44.users.inviteUser
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

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.json({
        success: true,
        message: 'Utilisateur déjà enregistré',
        email,
        temporary_password: null,
      });
    }

    // Mot de passe temporaire — l'utilisateur pourra le changer
    const temporaryPassword = randomBytes(4).toString('hex') + 'A1!';
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    await prisma.user.create({
      data: {
        email,
        passwordHash,
        companyId,
        role: appRole,
      },
    });

    // TODO Phase 5: envoi email d'invitation via SendGrid/SES
    console.log(`[invite] ${email} → mot de passe temporaire: ${temporaryPassword}`);

    res.json({
      success: true,
      email,
      role: appRole,
      temporary_password: temporaryPassword,
      message: 'Utilisateur créé. Communiquez-lui son mot de passe temporaire.',
    });
  } catch (err) {
    console.error('Invite error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
