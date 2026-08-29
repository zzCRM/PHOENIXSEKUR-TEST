import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { getPlatformSettings } from '../lib/platform-settings.js';
import { sendSignupNotifyEmail } from '../lib/email.js';

const router = Router();

// Inscription depuis le site vitrine (sans authentification)
router.post('/signup-request', async (req, res) => {
  try {
    const {
      email, company_name, first_name, last_name, phone, message,
    } = req.body;

    if (!email || !company_name) {
      return res.status(400).json({ error: 'Email et nom de société requis' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return res.status(409).json({ error: 'Un compte existe déjà avec cet email' });
    }

    const pending = await prisma.signupRequest.findFirst({
      where: { email: normalizedEmail, status: 'pending' },
    });
    if (pending) {
      return res.status(409).json({ error: 'Une demande est déjà en cours pour cet email' });
    }

    const settings = await getPlatformSettings();
    const trialDays = settings.default_trial_days ?? 14;

    const signup = await prisma.signupRequest.create({
      data: {
        email: normalizedEmail,
        companyName: company_name.trim(),
        firstName: first_name?.trim(),
        lastName: last_name?.trim(),
        phone: phone?.trim(),
        message: message?.trim(),
        trialDays,
      },
    });

    await sendSignupNotifyEmail({ signupRequest: signup }).catch(() => {});

    res.status(201).json({
      success: true,
      message: 'Demande reçue. Notre équipe vous contactera sous 24-48h.',
      trial_days: trialDays,
    });
  } catch (err) {
    console.error('Signup request error:', err);
    res.status(500).json({ error: 'Impossible d\'enregistrer la demande' });
  }
});

export default router;
