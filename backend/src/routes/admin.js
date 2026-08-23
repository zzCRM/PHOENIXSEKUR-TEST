import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { isSuperAdmin } from '../lib/superadmin.js';
import { createAndSendInvitation, resendInvitation } from '../lib/invitations.js';
import {
  getPlatformSettings,
  updatePlatformSettings,
  DEFAULT_SETTINGS,
  EMAIL_TEMPLATE_DEFS,
} from '../lib/platform-settings.js';

const router = Router();

function requireSuperAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (!isSuperAdmin(req.user)) {
    return res.status(403).json({ error: 'Accès Super Admin requis' });
  }
  next();
}

router.use(requireAuth, requireSuperAdmin);

router.get('/stats', async (_req, res) => {
  const [
    users, companies, invoices, clients, missions,
    pendingInvitations, pendingSignups, suspendedCompanies,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.companySettings.count(),
    prisma.invoice.count(),
    prisma.client.count(),
    prisma.mission.count(),
    prisma.invitation.count({ where: { acceptedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.signupRequest.count({ where: { status: 'pending' } }),
    prisma.companySubscription.count({ where: { status: 'suspended' } }),
  ]);
  res.json({
    users, companies, invoices, clients, missions,
    pending_invitations: pendingInvitations,
    pending_signups: pendingSignups,
    suspended_companies: suspendedCompanies,
  });
});

// ─── Utilisateurs ───────────────────────────────────────────────────────────

router.get('/users', async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, email: true, role: true, companyId: true,
      firstName: true, lastName: true, isActive: true,
      suspendReason: true, createdAt: true,
    },
  });
  res.json(users);
});

router.post('/users', async (req, res) => {
  const { email, password, role = 'admin', company_id, first_name, last_name } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requis' });

  const companyId = company_id || process.env.ADMIN_COMPANY_ID || '69edb44339460eb505c2a699';
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) return res.status(409).json({ error: 'Cet email existe déjà' });

  if (!password) {
    const { inviteUrl, emailSent, emailReason, emailError } = await createAndSendInvitation({
      email: normalizedEmail, role, companyId, invitedBy: req.user.email,
    });
    return res.status(201).json({
      email: normalizedEmail, role, company_id: companyId,
      email_sent: emailSent,
      email_reason: emailReason || null,
      email_error: emailError || null,
      invite_url: inviteUrl,
      message: emailSent
        ? `Invitation envoyée à ${normalizedEmail}`
        : `Invitation créée — email non envoyé (${emailReason || 'smtp'}). Copiez le lien.`,
    });
  }

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 12),
      role, companyId,
      firstName: first_name || normalizedEmail.split('@')[0],
      lastName: last_name || '',
    },
  });

  res.status(201).json({
    id: user.id, email: user.email, role: user.role,
    company_id: user.companyId, temporary_password: password,
  });
});

router.patch('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { role, is_active, password, company_id, suspend_reason } = req.body;
  const data = {};
  if (role !== undefined) data.role = role;
  if (is_active !== undefined) {
    data.isActive = is_active;
    data.suspendReason = is_active ? null : (suspend_reason || 'Compte suspendu');
  }
  if (company_id !== undefined) data.companyId = company_id;
  if (password) data.passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.update({ where: { id }, data });
  res.json({
    id: user.id, email: user.email, role: user.role,
    is_active: user.isActive, suspend_reason: user.suspendReason,
    password_reset: !!password,
  });
});

router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  if (id === req.user.sub) {
    return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
  }
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' });
  if (isSuperAdmin({ email: target.email, role: target.role })) {
    const superCount = await prisma.user.count({
      where: { OR: [{ role: 'superadmin' }] },
    });
    if (superCount <= 1) {
      return res.status(400).json({ error: 'Impossible de supprimer le dernier super admin' });
    }
  }
  await prisma.user.delete({ where: { id } });
  res.json({ success: true, deleted: target.email });
});

// ─── Invitations ────────────────────────────────────────────────────────────

