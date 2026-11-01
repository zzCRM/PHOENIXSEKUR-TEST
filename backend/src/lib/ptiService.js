import { generateId } from './ids.js';
import {
  advancePtiAlert,
  applyPtiAction,
  buildReceivedAlert,
  canConfigurePti,
  canHandlePti,
  canTriggerPti,
  defaultPtiConfig,
  readClientAlert,
  resolvePtiConfig,
  sanitizePtiConfig,
} from './ptiRules.js';

export function ptiConfigId(companyId) {
  return `pti-config-${companyId}`;
}

function rowRecord(row) {
  if (!row) return null;
  const data = row.data && typeof row.data === 'object' ? row.data : {};
  return { ...data, id: row.id, company_id: row.companyId ?? data.company_id ?? null };
}

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

async function loadRaw(db, companyId) {
  const row = await db.companySettings.findUnique({ where: { id: ptiConfigId(companyId) } });
  if (!row || row.companyId !== companyId) return null;
  const data = row.data && typeof row.data === 'object' ? row.data : {};
  if (data.kind !== 'pti_config') return null;
  return data.config || null;
}

export async function getPtiConfig(db, user) {
  if (!canHandlePti(user)) fail(403, 'Accès refusé');
  const saved = await loadRaw(db, user.companyId);
  return {
    config: sanitizePtiConfig(saved || defaultPtiConfig()),
    can_edit: canConfigurePti(user),
  };
}

export async function savePtiConfig(db, user, input) {
  if (!canConfigurePti(user)) fail(403, 'Seul un administrateur modifie le paramétrage PTI');
  const clean = sanitizePtiConfig(input);
  const id = ptiConfigId(user.companyId);
  const data = {
    kind: 'pti_config',
    config: clean,
    updated_by: user.sub || user.id || null,
  };
  await db.companySettings.upsert({
    where: { id },
    create: {
      id,
      companyId: user.companyId,
      data,
      createdById: user.sub || user.id || null,
      createdBy: user.email || null,
      isSample: false,
    },
    update: { data, companyId: user.companyId },
  });
  return { config: clean, can_edit: true };
}

export async function getEffectivePti(db, user, query = {}) {
  if (!canTriggerPti(user)) fail(403, 'Accès refusé');
  const saved = await loadRaw(db, user.companyId);
  const config = sanitizePtiConfig(saved || defaultPtiConfig());
  const ownIds = await agentIdsFor(db, user);
  const agentId = ownIds ? [...ownIds][0] : (query.agent_id || null);
  if (ownIds && query.agent_id && !ownIds.has(String(query.agent_id))) fail(403, 'Accès refusé');
  return resolvePtiConfig(config, {
    agentId: ownIds ? (query.agent_id && ownIds.has(String(query.agent_id)) ? String(query.agent_id) : agentId) : query.agent_id,
    siteId: query.site_id || null,
    missionId: query.mission_id || null,
    siteRadius: query.site_radius,
  });
}

async function agentIdsFor(db, user) {
  if (canHandlePti(user)) return null;
  const ids = new Set([String(user.sub || user.id || '')].filter(Boolean));
  if (!db.agent?.findMany) return ids;
  const rows = await db.agent.findMany({ where: { companyId: user.companyId } });
  const email = String(user.email || '').toLowerCase();
  for (const row of rows) {
    const data = row.data && typeof row.data === 'object' ? row.data : {};
    if (email && String(data.email || '').toLowerCase() === email) ids.add(row.id);
  }
  return ids;
}

async function listCompanyAlerts(db, companyId) {
  const rows = await db.alerte.findMany({ where: { companyId } });
  return rows.map(rowRecord).filter((record) => record?.pti === true && record.company_id === companyId);
}

