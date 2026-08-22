import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // This function is called by a scheduled automation every day at 7:00
    // It sends the previous day's main courante to all clients

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Get all main courante entries from yesterday
    const allEntries = await base44.asServiceRole.entities.MainCourante.filter({ date: yesterdayStr });

    if (allEntries.length === 0) {
      return Response.json({ message: 'No entries for yesterday', date: yesterdayStr });
    }

    // Group by client
    const byClient = {};
    allEntries.forEach(entry => {
      const key = entry.client_id || entry.client_name;
      if (!key) return;
      if (!byClient[key]) {
        byClient[key] = {
          client_name: entry.client_name,
          client_id: entry.client_id,
          entries: [],
        };
      }
      byClient[key].entries.push(entry);
    });

    // Get client emails
    const clients = await base44.asServiceRole.entities.Client.list();
    const clientMap = {};
    clients.forEach(c => { clientMap[c.id] = c; });

    const results = [];

    for (const [key, group] of Object.entries(byClient)) {
      const client = clientMap[group.client_id];
      if (!client?.email) continue;

      // Build email body
      const typeLabels = {
        arrivee: '✅ Arrivée', depart: '🚪 Départ', incident: '🚨 Incident',
        ronde: '🔍 Ronde', observation: '📝 Observation', pti_alerte: '⚠️ Alerte PTI',
        pti_ok: '✅ PTI OK', autre: '📌 Autre'
      };

      const entriesHtml = group.entries.map(e => `
        <tr>
          <td style="padding:8px;border:1px solid #e5e7eb;">${e.time || ''}</td>
          <td style="padding:8px;border:1px solid #e5e7eb;">${typeLabels[e.type] || e.type}</td>
          <td style="padding:8px;border:1px solid #e5e7eb;">${e.site_name || ''}</td>
          <td style="padding:8px;border:1px solid #e5e7eb;">${e.content || ''}</td>
        </tr>
      `).join('');

      const emailBody = `
        <div style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;">
          <div style="background:#1a2232;padding:24px;border-radius:8px 8px 0 0;">
            <h1 style="color:#22c55e;margin:0;font-size:24px;">🛡️ Main Courante Électronique</h1>
            <p style="color:#94a3b8;margin:8px 0 0;">Rapport du ${yesterday.toLocaleDateString('fr-FR', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
          </div>
          <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;">
            <p>Bonjour <strong>${client.contact_name || client.company_name}</strong>,</p>
            <p>Veuillez trouver ci-dessous le rapport de surveillance de la journée du <strong>${yesterday.toLocaleDateString('fr-FR')}</strong> :</p>
            <table style="width:100%;border-collapse:collapse;margin-top:16px;">
              <thead>
                <tr style="background:#f3f4f6;">
                  <th style="padding:10px;border:1px solid #e5e7eb;text-align:left;">Heure</th>
                  <th style="padding:10px;border:1px solid #e5e7eb;text-align:left;">Type</th>
                  <th style="padding:10px;border:1px solid #e5e7eb;text-align:left;">Site</th>
                  <th style="padding:10px;border:1px solid #e5e7eb;text-align:left;">Détail</th>
                </tr>
              </thead>
              <tbody>${entriesHtml}</tbody>
            </table>
            <p style="margin-top:24px;color:#6b7280;font-size:14px;">
              Ce rapport a été généré automatiquement.<br>
              Total : <strong>${group.entries.length} entrée(s)</strong>
            </p>
          </div>
          <div style="background:#f3f4f6;padding:16px;border-radius:0 0 8px 8px;text-align:center;color:#9ca3af;font-size:12px;">
            SEKUR - Logiciel de sécurité privée
          </div>
        </div>
      `;

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: client.email,
        subject: `Main courante du ${yesterday.toLocaleDateString('fr-FR')} - ${client.company_name}`,
        body: emailBody,
      });

      // Mark entries as sent
      for (const entry of group.entries) {
        await base44.asServiceRole.entities.MainCourante.update(entry.id, { sent_to_client: true });
      }

      results.push({ client: client.company_name, email: client.email, entries: group.entries.length });
    }

    return Response.json({ success: true, sent: results, date: yesterdayStr });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});