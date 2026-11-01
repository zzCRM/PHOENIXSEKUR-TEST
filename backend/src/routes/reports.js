import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { sendReportEmail } from '../lib/report-email.js';
import { getEntityDelegate, toApiRecord } from '../lib/prisma.js';
import { runScheduledReports } from '../lib/report-scheduler.js';
import { buildScope, escapeHtml, reportCompanyId } from '../lib/access.js';
import {
  addIsoDays,
  buildMainCouranteLines,
  parisNow,
  renderMainCourantePdf,
} from '../lib/mainCouranteReport.js';

async function loadRows(entityName, companyId) {
  const rows = await getEntityDelegate(entityName).findMany({ where: { companyId } });
  return rows.map(toApiRecord);
}

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
    if (!reportCompanyId(req.user, req.body?.company_id)) {
      return res.status(403).json({ error: 'Accès refusé' });
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
        subject: subject ? escapeHtml(subject) : undefined,
        text: body ? escapeHtml(body) : undefined,
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

router.post('/main-courante.pdf', requireAuth, async (req, res) => {
  try {
    const role = req.user.role;
    const allowedRole = role === 'admin' || role === 'supervisor' || role === 'superadmin' || role === 'client';
    if (!allowedRole) return res.status(403).json({ error: 'Accès refusé' });

    const companyId = role === 'superadmin'
      ? (req.body?.company_id || req.user.companyId)
      : req.user.companyId;
    if (!companyId) return res.status(403).json({ error: 'Accès refusé' });

    const clock = parisNow();
    const end = req.body?.end || clock.iso;
    const start = req.body?.start || addIsoDays(end, -1);
    const [entries, prises, executions, sites, clients, missions, settingsRows] = await Promise.all([
      loadRows('MainCourante', companyId),
      loadRows('PriseDeService', companyId),
      loadRows('RondeExecution', companyId),
      loadRows('Site', companyId),
      loadRows('Client', companyId),
      loadRows('Mission', companyId),
      loadRows('CompanySettings', companyId),
    ]);

    let visibleSites = sites;
    if (role === 'client') {
      const scope = buildScope({ ...req.user, id: req.user.sub }, { clients, sites });
      visibleSites = sites.filter((site) => scope.siteIds.has(site.id));
    }
    const requested = [req.body?.site_id, ...(req.body?.site_ids || [])].filter(Boolean);
    if (requested.length) {
      const wanted = new Set(requested);
      visibleSites = visibleSites.filter((site) => wanted.has(site.id));
    }
    if (role === 'client' && !visibleSites.length) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const lines = buildMainCouranteLines({
      entries,
      prises,
      executions,
      missions,
      start,
      end,
      siteIds: visibleSites.map((site) => site.id),
    });
    const pdf = renderMainCourantePdf({
      company: settingsRows[0] || {},
      sites: visibleSites,
      clients,
      lines,
      start,
      end,
      editionLabel: clock.label,
      editionTime: clock.time,
    });
    const filename = `rapport-main-courante-${start}-${end}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
  } catch (err) {
    console.error('Main courante PDF error:', err);
    res.status(500).json({ error: 'Génération du rapport impossible' });
  }
});

/** Déclenche manuellement le job d'envoi auto (test depuis Paramètres). */
router.post('/run-scheduled', requireAuth, async (req, res) => {
  try {
    const companyId = reportCompanyId(req.user, req.body?.company_id);
    if (!companyId) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    const result = await runScheduledReports({
      force: true,
      companyId,
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
