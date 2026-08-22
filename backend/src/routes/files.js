import { Router } from 'express';
import { upload } from '../lib/upload.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }
  const file_url = `/uploads/${req.file.filename}`;
  res.json({ file_url, url: file_url });
});

export default router;
