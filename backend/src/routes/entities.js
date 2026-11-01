import { Router } from 'express';
import {
  ENTITY_MODELS,
  getEntityDelegate,
  toApiRecord,
  splitIncomingRecord,
  matchesFilter,
  generateId,
  sortRecords,
  prisma,
} from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { isSuperAdmin } from '../lib/superadmin.js';
import { PLATFORM_COMPANY_ID, isPlatformCompanyId } from '../lib/tenant.js';
import { buildScope, canRead, canWrite, findAgentFiche, presentRecord } from '../lib/access.js';
import { ROLES_KIND } from '../../../shared/rolePermissions.js';

const router = Router();

router.use(requireAuth);

function tenantCompanyId(req, requested) {
  if (isSuperAdmin(req.user)) {
    return requested || null;
  }
  return req.user.companyId || null;
}

function assertCanAccessRow(req, row) {
  if (!row) return false;
  if (isSuperAdmin(req.user)) return true;
  return row.companyId && row.companyId === req.user.companyId;
}

async function scopeFor(req) {
  if (!req.user || isSuperAdmin(req.user) || req.user.role === 'admin') {
    return { ficheAgent: null, ficheClient: null, siteIds: new Set(), roles: [] };
  }
  const companyId = req.user.companyId;
  const [agents, clients, sites, settings] = await Promise.all([
    getEntityDelegate('Agent').findMany({ where: { companyId } }),
    getEntityDelegate('Client').findMany({ where: { companyId } }),
    getEntityDelegate('Site').findMany({ where: { companyId } }),
    getEntityDelegate('CompanySettings').findMany({ where: { companyId } }),
  ]);
  const agentRecords = agents.map(toApiRecord);
  const scope = buildScope(req.user, {
    agents: agentRecords,
    clients: clients.map(toApiRecord),
    sites: sites.map(toApiRecord),
  });
  if (!scope.ficheAgent) scope.ficheAgent = findAgentFiche(req.user, agentRecords);
  const rolesRow = settings.map(toApiRecord).find((row) => row.kind === ROLES_KIND || String(row.id || '').startsWith('roles-acces-'));
  scope.roles = Array.isArray(rolesRow?.roles) ? rolesRow.roles : [];
  return scope;
}

async function recordAudit(req, action, entity, entityId, companyId) {
  try {
    await prisma.auditLog.create({
      data: {
        companyId: companyId || req.user?.companyId || 'unknown',
        userId: req.user?.sub || null,
        email: req.user?.email || null,
        action,
        entity,
        entityId: entityId || null,
      },
    });
  } catch {
    // Migration non appliquée : l'opération métier n'est pas bloquée.
  }
}

