const STAFF = new Set(['admin', 'supervisor']);
const AGENT_ROLES = new Set(['agent', 'user', 'collaborateur']);
const SENSITIVE = ['iban', 'bic', 'numero_securite_sociale', 'groupe_sanguin'];
const SITE_SECRETS = ['cles', 'alarmes', 'nfc_tag_id', 'checkpoints_service'];
const AGENT_WRITE = new Set(['PriseDeService', 'MainCourante', 'Demande', 'RondeExecution', 'Geolocation']);

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

export function isSuperAdminRole(user) {
  return user?.role === 'superadmin';
}

export function isStaffRole(user) {
  return isSuperAdminRole(user) || STAFF.has(user?.role);
}

export function isAgentRole(user) {
  return AGENT_ROLES.has(user?.role);
}

export function canAssignRole(actor, role) {
  if (!actor?.role || !role) return false;
  if (role === 'superadmin') return false;
  if (actor.role === 'supervisor') return false;
  if (actor.role === 'admin') return role === 'user' || role === 'agent' || role === 'client';
  if (actor.role === 'superadmin') return role === 'admin' || role === 'supervisor' || role === 'user' || role === 'agent' || role === 'client';
  return false;
}

function emailOf(user) {
  return String(user?.email || '').toLowerCase();
}

export function findAgentFiche(user, agents) {
  const email = emailOf(user);
  return (agents || []).find((agent) => String(agent.email || '').toLowerCase() === email) || null;
}

export function findClientFiche(user, clients) {
  const email = emailOf(user);
  return (clients || []).find((client) => {
    if (client.user_id && client.user_id === user?.id) return true;
    if (String(client.email || '').toLowerCase() === email) return true;
    return (client.comptes_clients || []).some((account) => String(account.email || '').toLowerCase() === email);
  }) || null;
}

export function buildScope(user, { agents = [], clients = [], sites = [] } = {}) {
  const ficheAgent = findAgentFiche(user, agents);
  const ficheClient = findClientFiche(user, clients);
  const siteIds = new Set();
  if (ficheAgent) {
    for (const site of sites) {
      const ids = site.agent_ids || [];
      if (ids.includes(ficheAgent.id) || ids.includes(user?.id)) siteIds.add(site.id);
    }
  }
  if (ficheClient) {
    const allowed = ficheClient.portal_perms?.sites_accessibles;
    const restricted = Array.isArray(allowed) && allowed.length > 0;
    for (const site of sites) {
      if (site.client_id !== ficheClient.id) continue;
      if (restricted && !allowed.includes(site.id)) continue;
      siteIds.add(site.id);
    }
  }
  return { ficheAgent, ficheClient, siteIds };
}

function ownAgent(record, user, scope) {
  const ids = new Set([user?.id, scope.ficheAgent?.id].filter(Boolean));
  if (ids.has(record.agent_id) || ids.has(record.id) || ids.has(record.target_id)) return true;
  return (record.agent_ids || []).some((id) => ids.has(id));
}

function onAgentSite(record, scope) {
  return Boolean(record.site_id) && scope.siteIds.has(record.site_id);
}

export function canRead(user, entity, record, scope = { siteIds: new Set() }) {
  if (!user || !record) return false;
  if (!isSuperAdminRole(user) && record.company_id !== user.companyId) return false;
  if (isSuperAdminRole(user) || user.role === 'admin' || user.role === 'supervisor') return true;
  if (isAgentRole(user)) {
    if (entity === 'Agent') return record.id === scope.ficheAgent?.id;
    if (entity === 'CompanySettings') return true;
    if (entity === 'Site') return scope.siteIds.has(record.id) || ownAgent(record, user, scope);
    if (entity === 'Mission' || entity === 'PriseDeService' || entity === 'FicheDePaie' || entity === 'RondeExecution' || entity === 'Geolocation' || entity === 'Conge') {
      return ownAgent(record, user, scope);
    }
    if (entity === 'Ronde' || entity === 'MainCourante' || entity === 'CahierConsignes' || entity === 'BonIntervention' || entity === 'PostePlanning') {
      return onAgentSite(record, scope);
    }
    if (entity === 'Document') {
      if (record.target_type === 'tous') return true;
      return record.target_type === 'agent' && (record.target_id === user.id || record.target_id === scope.ficheAgent?.id);
    }
    if (entity === 'Demande') return record.from_type === 'agent' && (record.from_id === user.id || record.from_id === scope.ficheAgent?.id);
    return false;
  }
  if (user.role === 'client') {
    const clientId = scope.ficheClient?.id;
    if (!clientId) return false;
    if (entity === 'Client') return record.id === clientId;
    if (entity === 'CompanySettings') return true;
    if (entity === 'Site') return scope.siteIds.has(record.id);
    if (entity === 'Mission' || entity === 'MainCourante' || entity === 'Ronde' || entity === 'BonIntervention') return onAgentSite(record, scope);
    if (entity === 'Invoice') return record.client_id === clientId;
    if (entity === 'Document') {
      if (record.target_id && record.target_id !== clientId) return false;
      return record.target_type === 'tous' || record.target_type === 'client';
    }
    if (entity === 'Demande') return record.from_type === 'client' && record.from_id === user.id;
    return false;
  }
  return false;
}

export function canWrite(user, entity, record, operation, scope = { siteIds: new Set() }) {
  if (!canRead(user, entity, record, scope) && operation === 'create') {
    if (!user || (!isSuperAdminRole(user) && record.company_id !== user.companyId)) return false;
  } else if (!user) return false;
  if (!isSuperAdminRole(user) && record.company_id !== user.companyId) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'supervisor') return operation !== 'delete' && entity !== 'Invoice' && entity !== 'FicheDePaie' && entity !== 'User';
  if (isAgentRole(user)) {
    if (operation === 'delete') return false;
    if (!AGENT_WRITE.has(entity)) return false;
    return canRead(user, entity, record, scope);
  }
  if (user.role === 'client') {
    return operation === 'create' && entity === 'Demande' && record.from_type === 'client' && record.from_id === user.id;
  }
  if (isSuperAdminRole(user)) return true;
  return false;
}

export function presentRecord(user, entity, record) {
  if (!record) return record;
  const copy = { ...record };
  if (user?.role !== 'admin' && user?.role !== 'superadmin') {
    for (const key of SENSITIVE) delete copy[key];
  }
  if (user?.role === 'client' && entity === 'Site') {
    for (const key of SITE_SECRETS) delete copy[key];
  }
  return copy;
}

export function reportCompanyId(user, requested) {
  if (!user) return null;
  if (user.role === 'superadmin') return requested || null;
  if (user.role !== 'admin') return null;
  if (requested && requested !== user.companyId) return null;
  return user.companyId || null;
}
