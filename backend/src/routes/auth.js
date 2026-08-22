import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { isSuperAdmin } from '../lib/superadmin.js';
import { isCompanyAccessAllowed } from '../lib/platform-settings.js';
import { getValidInvitation, roleLabel } from '../lib/invitations.js';
import { getAppRedirectUrl } from '../lib/role-redirect.js';
import { setAuthCookie, clearAuthCookie } from '../lib/auth-cookie.js';
import {
  roleMatchesPortal, portalMismatchMessage, createPasswordReset, getValidPasswordReset,
} from '../lib/password-reset.js';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password, portal } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    if (portal && !roleMatchesPortal(user, portal)) {
      return res.status(403).json({ error: portalMismatchMessage(portal) });
    }

    if (!isSuperAdmin({ email: user.email, role: user.role })) {
      const companyOk = await isCompanyAccessAllowed(user.companyId);
      if (!companyOk) {
        return res.status(403).json({
          error: 'Accès suspendu — contactez le support (impayé ou essai expiré)',
        });
      }
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    const token = signToken(user);
    const superadmin = isSuperAdmin({ email: user.email, role: user.role });
    setAuthCookie(res, token);
    res.json({
      access_token: token,
      redirect: getAppRedirectUrl(user),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        company_id: user.companyId,
        first_name: user.firstName,
        last_name: user.lastName,
        superadmin,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Connexion impossible' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requis' });
    const result = await createPasswordReset(email);
    res.json({
      success: true,
      message: result.message,
      reset_url: result.resetUrl,
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Impossible d\'envoyer l\'email' });
  }
});

router.get('/reset-password/:token', async (req, res) => {
  const reset = await getValidPasswordReset(req.params.token);
  if (!reset) return res.status(404).json({ error: 'Lien expiré ou invalide' });
  res.json({ email: reset.email, valid: true });
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Token et mot de passe requis' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
    }

    const reset = await getValidPasswordReset(token);
    if (!reset) return res.status(404).json({ error: 'Lien expiré ou invalide' });

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { email: reset.email },
      data: { passwordHash },
    });
    await prisma.passwordReset.update({
      where: { id: reset.id },
      data: { usedAt: new Date() },
    });

    res.json({ success: true, message: 'Mot de passe mis à jour. Vous pouvez vous connecter.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Réinitialisation impossible' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const superadmin = isSuperAdmin({ email: user.email, role: user.role });

  res.json({
    id: user.id,
    email: user.email,
    role: user.role,
    company_id: user.companyId,
    first_name: user.firstName,
    last_name: user.lastName,
    superadmin,
  });
});

router.get('/invitation/:token', async (req, res) => {
  try {
    const invitation = await getValidInvitation(req.params.token);
    if (!invitation) {
      return res.status(404).json({ error: 'Invitation invalide ou expirée' });
    }

    const existing = await prisma.user.findUnique({ where: { email: invitation.email } });
    if (existing) {
      return res.status(409).json({ error: 'Un compte existe déjà pour cet email' });
    }

    res.json({
      email: invitation.email,
      role: invitation.role,
      role_label: roleLabel(invitation.role),
      expires_at: invitation.expiresAt,
    });
  } catch (err) {
    console.error('Invitation lookup error:', err);
    res.status(500).json({ error: 'Impossible de vérifier l\'invitation' });
  }
});

router.post('/accept-invitation', async (req, res) => {
  try {
    const { token, password, first_name, last_name } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Token et mot de passe requis' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
    }

    const invitation = await getValidInvitation(token);
    if (!invitation) {
      return res.status(404).json({ error: 'Invitation invalide ou expirée' });
    }

    const existing = await prisma.user.findUnique({ where: { email: invitation.email } });
    if (existing) {
      return res.status(409).json({ error: 'Un compte existe déjà pour cet email' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email: invitation.email,
        passwordHash,
        companyId: invitation.companyId,
        role: invitation.role,
        firstName: first_name || invitation.email.split('@')[0],
        lastName: last_name || '',
      },
    });

    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });

    const accessToken = signToken(user);
    const superadmin = isSuperAdmin({ email: user.email, role: user.role });
    setAuthCookie(res, accessToken);

    res.status(201).json({
      access_token: accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        company_id: user.companyId,
        first_name: user.firstName,
        last_name: user.lastName,
        superadmin,
      },
    });
  } catch (err) {
    console.error('Accept invitation error:', err);
    res.status(500).json({ error: 'Création du compte impossible' });
  }
});

router.get('/session', async (req, res) => {
  if (!req.user) {
    return res.json({ authenticated: false });
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!user || !user.isActive) {
      clearAuthCookie(res);
      return res.json({ authenticated: false });
    }
    if (!isSuperAdmin({ email: user.email, role: user.role })) {
      const companyOk = await isCompanyAccessAllowed(user.companyId);
      if (!companyOk) {
        return res.json({ authenticated: false, reason: 'suspended' });
      }
    }
    const superadmin = isSuperAdmin({ email: user.email, role: user.role });
    const accessToken = signToken(user);
    res.json({
      authenticated: true,
      access_token: accessToken,
      redirect: getAppRedirectUrl(user),
      user: { email: user.email, superadmin, role: user.role },
    });
  } catch {
    res.json({ authenticated: false });
  }
});

router.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ success: true });
});

router.post('/register', async (req, res) => {
  try {
    const { email, password, company_id, role = 'admin', first_name, last_name } = req.body;
    if (!email || !password || !company_id) {
      return res.status(400).json({ error: 'email, password, company_id required' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        companyId: company_id,
        role,
        firstName: first_name,
        lastName: last_name,
      },
    });

    const token = signToken(user);
    res.status(201).json({
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        company_id: user.companyId,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

export default router;
