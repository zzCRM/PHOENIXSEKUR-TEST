import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { sendReportEmail } from '../lib/report-email.js';
import { getEntityDelegate } from '../lib/prisma.js';
import { runScheduledReports } from '../lib/report-scheduler.js';

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

    const results = [];
    for (const email of recipients) {
      const result = await sendReportEmail({
        to: email,
        companyName,
        start,
        end,
        modules,
        stats: stats || {},
        // Sujet/corps custom optionnels ; sinon modèle Super Admin « report_client »
        subject: subject || undefined,
        text: body || undefined,
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

/** Déclenche manuellement le job d'envoi auto (test depuis Paramètres). */
router.post('/run-scheduled', requireAuth, async (req, res) => {
  try {
    const result = await runScheduledReports({
      force: true,
      companyId: req.user.companyId || null,
    });
    res.json({
      success: true,
      ...result,
      message: result.sentCount
        ? `${result.sentCount} email(s) envoyé(s)`
        : 'Aucun destinataire trouvé (activez l\'option et vérifiez les emails clients)',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
