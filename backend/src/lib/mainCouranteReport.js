import { jsPDF } from 'jspdf';

const LABELS = {
  debut_service: 'Début de service',
  debut_service_retard: 'Début de service en retard',
  service_non_debute: 'Service non débuté',
  reprise_service: 'Reprise de service',
  interruption_service: 'Interruption de service',
  fin_service: 'Fin de service',
  fin_service_anticipee: 'Fin de service anticipée',
  prolongation_service: 'Prolongation de service',
  debut_pause: 'Début de pause',
  fin_pause: 'Fin de pause',
  debut_ronde: 'Début de ronde',
  fin_ronde: 'Fin de ronde',
  ronde_non_realisee: 'Ronde non réalisée',
  validation_point_controle: 'Validation point de contrôle',
  point_controle_geolocalise: 'Point de contrôle géolocalisé',
  point_controle_saute: 'Point de contrôle sauté',
  pti_alerte: 'Alerte PTI',
  geofence: 'Sortie de périmètre',
  sortie_perimetre: 'Sortie de périmètre',
  arrivee: 'Début de service',
  depart: 'Fin de service',
  incident: 'Incident',
  observation: 'Observation',
};

export function parisNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  const weekday = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 }[get('weekday')] ?? 0;
  const iso = `${get('year')}-${get('month')}-${get('day')}`;
  return {
    iso,
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    weekday,
    dayOfMonth: Number(get('day')),
    label: `${get('day')}/${get('month')}/${get('year')}`,
    time: `${get('hour')}:${get('minute')}`,
  };
}

