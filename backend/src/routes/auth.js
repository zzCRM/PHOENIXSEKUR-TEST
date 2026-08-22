import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken(user);
    res.json({
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        company_id: user.companyId,
        first_name: user.firstName,
        last_name: user.lastName,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({
    id: user.id,
    email: user.email,
    role: user.role,
    company_id: user.companyId,
    first_name: user.firstName,
    last_name: user.lastName,
  });
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
