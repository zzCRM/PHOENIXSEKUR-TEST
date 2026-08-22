import { getEntityDelegate, toApiRecord } from './prisma.js';
import { sendReportEmail, buildReportSummaryText } from './report-email.js';

function periodDates(freq) {
  const end = new Date();
  const start = new Date(end);
  if (freq === 'daily') start.setDate(start.getDate() - 1);
  else if (freq === 'weekly') start.setDate(start.getDate() - 7);
  else start.setDate(start.getDate() - 30);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

function shouldRunNow(schedule) {
  if (!schedule?.enabled) return false;
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  const date = now.getDate();
  // Fenêtre 7h–8h pour éviter de rater le créneau si le tick tombe après :00
  if (hour !== 7) return false;
  if (schedule.frequency === 'daily') return true;
  if (schedule.frequency === 'weekly') return day === 1;
  if (schedule.frequency === 'monthly') return date === 1;
  return false;
}

function alreadySentToday(schedule) {
  const today = new Date().toISOString().slice(0, 10);
  return schedule?.last_sent_date === today;
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
  const today = new Date().toISOString().slice(0, 10);
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
      if (!force && !shouldRunNow(schedule)) continue;
      if (!force && alreadySentToday(schedule)) continue;
      if (!schedule.enabled) continue;

      const companyId = row.companyId;
      const { start, end } = periodDates(schedule.frequency || 'weekly');
      const modules = schedule.modules || ['main_courante', 'rondes', 'incidents'];
      const companyName = record.company_name || 'Phoenix Sekur';

      // Destinataires : clients
      const clientRows = await clientDelegate.findMany({ where: { companyId } });
      const clients = clientRows.map(toApiRecord);

      const sendToClients = schedule.send_to_clients !== false;
      const requireOptIn = schedule.only_opt_in_clients !== false;

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

          const text = [
            `Bonjour,`,
            '',
            `Voici le rapport de sécurité automatique pour ${client.company_name || 'votre site'}.`,
            '',
            buildReportSummaryText({ companyName, start, end, modules, stats }),
            '',
            `Société : ${companyName}`,
            `— Envoi automatique Phoenix Sekur`,
          ].join('\n');

          for (const to of emails) {
            const result = await sendReportEmail({
              to,
              subject: `[Auto] Rapport sécurité — ${client.company_name || 'Client'} (${start} → ${end})`,
              text,
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
          await sendReportEmail({
            to: companyEmail,
            subject: `[Auto] Rapport sécurité global (${start} → ${end})`,
            text: buildReportSummaryText({ companyName, start, end, modules, stats }),
          });
          sentCount += 1;
        }
      }

      // Destinataires manuels additionnels
      const extra = (schedule.recipients || '')
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean);
      for (const to of extra) {
        await sendReportEmail({
          to,
          subject: `[Auto] Rapport sécurité (${start} → ${end})`,
          text: buildReportSummaryText({
            companyName,
            start,
            end,
            modules,
            stats: {
              rondes: await countForClient('RondeExecution', companyId, null, start, end),
              main_courante: await countForClient('MainCourante', companyId, null, start, end),
              incidents: await countForClient('Alerte', companyId, null, start, end),
              planning: await countForClient('Mission', companyId, null, start, end),
            },
          }),
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
