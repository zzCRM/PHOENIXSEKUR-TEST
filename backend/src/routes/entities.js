import { Router } from 'express';
import {
  ENTITY_MODELS,
  getEntityDelegate,
  toApiRecord,
  splitIncomingRecord,
  matchesFilter,
  generateId,
  sortRecords,
} from '../lib/prisma.js';

const router = Router();

router.get('/:entityName', async (req, res) => {
  try {
    const { entityName } = req.params;
    if (!ENTITY_MODELS[entityName]) {
      return res.status(404).json({ error: `Unknown entity: ${entityName}` });
    }

    const delegate = getEntityDelegate(entityName);
    const { q, sort, limit, skip } = req.query;
    const query = q ? JSON.parse(q) : {};

    const where = {};
    if (query.company_id) {
      where.OR = [
        { companyId: query.company_id },
        { companyId: 'default' },
      ];
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
    const companyId = parsed.companyId || parsed.data?.company_id || req.user?.companyId || 'default';

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
