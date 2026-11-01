import { getEntityDelegate, toApiRecord, prisma } from './prisma.js';
import {
  IntegrityError,
  checkPointeau,
  checkRonde,
  checkRondeExecution,
  normalizeNfcTag,
} from '../../../shared/pointeaux.js';

const sameJson = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

async function loadSite(companyId, siteId) {
  if (!siteId) return null;
  const row = await getEntityDelegate('Site').findUnique({ where: { id: String(siteId) } });
  if (!row || row.companyId !== companyId) return null;
  return toApiRecord(row);
}

async function loadPointeaux(companyId, ids) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (!unique.length) return new Map();
  const rows = await prisma.pointeau.findMany({ where: { companyId, id: { in: unique } } });
  return new Map(rows.map((row) => [row.id, toApiRecord(row)]));
}

async function ensureTagAvailable(companyId, tagKey, ownId) {
  if (!tagKey) return;
  const other = await prisma.pointeau.findFirst({
    where: { companyId, tagKey, ...(ownId ? { id: { not: ownId } } : {}) },
  });
  if (other) {
    const data = toApiRecord(other);
    throw new IntegrityError(
      'tag_deja_utilise',
      `Ce tag NFC est déjà utilisé par le pointeau « ${data.name || other.id} » (${data.site_name || 'autre site'}).`,
      409,
    );
  }
}

async function rondesUsingPointeau(companyId, pointeauId) {
  const rows = await getEntityDelegate('Ronde').findMany({ where: { companyId } });
  return rows
    .map(toApiRecord)
    .filter((ronde) => (ronde.points || []).some((entry) => entry.pointeau_id === pointeauId));
}

async function executionCount(companyId, where) {
  return getEntityDelegate('RondeExecution').count({ where: { companyId, data: where } });
}

export async function findDuplicateByClientEventId(entityName, companyId, data) {
  const clientEventId = typeof data?.client_event_id === 'string' ? data.client_event_id : '';
  if (!clientEventId) return null;
  return getEntityDelegate(entityName).findFirst({
    where: { companyId, data: { path: ['client_event_id'], equals: clientEventId } },
  });
}

export async function beforeWrite({ entityName, operation, companyId, id, incoming, previous }) {
  const previousData = previous && typeof previous.data === 'object' ? { ...previous.data } : null;
  const next = { ...(previousData || {}), ...incoming };

  if (entityName === 'Pointeau') {
    if (operation === 'delete') {
      const rondes = await rondesUsingPointeau(companyId, id);
      const used = rondes.length > 0
        || (await executionCount(companyId, { path: ['checkpoints_done'], array_contains: [{ pointeau_id: id }] })) > 0;
      if (used) {
        throw new IntegrityError('pointeau_utilise', 'Ce pointeau est utilisé par des rondes ou possède un historique de passages : archivez-le plutôt que de le supprimer.', 409);
      }
      return {};
    }
    const site = await loadSite(companyId, next.site_id);
    const sites = (await getEntityDelegate('Site').findMany({ where: { companyId } })).map(toApiRecord);
    const checked = checkPointeau({ next, previous: previousData, site, sites });
    await ensureTagAvailable(companyId, checked.columns.tagKey, id);
    if (previousData?.status === 'actif' && checked.data.status !== 'actif') {
      const rondes = (await rondesUsingPointeau(companyId, id)).filter((ronde) => ronde.status !== 'inactif');
      if (rondes.length) {
        throw new IntegrityError(
          'pointeau_dans_rondes',
          `Ce pointeau est utilisé par des rondes actives : ${rondes.map((ronde) => `« ${ronde.name} »`).join(', ')}. Retirez-le de ces rondes avant de le désactiver.`,
          409,
          { rondes: rondes.map((ronde) => ronde.id) },
        );
      }
    }
    return checked;
  }

  if (entityName === 'Ronde') {
    if (operation === 'delete') {
      if ((await executionCount(companyId, { path: ['ronde_id'], equals: id })) > 0) {
        throw new IntegrityError('ronde_avec_historique', 'Cette ronde a déjà été effectuée : passez-la en inactive pour conserver son historique.', 409);
      }
      return {};
    }
    const changedKeys = Object.keys(incoming).filter((key) => !sameJson(incoming[key], previousData?.[key]));
    const site = await loadSite(companyId, next.site_id);
    const ids = Array.isArray(next.points) ? next.points.map((entry) => entry?.pointeau_id) : [];
    const pointeauxById = await loadPointeaux(companyId, ids);
    return checkRonde({ next, previous: previousData, changedKeys, site, pointeauxById, operation });
  }

  if (entityName === 'RondeExecution' && operation === 'create') {
    const libre = next.type === 'libre' || next.ronde_libre === true;
    const site = await loadSite(companyId, next.site_id);
    const rondeRow = !libre && next.ronde_id && !String(next.ronde_id).startsWith('libre-')
      ? await getEntityDelegate('Ronde').findUnique({ where: { id: String(next.ronde_id) } })
      : null;
    const ronde = rondeRow && rondeRow.companyId === companyId ? toApiRecord(rondeRow) : null;
    const ids = (Array.isArray(next.checkpoints_done) ? next.checkpoints_done : [])
      .map((entry) => entry?.pointeau_id || entry?.checkpoint_id);
    const pointeauxById = await loadPointeaux(companyId, ids);
    const checked = checkRondeExecution({ next, ronde, site, pointeauxById });
    const receivedAt = new Date();
    const sentAt = Date.parse(next.client_sent_at || '');
    return {
      data: {
        ...checked.data,
        client_id: checked.data.client_id || site?.client_id || ronde?.client_id || '',
        received_at: receivedAt.toISOString(),
        ...(Number.isFinite(sentAt) ? { clock_skew_seconds: Math.round((receivedAt.getTime() - sentAt) / 1000) } : {}),
      },
    };
  }

  if (entityName === 'Site' && operation === 'delete') {
    const [pointeaux, rondes] = await Promise.all([
      prisma.pointeau.count({ where: { companyId, siteId: id } }),
      getEntityDelegate('Ronde').count({ where: { companyId, data: { path: ['site_id'], equals: id } } }),
    ]);
    if (pointeaux || rondes) {
      throw new IntegrityError(
        'site_avec_rondes',
        `Ce site possède ${pointeaux} pointeau(x) et ${rondes} ronde(s) : supprimez-les ou archivez-les avant de supprimer le site.`,
        409,
      );
    }
    return {};
  }

  return {};
}

export { normalizeNfcTag };
