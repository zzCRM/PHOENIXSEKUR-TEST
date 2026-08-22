import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { sendReportEmail, buildReportSummaryText } from '../lib/report-email.js';
import { getEntityDelegate, toApiRecord } from '../lib/prisma.js';

const router = Router();

router.post('/send-email', requireAuth, async (req, res) => {
  try {
    const {
      to,
      subject,
      body,
      pdf_base64: pdfBase64,
      filename,
      start,
      end,
      modules,
      stats,
      company_name: companyName,
      save_schedule: saveSchedule,
      schedule,
    } = req.body;

    const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
    if (recipients.length === 0) {
      return res.status(400).json({ error: 'Destinataire email requis' });
    }

    const text = body || buildReportSummaryText({
      companyName,
      start,
      end,
      modules,
      stats: stats || {},
    });

    const results = [];
    for (const email of recipients) {
      const result = await sendReportEmail({
        to: email,
        subject: subject || `Rapport de sécurité — ${start} au ${end}`,
        text,
        pdfBase64,
        filename,
      });
      results.push({ email, ...result });
    }

    if (saveSchedule && schedule && req.user.companyId) {
      try {
        const delegate = getEntityDelegate('CompanySettings');
        const rows = await delegate.findMany({
          where: { companyId: req.user.companyId },
          take: 1,
        });
        if (rows[0]) {
          const merged = {
            ...(typeof rows[0].data === 'object' ? rows[0].data : {}),
            report_schedule: { ...schedule, enabled: true },
          };
          await delegate.update({
            where: { id: rows[0].id },
            data: { data: merged },
          });
        }
      } catch (e) {
        console.warn('Save report schedule failed:', e.message);
      }
    }

    const sent = results.some((r) => r.sent);
    res.json({
      success: sent,
      results,
      message: sent
        ? `Rapport envoyé à ${recipients.join(', ')}`
        : 'SMTP non configuré — rapport non envoyé',
    });
  } catch (err) {
    console.error('Report email error:', err);
    res.status(500).json({ error: 'Envoi du rapport impossible' });
  }
});

export default router;
