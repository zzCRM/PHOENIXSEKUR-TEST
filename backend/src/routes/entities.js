import { Router } from 'express';
import {
  ENTITY_MODELS,
  getEntityDelegate,
  toApiRecord,
  splitIncomingRecord,
  matchesFilter,
  generateId,
} from '../lib/prisma.js';

const router = Router();

// Base44-compatible entity API
// GET    /api/entities/:name          → list/filter
// GET    /api/entities/:name/:id      → get one
// POST   /api/entities/:name          → create
// PUT    /api/entities/:name/:id      → update
// DELETE /api/entities/:name/:id      → delete

router.get('/:entityName', async (req, res) => {
  try {
    const { entityName } = req.params;
    if (!ENTITY_MODELS[entityName]) {
      return res.status(404).json({ error: `Unknown entity: ${entityName}` });
    }

    const delegate = getEntityDelegate(entityName);
    const { q, sort, limit } = req.query;
    const query = q ? JSON.parse(q) : {};
    const take = limit ? parseInt(limit, 10) : undefined;

    const where = {};
    if (query.company_id) where.companyId = query.company_id;

    const rows = await delegate.findMany({
      where: Object.keys(where).length ? where : undefined,
      take: take && !isNaN(take) ? take : undefined,
      orderBy: sort?.startsWith('-')
        ? { updatedAt: 'desc' }
        : { updatedAt: 'asc' },
    });

    let records = rows.map(toApiRecord);

    // Apply remaining filters in-memory (JSON fields)
    const extraFilters = { ...query };
    delete extraFilters.company_id;
    if (Object.keys(extraFilters).length > 0) {
      records = records.filter((r) => matchesFilter(r, extraFilters));
    }

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
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(toApiRecord(row));
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

    const row = await delegate.create({
      data: {
        id,
        companyId: parsed.companyId || 'default',
        data: parsed.data,
        createdById: parsed.createdById,
        createdBy: parsed.createdBy,
        isSample: parsed.isSample,
      },
    });

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
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const mergedData = {
      ...(typeof existing.data === 'object' ? existing.data : {}),
      ...parsed.data,
    };

    const row = await delegate.update({
      where: { id },
      data: {
        companyId: parsed.companyId ?? existing.companyId,
        data: mergedData,
        createdById: parsed.createdById ?? existing.createdById,
        createdBy: parsed.createdBy ?? existing.createdBy,
        isSample: parsed.isSample ?? existing.isSample,
      },
    });

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
    await delegate.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
