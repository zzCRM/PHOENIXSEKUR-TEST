import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import {
  actOnPtiAlert,
  applyPtiDue,
  getEffectivePti,
  getPtiConfig,
  listPtiAlerts,
  savePtiConfig,
  submitPtiAlert,
} from '../lib/ptiService.js';

const router = Router();
router.use(requireAuth);

function sendError(res, err) {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Erreur PTI' : err.message });
}

router.get('/ping', (_req, res) => {
  res.json({ ok: true, server_time: new Date().toISOString() });
});

router.get('/config', async (req, res) => {
  try {
    res.json(await getPtiConfig(prisma, req.user));
  } catch (err) {
    sendError(res, err);
  }
});

router.put('/config', async (req, res) => {
  try {
    res.json(await savePtiConfig(prisma, req.user, req.body || {}));
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/effective', async (req, res) => {
  try {
    res.json(await getEffectivePti(prisma, req.user, {
      agent_id: req.query.agent_id,
      site_id: req.query.site_id,
      mission_id: req.query.mission_id,
      site_radius: req.query.site_radius,
    }));
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/alerts', async (req, res) => {
  try {
    res.json(await listPtiAlerts(prisma, req.user, { tests: req.query.tests === '1' }));
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/alerts', async (req, res) => {
  try {
    res.status(201).json(await submitPtiAlert(prisma, req.user, req.body || {}));
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/alerts/due', async (req, res) => {
  try {
    res.json({ updated: await applyPtiDue(prisma, req.user) });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/alerts/:id', async (req, res) => {
  try {
    res.json(await actOnPtiAlert(prisma, req.user, req.params.id, req.body || {}));
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
