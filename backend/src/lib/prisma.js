import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Maps Base44 entity names → Prisma model delegates
export const ENTITY_MODELS = {
  Agent: 'agent',
  Alerte: 'alerte',
  BonIntervention: 'bonIntervention',
  CahierConsignes: 'cahierConsignes',
  Client: 'client',
  CompanySettings: 'companySettings',
  Conge: 'conge',
  Contrat: 'contrat',
  Demande: 'demande',
  Document: 'document',
  FicheDePaie: 'ficheDePaie',
  Geolocation: 'geolocation',
  Invoice: 'invoice',
  Lead: 'lead',
  MainCourante: 'mainCourante',
  Mission: 'mission',
  PostePlanning: 'postePlanning',
  PretMateriel: 'pretMateriel',
  PriseDeService: 'priseDeService',
  Ronde: 'ronde',
  RondeExecution: 'rondeExecution',
  Site: 'site',
  User: 'appUser',
};

export function getEntityDelegate(entityName) {
  const model = ENTITY_MODELS[entityName];
  if (!model || !prisma[model]) {
    throw new Error(`Unknown entity: ${entityName}`);
  }
  return prisma[model];
}

const META_KEYS = new Set([
  'id',
  'company_id',
  'created_date',
  'updated_date',
  'created_by_id',
  'created_by',
  'is_sample',
]);

export function toApiRecord(row) {
  if (!row) return null;
  const data = typeof row.data === 'object' && row.data !== null ? row.data : {};
  const payload = { ...data };

  // Avoid duplicating indexed fields inside payload
  for (const key of META_KEYS) {
    delete payload[key];
  }

  return {
    ...payload,
    id: row.id,
    company_id: row.companyId ?? payload.company_id ?? null,
    created_date: row.createdAt?.toISOString?.() ?? row.createdAt,
    updated_date: row.updatedAt?.toISOString?.() ?? row.updatedAt,
    created_by_id: row.createdById ?? null,
    created_by: row.createdBy ?? null,
    is_sample: row.isSample ?? false,
  };
}

export function splitIncomingRecord(body) {
  const {
    id,
    company_id,
    created_date,
    updated_date,
    created_by_id,
    created_by,
    is_sample,
    ...rest
  } = body;

  return {
    id,
    companyId: company_id ?? rest.company_id ?? null,
    createdById: created_by_id ?? null,
    createdBy: created_by ?? null,
    isSample: is_sample === true || is_sample === 'true',
    data: rest,
  };
}

export function matchesFilter(record, query) {
  return Object.entries(query).every(([key, value]) => {
    const actual = record[key];
    if (value === null || value === undefined) return actual == null;
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(actual) === JSON.stringify(value);
    }
    return String(actual) === String(value);
  });
}

export function sortRecords(records, sort) {
  if (!sort) return records;
  const desc = sort.startsWith('-');
  const field = desc ? sort.slice(1) : sort;

  return [...records].sort((a, b) => {
    const av = a[field] ?? '';
    const bv = b[field] ?? '';
    if (av === bv) return 0;
    const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
    return desc ? -cmp : cmp;
  });
}

export function generateId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
