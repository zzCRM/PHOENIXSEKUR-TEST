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
  if (schedule.frequency === 'daily') return hour === 7;
  if (schedule.frequency === 'weekly') return day === 1 && hour === 7;
  if (schedule.frequency === 'monthly') return date === 1 && hour === 7;
  return false;
}

async function countEntity(entityName, companyId, start, end, dateField = 'date') {
  const delegate = getEntityDelegate(entityName);
  const rows = await delegate.findMany({ where: { companyId } });
  return rows.map(toApiRecord).filter((r) => {
    const d = r[dateField] || r.created_date?.slice(0, 10);
    return d && d >= start && d <= end;
  }).length;
}

export async function runScheduledReports() {
  if (!process.env.SMTP_HOST) return;

  try {
    const delegate = getEntityDelegate('CompanySettings');
    const all = await delegate.findMany({});
    for (const row of all) {
      const record = toApiRecord(row);
      const schedule = record.report_schedule || record.data?.report_schedule;
      if (!shouldRunNow(schedule)) continue;

      const { start, end } = periodDates(schedule.frequency);
      const companyId = row.companyId;
      const stats = {
        rondes: await countEntity('RondeExecution', companyId, start, end),
        main_courante: await countEntity('MainCourante', companyId, start, end),
        incidents: await countEntity('Alerte', companyId, start, end),
        planning: await countEntity('Mission', companyId, start, end),
      };

      const recipients = (schedule.recipients || schedule.email_client || '')
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean);
      if (!recipients.length) continue;

      const text = buildReportSummaryText({
        companyName: record.company_name,
        start,
        end,
        modules: schedule.modules || ['main_courante', 'rondes'],
        stats,
      });

      for (const to of recipients) {
        await sendReportEmail({
          to,
          subject: `[Auto] Rapport sécurité ${start} → ${end}`,
          text,
        });
      }
      console.log(`[reports] Envoi planifié → ${recipients.join(', ')} (${companyId})`);
    }
  } catch (err) {
    console.error('[reports] Scheduler error:', err);
  }
}

export function startReportScheduler() {
  runScheduledReports();
  setInterval(runScheduledReports, 60 * 60 * 1000);
}