export async function submitPtiAlert(db, user, body, now = new Date().toISOString()) {
  if (!canTriggerPti(user)) fail(403, 'Accès refusé');
  const role = user.role;
  const isAgent = role === 'agent' || role === 'user' || role === 'collaborateur';
  if (!isAgent) fail(403, 'Seul l’agent déclenche une alerte PTI');
  const input = readClientAlert(body);
  if (!input.type) fail(400, 'Type d’alerte invalide');
  if (!input.client_event_id) fail(400, 'Identifiant d’alerte requis');
  const ownIds = await agentIdsFor(db, user);
  if (input.agent_id && ownIds && !ownIds.has(input.agent_id)) fail(403, 'Alerte limitée à votre fiche');
  if (!input.agent_id) input.agent_id = user.sub || user.id;

  const existing = (await listCompanyAlerts(db, user.companyId))
    .find((record) => record.client_event_id === input.client_event_id);
  if (existing) return existing;

  const saved = await loadRaw(db, user.companyId);
  const effective = resolvePtiConfig(saved || defaultPtiConfig(), {
    agentId: input.agent_id,
    siteId: input.site_id,
    missionId: input.mission_id,
  });
  const record = buildReceivedAlert({
    id: generateId('pti'),
    companyId: user.companyId,
    actor: { id: user.sub || user.id, email: user.email, name: input.agent_name || user.email },
    input,
    effective,
    now,
  });
  await db.alerte.create({
    data: {
      id: record.id,
      companyId: user.companyId,
      data: record,
      createdById: user.sub || user.id || null,
      createdBy: user.email || null,
      isSample: false,
    },
  });
  return record;
}

export async function listPtiAlerts(db, user, { tests = false } = {}) {
  if (!canHandlePti(user)) {
    if (!canTriggerPti(user)) fail(403, 'Accès refusé');
    const ownIds = await agentIdsFor(db, user);
    const all = await listCompanyAlerts(db, user.companyId);
    return all.filter((record) => !record.is_test && ownIds.has(String(record.agent_id || '')));
  }
  const all = await listCompanyAlerts(db, user.companyId);
  if (tests) return all.filter((record) => record.is_test);
  return all.filter((record) => !record.is_test);
}

async function loadOwnedAlert(db, user, id) {
  const row = await db.alerte.findUnique({ where: { id } });
  const record = rowRecord(row);
  if (!row || !record?.pti || record.company_id !== user.companyId || row.companyId !== user.companyId) {
    fail(404, 'Alerte introuvable');
  }
  return { row, record };
}

export async function actOnPtiAlert(db, user, id, body = {}, now = new Date().toISOString()) {
  if (!canHandlePti(user)) fail(403, 'Seul l’encadrement traite une alerte');
  const { record } = await loadOwnedAlert(db, user, id);
  const next = applyPtiAction(record, body.action, {
    actor: { id: user.sub || user.id, email: user.email, name: user.email },
    detail: body.detail,
    result: body.result,
    motif: body.motif,
    now,
  });
  await db.alerte.update({
    where: { id },
    data: { data: { ...next, company_id: user.companyId } },
  });
  let phone = null;
  if (body.action === 'contact' && db.agent?.findUnique) {
    const agentRow = await db.agent.findUnique({ where: { id: record.agent_id } });
    const data = agentRow?.data && typeof agentRow.data === 'object' ? agentRow.data : {};
    if (agentRow && agentRow.companyId === user.companyId) phone = data.phone || data.phone2 || null;
  }
  return { alert: next, phone };
}

export async function applyPtiDue(db, user, now = new Date().toISOString()) {
  if (!canHandlePti(user)) fail(403, 'Accès refusé');
  const alerts = await listPtiAlerts(db, user, { tests: false });
  const updated = [];
  for (const alert of alerts) {
    const step = advancePtiAlert(alert, now);
    if (!step.changed) continue;
    await db.alerte.update({
      where: { id: alert.id },
      data: { data: { ...step.alert, company_id: user.companyId } },
    });
    updated.push(step.alert);
  }
  return updated;
}
