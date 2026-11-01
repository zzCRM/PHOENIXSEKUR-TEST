import { getEntityDelegate, toApiRecord } from './prisma.js';
import { sendReportEmail, buildReportSummaryText } from './report-email.js';
import { addIsoDays, parisNow, pdfsForSites } from './mainCouranteReport.js';

function periodDates(freq, now = parisNow()) {
  const end = now.iso;
  const back = freq === 'daily' ? -1 : freq === 'monthly' ? -30 : -7;
  return { start: addIsoDays(end, back), end };
}

function shouldRunNow(schedule, now = parisNow()) {
  if (!schedule?.enabled) return false;
  if (now.hour !== 7) return false;
  if (schedule.frequency === 'daily') return true;
  if (schedule.frequency === 'weekly') return now.weekday === 1;
  if (schedule.frequency === 'monthly') return now.dayOfMonth === 1;
  return false;
}

function alreadySentToday(schedule, now = parisNow()) {
  return schedule?.last_sent_date === now.iso;
}

async function loadRows(entityName, companyId) {
  const rows = await getEntityDelegate(entityName).findMany({ where: { companyId } });
  return rows.map(toApiRecord);
}

async function countForClient(entityName, companyId, clientId, start, end) {
  const delegate = getEntityDelegate(entityName);
  const rows = await delegate.findMany({ where: { companyId } });
  return rows.map(toApiRecord).filter((r) => {
    const d = r.date || r.created_date?.slice(0, 10);
    if (!d || d < start || d > end) return false;
    if (clientId && clientId !== 'all') {
      return r.client_id === clientId;
    }
    return true;
  }).length;
}

function reportText(companyName, start, end, modules, stats, fileCount) {
  const base = buildReportSummaryText({ companyName, start, end, modules, stats });
  if (!fileCount) return base;
  return `${base}\n\nLe rapport de main courante est joint en PDF (prise de service, rondes, points de contrôle).`;
}

function clientWantsReports(client) {
  const perms = client.portal_perms || {};
  const notifs = client.portal_notifs || {};
  if (perms.notif_rapport_auto === true) return true;
  if (notifs.notif_rapport_rondes === true) return true;
  if (notifs.notif_main_courante === true) return true;
  // Si opt-in pas exigé, l'appelant décide
  return false;
}

function collectClientEmails(client) {
  const emails = new Set();
  if (client.email) emails.add(client.email.trim().toLowerCase());
  (client.comptes_clients || []).forEach((c) => {
    if (c.email) emails.add(c.email.trim().toLowerCase());
  });
  return [...emails];
}

async function markLastSent(settingsRow, schedule) {
  const delegate = getEntityDelegate('CompanySettings');
  const today = parisNow().iso;
  const merged = {
    ...(typeof settingsRow.data === 'object' ? settingsRow.data : {}),
    report_schedule: { ...schedule, last_sent_date: today },
  };
  await delegate.update({
    where: { id: settingsRow.id },
    data: { data: merged },
  });
}

