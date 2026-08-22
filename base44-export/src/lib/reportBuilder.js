/** Génère le texte du rapport sans IA externe. */
export function buildReportText({ companyName, start, end, clientName, modules, data }) {
  const lines = [
    `RAPPORT DE SÉCURITÉ — ${companyName || 'Phoenix Sekur'}`,
    `Période : ${start} → ${end}`,
    `Client : ${clientName || 'Tous les clients'}`,
    '',
    'RÉSUMÉ EXÉCUTIF',
    `Ce rapport couvre ${modules.length} module(s) : ${modules.join(', ')}.`,
    '',
  ];

  if (data.rondes?.length) {
    lines.push(`RONDES (${data.rondes.length} exécution(s))`);
    data.rondes.slice(0, 8).forEach((r) => {
      lines.push(`  • ${r.date} — ${r.agent_name || '-'} — ${r.ronde_name || '-'} — ${(r.checkpoints_done || []).length} pts — ${r.status || ''}`);
    });
    lines.push('');
  }

  if (data.main_courante?.length) {
    lines.push(`MAIN COURANTE (${data.main_courante.length} entrée(s))`);
    data.main_courante.slice(0, 8).forEach((mc) => {
      lines.push(`  • ${mc.date} ${mc.time || ''} — ${mc.type} — ${(mc.content || '').slice(0, 80)}`);
    });
    lines.push('');
  }

  if (data.incidents?.length) {
    lines.push(`INCIDENTS (${data.incidents.length})`);
    data.incidents.slice(0, 8).forEach((a) => {
      lines.push(`  • ${a.date} — ${a.type} — ${a.message || a.content || ''}`);
    });
    lines.push('');
  }

  if (data.planning?.length) {
    lines.push(`PLANNING (${data.planning.length} mission(s))`);
    data.planning.slice(0, 8).forEach((m) => {
      lines.push(`  • ${m.date} — ${m.site_name} — ${m.agent_name || '-'} — ${m.start_time}-${m.end_time}`);
    });
    lines.push('');
  }

  lines.push('CONCLUSION');
  lines.push('Rapport généré automatiquement par Phoenix Sekur. Document confidentiel.');

  return lines.join('\n');
}