router.get('/invitations', async (_req, res) => {
  const rows = await prisma.invitation.findMany({
    where: { acceptedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(rows.map((i) => ({
    id: i.id, email: i.email, role: i.role, company_id: i.companyId,
    invited_by: i.invitedBy, expires_at: i.expiresAt,
    expired: i.expiresAt < new Date(), created_at: i.createdAt,
  })));
});

router.post('/invitations/:id/resend', async (req, res) => {
  try {
    const result = await resendInvitation(req.params.id, req.user.email);
    if (!result) return res.status(404).json({ error: 'Invitation introuvable' });
    res.json({
      success: true, email_sent: result.emailSent,
      invite_url: result.emailSent ? undefined : result.inviteUrl,
      message: result.emailSent ? 'Invitation renvoyée par email' : 'Lien régénéré',
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Demandes d'inscription (site vitrine) ──────────────────────────────────

router.get('/signup-requests', async (req, res) => {
  const status = req.query.status;
  const where = status ? { status } : {};
  const rows = await prisma.signupRequest.findMany({
    where, orderBy: { createdAt: 'desc' }, take: 200,
  });
  res.json(rows);
});

router.post('/signup-requests/:id/approve', async (req, res) => {
  const { trial_days } = req.body;
  const signup = await prisma.signupRequest.findUnique({ where: { id: req.params.id } });
  if (!signup) return res.status(404).json({ error: 'Demande introuvable' });
  if (signup.status !== 'pending') return res.status(400).json({ error: 'Demande déjà traitée' });

  const settings = await getPlatformSettings();
  const days = trial_days ?? signup.trialDays ?? settings.default_trial_days ?? 14;
  const companyId = randomBytes(12).toString('hex');
  const trialEndsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  await prisma.companySettings.create({
    data: {
      id: companyId,
      companyId,
      data: {
        company_id: companyId,
        company_name: signup.companyName || signup.email.split('@')[0],
        email: signup.email,
        phone: signup.phone || '',
      },
    },
  });

  await prisma.companySubscription.upsert({
    where: { companyId },
    create: { companyId, status: 'trial', plan: 'trial', trialEndsAt },
    update: { status: 'trial', trialEndsAt, suspendedAt: null, suspendReason: null },
  });

  const { emailSent, inviteUrl } = await createAndSendInvitation({
    email: signup.email,
    role: 'admin',
    companyId,
    invitedBy: req.user.email,
  });

  await prisma.signupRequest.update({
    where: { id: signup.id },
    data: {
      status: 'approved',
      companyId,
      trialDays: days,
      trialEndsAt,
      reviewedBy: req.user.email,
      reviewedAt: new Date(),
    },
  });

  res.json({
    success: true, company_id: companyId, trial_ends_at: trialEndsAt,
    email_sent: emailSent, invite_url: inviteUrl,
    message: `Société créée — essai ${days} jours jusqu'au ${trialEndsAt.toLocaleDateString('fr-FR')}`,
  });
});

router.post('/signup-requests/:id/reject', async (req, res) => {
  const { notes } = req.body;
  const signup = await prisma.signupRequest.findUnique({ where: { id: req.params.id } });
  if (!signup) return res.status(404).json({ error: 'Demande introuvable' });

  await prisma.signupRequest.update({
    where: { id: signup.id },
    data: {
      status: 'rejected',
      notes: notes || signup.notes,
      reviewedBy: req.user.email,
      reviewedAt: new Date(),
    },
  });
  res.json({ success: true });
});

// ─── Sociétés & abonnements ─────────────────────────────────────────────────

router.get('/companies', async (_req, res) => {
  const rows = await prisma.companySettings.findMany({ orderBy: { updatedAt: 'desc' } });
  const subs = await prisma.companySubscription.findMany();
  const subMap = Object.fromEntries(subs.map((s) => [s.companyId, s]));

  res.json(rows.map((r) => {
    const sub = subMap[r.companyId];
    return {
      id: r.id,
      company_id: r.companyId,
      ...(typeof r.data === 'object' && r.data !== null ? r.data : {}),
      subscription: sub ? {
        status: sub.status,
        plan: sub.plan,
        trial_ends_at: sub.trialEndsAt,
        suspended_at: sub.suspendedAt,
        suspend_reason: sub.suspendReason,
      } : null,
    };
  }));
});

router.patch('/companies/:companyId/subscription', async (req, res) => {
  const { companyId } = req.params;
  const { status, trial_ends_at, suspend_reason } = req.body;

  const data = {};
  if (status === 'suspended') {
    data.status = 'suspended';
    data.suspendedAt = new Date();
    data.suspendReason = suspend_reason || 'Impayé / suspension administrative';
  } else if (status === 'active') {
    data.status = 'active';
    data.suspendedAt = null;
    data.suspendReason = null;
  } else if (status === 'trial') {
    data.status = 'trial';
    data.suspendedAt = null;
    data.suspendReason = null;
  }
  if (trial_ends_at !== undefined) data.trialEndsAt = trial_ends_at ? new Date(trial_ends_at) : null;

  const sub = await prisma.companySubscription.upsert({
    where: { companyId },
    create: { companyId, status: status || 'trial', ...data },
    update: data,
  });

  if (status === 'suspended') {
    await prisma.user.updateMany({
      where: { companyId },
      data: { isActive: false, suspendReason: suspend_reason || 'Société suspendue (impayé)' },
    });
  } else if (status === 'active' || status === 'trial') {
    await prisma.user.updateMany({
      where: { companyId },
      data: { isActive: true, suspendReason: null },
    });
  }

  res.json({
    company_id: companyId,
    subscription: {
      status: sub.status,
      trial_ends_at: sub.trialEndsAt,
      suspend_reason: sub.suspendReason,
    },
  });
});

// ─── Paramètres plateforme (email invitation) ───────────────────────────────

router.get('/settings', async (_req, res) => {
  const settings = await getPlatformSettings();
  res.json({ ...settings, email_template_defs: EMAIL_TEMPLATE_DEFS });
});

router.patch('/settings', async (req, res) => {
  const allowed = [
    'default_trial_days', 'invitation_subject',
    'invitation_body_html', 'invitation_body_text', 'signup_notify_emails',
    'email_templates',
  ];
  const partial = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) partial[key] = req.body[key];
  }
  const settings = await updatePlatformSettings(partial);
  res.json({ ...settings, email_template_defs: EMAIL_TEMPLATE_DEFS });
});

router.get('/settings/defaults', (_req, res) => {
  res.json({ ...DEFAULT_SETTINGS, email_template_defs: EMAIL_TEMPLATE_DEFS });
});

router.get('/me', (req, res) => {
  res.json({ superadmin: true, email: req.user.email, role: req.user.role });
});

export default router;