export async function runScheduledReports({ force = false, companyId = null } = {}) {
  if (!process.env.SMTP_HOST && !force) {
    console.log('[reports] SMTP non configuré — scheduler ignoré');
    return { ran: false, reason: 'no_smtp' };
  }

  try {
    const settingsDelegate = getEntityDelegate('CompanySettings');
    const clientDelegate = getEntityDelegate('Client');
    const allSettings = await settingsDelegate.findMany(
      companyId ? { where: { companyId } } : {},
    );
    let sentCount = 0;

    for (const row of allSettings) {
      const record = toApiRecord(row);
      const schedule = record.report_schedule || {};
      const clock = parisNow();
      if (!force && !shouldRunNow(schedule, clock)) continue;
      if (!force && alreadySentToday(schedule, clock)) continue;
      if (!schedule.enabled) continue;

      const companyId = row.companyId;
      const { start, end } = periodDates(schedule.frequency || 'weekly', clock);
      const modules = schedule.modules || ['main_courante', 'rondes', 'incidents'];
      const companyName = record.company_name || 'Phoenix Sekur';

      // Destinataires : clients
      const clientRows = await clientDelegate.findMany({ where: { companyId } });
      const clients = clientRows.map(toApiRecord);

      const sendToClients = schedule.send_to_clients !== false;
      const requireOptIn = schedule.only_opt_in_clients !== false;
      const [entries, prises, executions, sites, missions] = await Promise.all([
        loadRows('MainCourante', companyId),
        loadRows('PriseDeService', companyId),
        loadRows('RondeExecution', companyId),
        loadRows('Site', companyId),
        loadRows('Mission', companyId),
      ]);
      const reportPdfs = pdfsForSites({
        company: record,
        sites,
        clients,
        entries,
        prises,
        executions,
        missions,
        start,
        end,
        editionLabel: clock.label,
        editionTime: '07:00',
      });
      const filesFor = (clientId) => reportPdfs
        .filter((file) => !clientId || file.clientId === clientId)
        .map((file) => ({ filename: file.filename, content: file.content }));

      if (sendToClients) {
        for (const client of clients) {
          if (requireOptIn && !clientWantsReports(client)) continue;
          const emails = collectClientEmails(client);
          if (!emails.length) continue;

          const stats = {
            rondes: modules.includes('rondes')
              ? await countForClient('RondeExecution', companyId, client.id, start, end)
              : 0,
            main_courante: modules.includes('main_courante')
              ? await countForClient('MainCourante', companyId, client.id, start, end)
              : 0,
            incidents: modules.includes('incidents')
              ? await countForClient('Alerte', companyId, client.id, start, end)
              : 0,
            planning: modules.includes('planning')
              ? await countForClient('Mission', companyId, client.id, start, end)
              : 0,
          };

          const attachments = filesFor(client.id);
          for (const to of emails) {
            const result = await sendReportEmail({
              to,
              companyName: client.company_name || companyName,
              start,
              end,
              modules,
              stats,
              attachments,
              text: reportText(client.company_name || companyName, start, end, modules, stats, attachments.length),
            });
            if (result.sent) sentCount += 1;
          }
        }
      }

      // Copie société
      if (schedule.send_to_company) {
        const companyEmail = schedule.company_copy_email || record.email;
        if (companyEmail) {
          const stats = {
            rondes: await countForClient('RondeExecution', companyId, null, start, end),
            main_courante: await countForClient('MainCourante', companyId, null, start, end),
            incidents: await countForClient('Alerte', companyId, null, start, end),
            planning: await countForClient('Mission', companyId, null, start, end),
          };
          const companyFiles = filesFor(null);
          await sendReportEmail({
            to: companyEmail,
            companyName,
            start,
            end,
            modules,
            stats,
            attachments: companyFiles,
            text: reportText(companyName, start, end, modules, stats, companyFiles.length),
          });
          sentCount += 1;
        }
      }

      // Destinataires manuels additionnels
      const extra = (schedule.recipients || '')
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean);
      const extraFiles = filesFor(null);
      for (const to of extra) {
        const stats = {
          rondes: await countForClient('RondeExecution', companyId, null, start, end),
          main_courante: await countForClient('MainCourante', companyId, null, start, end),
          incidents: await countForClient('Alerte', companyId, null, start, end),
          planning: await countForClient('Mission', companyId, null, start, end),
        };
        await sendReportEmail({
          to,
          companyName,
          start,
          end,
          modules,
          stats,
          attachments: extraFiles,
          text: reportText(companyName, start, end, modules, stats, extraFiles.length),
        });
        sentCount += 1;
      }

      await markLastSent(row, schedule);
      console.log(`[reports] Société ${companyId}: envois effectués`);
    }

    return { ran: true, sentCount };
  } catch (err) {
    console.error('[reports] Scheduler error:', err);
    return { ran: false, error: err.message };
  }
}

export function startReportScheduler() {
  // Vérifie toutes les 15 min pour ne pas rater le créneau 7h
  runScheduledReports();
  setInterval(() => runScheduledReports(), 15 * 60 * 1000);
}