export function addIsoDays(iso, days) {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatDateFr(iso) {
  if (!iso) return '';
  const [year, month, day] = String(iso).slice(0, 10).split('-');
  if (!year || !month || !day) return String(iso);
  return `${day}/${month}/${year}`;
}

export function shortRef(id) {
  const clean = String(id || '').replace(/[^a-zA-Z0-9]/g, '');
  if (!clean) return '';
  return clean.slice(-8);
}

function eventKey(row) {
  return row.event_type || row.type || '';
}

function eventLabel(row) {
  if (row.event_label && !String(row.event_label).includes('_')) return row.event_label;
  return LABELS[eventKey(row)] || row.event_label || eventKey(row) || 'Événement';
}

function formatTime(value) {
  const text = String(value || '').trim();
  const match = text.match(/(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return '';
  return `${match[1]}:${match[2]}:${match[3] || '00'}`;
}

function formatGps(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
  const trim = (n) => String(Math.round(n * 1e6) / 1e6);
  return `${trim(lat)} /\n${trim(lng)}`;
}

export function formatCollaborateur(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0].toUpperCase();
  const firstIsFamily = parts[0] === parts[0].toUpperCase() && parts[0] !== parts[0].toLowerCase();
  if (firstIsFamily) return `${parts[0]}\n${parts.slice(1).join(' ')}`;
  const family = parts[parts.length - 1].toUpperCase();
  const given = parts.slice(0, -1).join(' ');
  return `${family}\n${given}`;
}

function shiftHours(row, prisesById, missionsById) {
  const prise = prisesById[row.service_id] || prisesById[row.source_ref] || null;
  const mission = missionsById[row.mission_id] || missionsById[prise?.mission_id] || null;
  const start = prise?.planned_start || mission?.start_time || row.planned_start || '';
  const end = prise?.planned_end || mission?.end_time || row.planned_end || '';
  if (!start || !end) return '';
  return `${String(start).slice(0, 5)} - ${String(end).slice(0, 5)}`;
}

function descriptionOf(row) {
  const lines = [];
  const service = shortRef(row.service_id || row.source_ref);
  if (service) lines.push(`Référence service: ${service}`);
  if (row.ronde_name) lines.push(`Ronde: ${row.ronde_name}`);
  if (row.checkpoint_name) lines.push(`Point de contrôle: ${row.checkpoint_name}`);
  if (row.nfc_serial) lines.push(`Badge: ${row.nfc_serial}`);
  if (row.note) lines.push(`Description: ${row.note}`);
  const content = String(row.content || '').trim();
  if (content) lines.push(content);
  else if (row.photo_url && eventKey(row).includes('fin_service')) lines.push('Photo de fin de service');
  else if (row.photo_url && eventKey(row).includes('debut_service')) lines.push('Photo de la prise de service');
  return lines.join('\n');
}

function synthesize(prises, executions) {
  const rows = [];
  for (const prise of prises || []) {
    if (!prise) continue;
    const base = {
      site_id: prise.site_id,
      site_name: prise.site_name,
      client_id: prise.client_id,
      client_name: prise.client_name,
      agent_name: prise.agent_name,
      mission_id: prise.mission_id,
      service_id: prise.id,
      date: prise.date,
      planned_start: prise.planned_start,
      planned_end: prise.planned_end,
    };
    if (prise.actual_start) {
      const late = prise.event_type === 'debut_service_retard';
      const mode = prise.nfc_validated ? 'Badge NFC' : 'Pointage';
      rows.push({
        ...base,
        id: `auto-start-${prise.id}`,
        event_type: late ? 'debut_service_retard' : 'debut_service',
        time: prise.actual_start,
        latitude: prise.start_latitude,
        longitude: prise.start_longitude,
        photo_url: prise.start_photo_url,
        content: `Photo de la prise de service\nPointage de début de service : ${mode}`,
      });
    }
    if (prise.actual_end) {
      const mode = prise.nfc_end_validated || prise.nfc_validated ? 'Badge NFC' : 'Pointage';
      rows.push({
        ...base,
        id: `auto-end-${prise.id}`,
        event_type: 'fin_service',
        time: prise.actual_end,
        latitude: prise.end_latitude,
        longitude: prise.end_longitude,
        photo_url: prise.end_photo_url,
        content: `Photo de fin de service\nPointage de fin de service : ${mode}`,
      });
    }
    for (const [index, pause] of (prise.pauses || []).entries()) {
      if (pause.start) {
        rows.push({
          ...base,
          id: `auto-pause-start-${prise.id}-${index}`,
          event_type: 'debut_pause',
          time: pause.start,
          content: `Début de pause à ${pause.start}`,
        });
      }
      if (pause.end) {
        rows.push({
          ...base,
          id: `auto-pause-end-${prise.id}-${index}`,
          event_type: 'fin_pause',
          time: pause.end,
          content: `Fin de pause à ${pause.end}${pause.minutes ? ` — ${pause.minutes} min` : ''}`,
        });
      }
    }
  }

  for (const execution of executions || []) {
    if (!execution) continue;
    const base = {
      site_id: execution.site_id,
      site_name: execution.site_name,
      client_id: execution.client_id,
      agent_name: execution.agent_name,
      mission_id: execution.mission_id,
      service_id: execution.service_id,
      date: execution.date,
      ronde_name: execution.ronde_name,
    };
    if (execution.start_time) {
      const when = `${formatDateFr(execution.date)} ${String(execution.start_time).slice(0, 5)}`;
      rows.push({
        ...base,
        id: `auto-ronde-start-${execution.id}`,
        event_type: 'debut_ronde',
        time: execution.start_time,
        latitude: execution.start_latitude,
        longitude: execution.start_longitude,
        content: `Ronde débutée à ${when}${execution.ronde_name ? ` - ${execution.ronde_name}` : ''}`,
      });
    }
    for (const [index, point] of (execution.checkpoints_done || []).entries()) {
      const name = point.checkpoint_name || 'Point de contrôle';
      rows.push({
        ...base,
        id: `auto-point-${execution.id}-${point.checkpoint_id || index}`,
        event_type: 'validation_point_controle',
        time: point.time || execution.start_time,
        latitude: point.latitude,
        longitude: point.longitude,
        checkpoint_name: name,
        nfc_serial: point.nfc_serial || '',
        note: point.note || '',
        content: `Point de contrôle validé par lecture ${point.nfc_validated ? 'NFC' : 'manuelle'}${execution.ronde_name ? ` - ${execution.ronde_name}` : ''} - ${name}`,
      });
    }
    if (execution.end_time) {
      const when = `${formatDateFr(execution.date)} ${String(execution.end_time).slice(0, 5)}`;
      rows.push({
        ...base,
        id: `auto-ronde-end-${execution.id}`,
        event_type: 'fin_ronde',
        time: execution.end_time,
        latitude: execution.end_latitude,
        longitude: execution.end_longitude,
        content: `Ronde terminée à ${when}${execution.ronde_name ? ` - ${execution.ronde_name}` : ''}`,
      });
    }
  }
  return rows;
}

function dedupeKey(row) {
  const point = row.checkpoint_name ? `|${row.checkpoint_name}` : '';
  return [
    row.date || '',
    formatTime(row.time).slice(0, 5),
    eventKey(row),
    row.service_id || row.source_ref || '',
    point,
  ].join('|');
}

export function buildMainCouranteLines({
  entries = [],
  prises = [],
  executions = [],
  missions = [],
  start,
  end,
  siteIds = null,
} = {}) {
  const prisesById = Object.fromEntries(prises.filter((prise) => prise?.id).map((prise) => [prise.id, prise]));
  const missionsById = Object.fromEntries(missions.filter((mission) => mission?.id).map((mission) => [mission.id, mission]));
  const allowed = siteIds?.length ? new Set(siteIds) : null;
  const inPeriod = (row) => {
    const date = String(row.date || '').slice(0, 10);
    if (!date) return false;
    if (start && date < start) return false;
    if (end && date > end) return false;
    if (allowed && row.site_id && !allowed.has(row.site_id)) return false;
    return true;
  };

  const seen = new Map();
  const source = [...synthesize(prises, executions), ...entries];
  for (const row of source) {
    if (!inPeriod(row)) continue;
    const key = dedupeKey(row);
    const previous = seen.get(key);
    if (!previous) {
      seen.set(key, { ...row });
      continue;
    }
    if (!previous.latitude && row.latitude) {
      previous.latitude = row.latitude;
      previous.longitude = row.longitude;
    }
    if (!previous.photo_url && row.photo_url) previous.photo_url = row.photo_url;
    if (!previous.nfc_serial && row.nfc_serial) previous.nfc_serial = row.nfc_serial;
    if (!previous.note && row.note) previous.note = row.note;
  }

  const lines = [];
  for (const row of seen.values()) {
    const prise = prisesById[row.service_id] || null;
    lines.push({
      site_id: row.site_id || prise?.site_id || '',
      site_name: row.site_name || prise?.site_name || '',
      client_id: row.client_id || prise?.client_id || '',
      date: String(row.date || '').slice(0, 10),
      time: formatTime(row.time),
      ref: shortRef(row.id),
      type: eventLabel(row),
      description: descriptionOf(row),
      gps: formatGps(row.latitude, row.longitude),
      collaborateur: formatCollaborateur(row.agent_name),
      hours: shiftHours(row, prisesById, missionsById),
    });
  }

  lines.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  return lines;
}

function siteSlug(name) {
  return String(name || 'site')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'site';
}

export function pdfsForSites({
  company, sites = [], clients = [], entries = [], prises = [], executions = [], missions = [],
  start, end, editionLabel, editionTime,
}) {
  const files = [];
  for (const site of sites) {
    const lines = buildMainCouranteLines({
      entries, prises, executions, missions, start, end, siteIds: [site.id],
    });
    if (!lines.length) continue;
    const content = renderMainCourantePdf({
      company,
      sites: [site],
      clients,
      lines,
      start,
      end,
      editionLabel,
      editionTime,
      reportNumber: String(end || '').replace(/-/g, '').slice(2),
    });
    files.push({
      siteId: site.id,
      clientId: site.client_id || null,
      filename: `rapport-main-courante-${siteSlug(site.name)}-${formatDateFr(start).replaceAll('/', '-')}-${formatDateFr(end).replaceAll('/', '-')}.pdf`,
      content,
    });
  }
  return files;
}

function addressOf(record) {
  return [
    record?.address,
    [record?.postal_code, record?.city].filter(Boolean).join(' '),
    record?.country,
  ].filter(Boolean).join(', ');
}

function drawWrapped(doc, text, x, y, width) {
  const lines = doc.splitTextToSize(String(text || ''), width);
  lines.forEach((line, index) => doc.text(line, x, y + index * 3.4));
  return Math.max(lines.length, 1) * 3.4;
}

function paintFooter(doc, company) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const pages = doc.internal.getNumberOfPages();
  const name = company?.company_name || 'Phoenix Sekur';
  const address = addressOf(company);
  const phone = company?.phone ? `Tél : ${company.phone}` : '';
  const email = company?.email ? `@ : ${company.email}` : '';
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30);
    let y = pageH - 24;
    doc.text(name, 12, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    y += 4;
    if (address) { doc.text(address, 12, y); y += 4; }
    if (phone) { doc.text(phone, 12, y); y += 4; }
    if (email) doc.text(email, 12, y);
    doc.text(`${page}/${pages}`, pageW - 12, pageH - 12, { align: 'right' });
    if (page === pages) {
      const legal = [
        company?.cnaps_number ? `Numéro d'autorisation CNAPS : ${company.cnaps_number}` : '',
        company?.siret ? `SIRET N°${company.siret}` : '',
        "Art. L612-14 du CSI (Code de Sécurité Intérieure) : L'autorisation d'exercice ne confère aucune prérogative de puissance publique à l'entreprise ou aux personnes qui en bénéficient.",
      ].filter(Boolean);
      if (legal.length) {
        doc.setFontSize(6.5);
        doc.setTextColor(80);
        let ly = pageH - 28 - legal.length * 3.2;
        legal.forEach((line) => {
          const wrapped = doc.splitTextToSize(line, pageW - 24);
          wrapped.forEach((part) => {
            doc.text(part, 12, ly);
            ly += 3.2;
          });
        });
      }
    }
  }
}