router.get('/:entityName', async (req, res) => {
  try {
    const { entityName } = req.params;
    if (!ENTITY_MODELS[entityName]) {
      return res.status(404).json({ error: `Unknown entity: ${entityName}` });
    }

    const delegate = getEntityDelegate(entityName);
    const { q, sort, limit, skip } = req.query;
    const query = q ? JSON.parse(q) : {};

    const requestedCompany = query.company_id || null;
    const companyId = tenantCompanyId(req, requestedCompany);

    if (!isSuperAdmin(req.user) && !companyId) {
      return res.status(403).json({ error: 'Société requise' });
    }

    // Un admin société ne peut pas spoof company_id
    if (!isSuperAdmin(req.user) && requestedCompany && requestedCompany !== req.user.companyId) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const where = {};
    if (companyId) {
      where.companyId = companyId;
    } else if (isSuperAdmin(req.user)) {
      // Super Admin sans filtre : exclure la société plateforme technique
      where.companyId = { not: PLATFORM_COMPANY_ID };
    }

    const rows = await delegate.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: { createdAt: 'desc' },
    });

    let records = rows.map(toApiRecord);

    const extraFilters = { ...query };
    delete extraFilters.company_id;
    if (Object.keys(extraFilters).length > 0) {
      records = records.filter((r) => matchesFilter(r, extraFilters));
    }

    records = sortRecords(records, sort || '-created_date');
    const scope = await scopeFor(req);
    records = records
      .filter((record) => canRead(req.user, entityName, record, scope))
      .map((record) => presentRecord(req.user, entityName, record));

    const skipN = skip ? parseInt(skip, 10) : 0;
    const takeN = limit ? parseInt(limit, 10) : undefined;
    if (skipN > 0) records = records.slice(skipN);
    if (takeN && !isNaN(takeN)) records = records.slice(0, takeN);

    res.json(records);
  } catch (err) {
    console.error('Entity list error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:entityName/:id', async (req, res) => {
  try {
    const { entityName, id } = req.params;
    const delegate = getEntityDelegate(entityName);
    const row = await delegate.findUnique({ where: { id } });
    const record = row ? toApiRecord(row) : null;
    const scope = await scopeFor(req);
    if (!row || !assertCanAccessRow(req, row) || !canRead(req.user, entityName, record, scope)) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(presentRecord(req.user, entityName, record));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:entityName', async (req, res) => {
  try {
    const { entityName } = req.params;
    const delegate = getEntityDelegate(entityName);
    const parsed = splitIncomingRecord(req.body);
    const id = parsed.id || generateId();

    const requested = parsed.companyId || parsed.data?.company_id || null;
    let companyId = tenantCompanyId(req, requested);
    if (!isSuperAdmin(req.user)) {
      companyId = req.user.companyId;
    }
    if (!companyId || isPlatformCompanyId(companyId)) {
      return res.status(400).json({ error: 'Société requise' });
    }

    const preview = { ...parsed.data, id, company_id: companyId };
    const scope = await scopeFor(req);
    if (!canWrite(req.user, entityName, preview, 'create', scope)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const row = await delegate.create({
      data: {
        id,
        companyId,
        data: { ...parsed.data, company_id: companyId },
        createdById: parsed.createdById || req.user?.sub,
        createdBy: parsed.createdBy,
        isSample: parsed.isSample,
      },
    });

    await recordAudit(req, 'create', entityName, row.id, companyId);
    res.status(201).json(toApiRecord(row));
  } catch (err) {
    console.error('Entity create error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:entityName/:id', async (req, res) => {
  try {
    const { entityName, id } = req.params;
    const delegate = getEntityDelegate(entityName);
    const parsed = splitIncomingRecord({ ...req.body, id });

    const existing = await delegate.findUnique({ where: { id } });
    const scope = await scopeFor(req);
    if (!existing || !assertCanAccessRow(req, existing) || !canRead(req.user, entityName, toApiRecord(existing), scope)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const mergedData = {
      ...(typeof existing.data === 'object' ? existing.data : {}),
      ...parsed.data,
    };

    // Empêcher un admin société de changer companyId
    const nextCompanyId = isSuperAdmin(req.user)
      ? (parsed.companyId ?? existing.companyId)
      : existing.companyId;
    const nextRecord = { ...mergedData, id, company_id: nextCompanyId };
    if (!canWrite(req.user, entityName, nextRecord, 'update', scope)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const row = await delegate.update({
      where: { id },
      data: {
        companyId: nextCompanyId,
        data: { ...mergedData, company_id: nextCompanyId },
        createdById: parsed.createdById ?? existing.createdById,
        createdBy: parsed.createdBy ?? existing.createdBy,
        isSample: parsed.isSample ?? existing.isSample,
      },
    });

    await recordAudit(req, 'update', entityName, row.id, nextCompanyId);
    res.json(toApiRecord(row));
  } catch (err) {
    console.error('Entity update error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:entityName/:id', async (req, res) => {
  try {
    const { entityName, id } = req.params;
    const delegate = getEntityDelegate(entityName);
    const existing = await delegate.findUnique({ where: { id } });
    const scope = await scopeFor(req);
    const record = existing ? toApiRecord(existing) : null;
    if (!existing || !assertCanAccessRow(req, existing) || !canRead(req.user, entityName, record, scope)) {
      return res.status(404).json({ error: 'Not found' });
    }
    if (!canWrite(req.user, entityName, record, 'delete', scope)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    await delegate.delete({ where: { id } });
    await recordAudit(req, 'delete', entityName, id, existing.companyId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
