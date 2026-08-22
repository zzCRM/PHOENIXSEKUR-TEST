import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import entityRoutes from './routes/entities.js';
import { authMiddleware } from './middleware/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(authMiddleware);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'phoenixsekur-api' });
});

// Replaces Base44 getGoogleMapsApiKey function
app.get('/api/config/google-maps-key', (_req, res) => {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return res.status(503).json({ error: 'Google Maps API key not configured' });
  res.json({ apiKey: key });
});

app.use('/api/auth', authRoutes);
app.use('/api/entities', entityRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Phoenix Sekur API running on http://localhost:${PORT}`);
});
