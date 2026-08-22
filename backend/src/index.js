import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import entityRoutes from './routes/entities.js';
import fileRoutes from './routes/files.js';
import userRoutes from './routes/users.js';
import adminRoutes from './routes/admin.js';
import publicRoutes from './routes/public.js';
import reportRoutes from './routes/reports.js';
import { authMiddleware } from './middleware/auth.js';
import { startReportScheduler } from './lib/report-scheduler.js';
import { getSmtpStatus } from './lib/email.js';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

function getCorsOrigins() {
  const list = [
    process.env.CORS_ORIGIN,
    process.env.VITRINE_URL,
    process.env.VITRINE_DOMAIN ? `https://${process.env.VITRINE_DOMAIN}` : null,
    process.env.ROOT_DOMAIN ? `https://${process.env.ROOT_DOMAIN}` : null,
  ].filter(Boolean);
  return [...new Set(list)];
}

const corsOrigins = getCorsOrigins();
app.use(cors({
  origin(origin, callback) {
    if (!origin || corsOrigins.length === 0 || corsOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(authMiddleware);

// Fichiers uploadés (logos, photos, documents)
app.use('/uploads', express.static(join(__dirname, '../uploads')));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'phoenixsekur-api', version: '1.1.0' });
});

app.get('/api/config/google-maps-key', (_req, res) => {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return res.json({ apiKey: '', data: { apiKey: '' } });
  res.json({ apiKey: key, data: { apiKey: key } });
});

app.use('/api/reports', reportRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/entities', entityRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Phoenix Sekur API running on http://localhost:${PORT}`);
  const smtp = getSmtpStatus();
  console.log(
    smtp.configured
      ? `[email] SMTP prêt (${smtp.host}:${smtp.port} as ${smtp.user})`
      : '[email] SMTP non configuré — les invitations ne partiront pas par email',
  );
  startReportScheduler();
});
