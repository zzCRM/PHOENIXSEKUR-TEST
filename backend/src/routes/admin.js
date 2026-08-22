import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { isSuperAdmin } from '../lib/superadmin.js';
import { createAndSendInvitation } from '../lib/invitations.js';

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
  const [users, companies, invoices, clients, missions] = await Promise.all([
    prisma.user.count(),
    prisma.companySettings.count(),
    prisma.invoice.count(),
    prisma.client.count(),
    prisma.mission.count(),
  ]);
  res.json({ users, companies, invoices, clients, missions });
});

router.get('/users', async (_req, res) => {
  const users = await prisma.user.findMany({
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
  });
  res.json(users);
});

router.post('/users', async (req, res) => {
  const { email, password, role = 'admin', company_id, first_name, last_name } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requis' });

  const companyId = company_id || process.env.ADMIN_COMPANY_ID || '69edb44339460eb505c2a699';
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return res.status(409).json({ error: 'Cet email existe déjà' });
  }

  if (!password) {
    const { inviteUrl, emailSent } = await createAndSendInvitation({
      email: normalizedEmail,
      role,
      companyId,
      invitedBy: req.user.email,
    });

    return res.status(201).json({
      email: normalizedEmail,
      role,
      company_id: companyId,
      email_sent: emailSent,
      invite_url: emailSent ? undefined : inviteUrl,
      message: emailSent
        ? `Invitation envoyée par email à ${normalizedEmail}`
        : `Invitation créée. Configurez SMTP ou transmettez le lien manuellement.`,
    });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      role,
      companyId,
      firstName: first_name || normalizedEmail.split('@')[0],
      lastName: last_name || '',
    },
  });

  res.status(201).json({
    id: user.id,
    email: user.email,
    role: user.role,
    company_id: user.companyId,
    temporary_password: password,
    message: 'Utilisateur créé. Communiquez-lui son mot de passe.',
  });
});

router.patch('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { role, is_active, password, company_id } = req.body;
  const data = {};
  if (role !== undefined) data.role = role;
  if (is_active !== undefined) data.isActive = is_active;
  if (company_id !== undefined) data.companyId = company_id;
  if (password) data.passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.update({ where: { id }, data });
  res.json({
    id: user.id,
    email: user.email,
    role: user.role,
    is_active: user.isActive,
    password_reset: !!password,
  });
});

router.get('/companies', async (_req, res) => {
  const rows = await prisma.companySettings.findMany({ orderBy: { updatedAt: 'desc' } });
  res.json(
    rows.map((r) => ({
      id: r.id,
      company_id: r.companyId,
      ...(typeof r.data === 'object' && r.data !== null ? r.data : {}),
    }))
  );
});

router.get('/me', (req, res) => {
  res.json({ superadmin: true, email: req.user.email, role: req.user.role });
});

export default router;