export function renderMainCourantePdf({
  company,
  sites = [],
  clients = [],
  lines = [],
  start,
  end,
  editionLabel,
  editionTime,
  reportNumber,
}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const clientsById = Object.fromEntries(clients.filter((client) => client?.id).map((client) => [client.id, client]));
  const sitesById = Object.fromEntries(sites.filter((site) => site?.id).map((site) => [site.id, site]));
  const groups = new Map();
  for (const line of lines) {
    const key = line.site_id || '_';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(line);
  }
  if (!groups.size) groups.set('_', []);

  const columns = [
    { title: 'Date / Réf.\nMCE', width: 28 },
    { title: 'Type', width: 32 },
    { title: 'Description', width: 70 },
    { title: 'GPS - Lat/Long', width: 24 },
    { title: 'Collaborateur /\nHeures', width: 28 },
  ];

  let first = true;
  for (const [siteId, siteLines] of groups) {
    if (!first) doc.addPage();
    first = false;
    const site = sitesById[siteId] || {};
    const client = clientsById[site.client_id] || clientsById[siteLines[0]?.client_id] || null;
    const clientName = client?.company_name || site.client_name || siteLines[0]?.client_name || '';
    let y = 14;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(20);
    doc.text('RAPPORT DE MAIN COURANTE', 12, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Du ${formatDateFr(start)} au ${formatDateFr(end)}`, 12, y);
    doc.text(`Edition du ${editionLabel || formatDateFr(end)} ${editionTime || ''}`.trim(), pageW - 12, y, { align: 'right' });
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text(`N° ${reportNumber || String(end || '').replace(/-/g, '').slice(2)}`, 12, y);
    y += 7;
    doc.setFontSize(11);
    const siteTitle = `${site.name || siteLines[0]?.site_name || 'Site'}${clientName ? ` ( Client : ${clientName} )` : ''}`;
    doc.text(siteTitle, 12, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const siteAddress = addressOf(site);
    if (siteAddress) {
      doc.text(siteAddress, 12, y);
      y += 6;
    }

    const drawHeader = () => {
      doc.setFillColor(245, 245, 245);
      doc.rect(12, y, pageW - 24, 10, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(40);
      let x = 13;
      columns.forEach((column) => {
        const parts = column.title.split('\n');
        parts.forEach((part, index) => doc.text(part, x, y + 4 + index * 3));
        x += column.width;
      });
      y += 12;
    };
    drawHeader();

    if (!siteLines.length) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.text('Aucun événement sur cette période.', 12, y + 4);
    }
    for (const line of siteLines) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      const heights = [
        drawMeasure(doc, `${line.time}\n${formatDateFr(line.date)}\n${line.ref}`, columns[0].width - 2),
        drawMeasure(doc, line.type, columns[1].width - 2),
        drawMeasure(doc, line.description, columns[2].width - 2),
        drawMeasure(doc, line.gps, columns[3].width - 2),
        drawMeasure(doc, `${line.collaborateur}\n${line.hours}`, columns[4].width - 2),
      ];
      const height = Math.max(...heights, 8) + 2;
      if (y + height > 250) {
        doc.addPage();
        y = 14;
        drawHeader();
      }
      let x = 13;
      const cells = [
        `${line.time}\n${formatDateFr(line.date)}\n${line.ref}`,
        line.type,
        line.description,
        line.gps,
        `${line.collaborateur}\n${line.hours}`,
      ];
      cells.forEach((cell, index) => {
        drawWrapped(doc, cell, x, y + 3, columns[index].width - 2);
        x += columns[index].width;
      });
      y += height;
      doc.setDrawColor(230);
      doc.line(12, y - 1, pageW - 12, y - 1);
    }
  }

  paintFooter(doc, company);
  return Buffer.from(doc.output('arraybuffer'));
}

function drawMeasure(doc, text, width) {
  return doc.splitTextToSize(String(text || ' '), width).length * 3.4;
}
