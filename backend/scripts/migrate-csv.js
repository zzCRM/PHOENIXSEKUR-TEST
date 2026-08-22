#!/usr/bin/env node
/**
 * Import CSV exports into PostgreSQL (replaces Base44 data store).
 * Usage: node scripts/migrate-csv.js [path-to-csv-folder]
 */
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { ENTITY_MODELS, splitIncomingRecord, generateId } from '../src/lib/prisma.js';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.argv[2] || join(__dirname, '../../base44-export/data/exports');

const prisma = new PrismaClient();

const FILE_TO_ENTITY = {
  'Agent_export.csv': 'Agent',
  'Alerte_export.csv': 'Alerte',
  'BonIntervention_export.csv': 'BonIntervention',
  'CahierConsignes_export.csv': 'CahierConsignes',
  'Client_export.csv': 'Client',
  'CompanySettings_export.csv': 'CompanySettings',
  'Conge_export.csv': 'Conge',
  'Contrat_export.csv': 'Contrat',
  'Demande_export.csv': 'Demande',
  'Document_export.csv': 'Document',
  'FicheDePaie_export.csv': 'FicheDePaie',
  'Geolocation_export.csv': 'Geolocation',
  'Invoice_export.csv': 'Invoice',
  'Lead_export.csv': 'Lead',
  'MainCourante_export.csv': 'MainCourante',
  'Mission_export.csv': 'Mission',
  'PostePlanning_export.csv': 'PostePlanning',
  'PretMateriel_export.csv': 'PretMateriel',
  'PriseDeService_export.csv': 'PriseDeService',
  'RondeExecution_export.csv': 'RondeExecution',
  'Ronde_export.csv': 'Ronde',
  'Site_export.csv': 'Site',
};

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = false;
      } else current += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { result.push(current); current = ''; }
    else current += c;
  }
  result.push(current);
  return result;
}

function parseCSV(content) {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (!values.length || (values.length === 1 && values[0] === '')) continue;
    const row = {};
    headers.forEach((h, idx) => {
      let val = values[idx] ?? '';
      if (val === '') { row[h] = val; return; }
      if ((val.startsWith('[') && val.endsWith(']')) || (val.startsWith('{') && val.endsWith('}'))) {
        try { val = JSON.parse(val); } catch { /* keep string */ }
      } else if (val === 'true' || val === 'false') val = val === 'true';
      row[h] = val;
    });
    rows.push(row);
  }
  return rows;
}

async function importRows(entityName, rows) {
  const model = ENTITY_MODELS[entityName];
  const delegate = prisma[model];
  let imported = 0;

  for (const row of rows) {
    const parsed = splitIncomingRecord(row);
    const id = parsed.id || generateId();
    const companyId = parsed.companyId || parsed.data?.company_id || 'default';

    await delegate.upsert({
      where: { id },
      create: {
        id,
        companyId,
        data: parsed.data,
        createdById: parsed.createdById,
        createdBy: parsed.createdBy,
        isSample: parsed.isSample,
        ...(row.created_date ? { createdAt: new Date(row.created_date) } : {}),
        ...(row.updated_date ? { updatedAt: new Date(row.updated_date) } : {}),
      },
      update: {
        companyId,
        data: parsed.data,
        createdById: parsed.createdById,
        createdBy: parsed.createdBy,
        isSample: parsed.isSample,
      },
    });
    imported++;
  }
  return imported;
}

async function main() {
  console.log(`\n📦 Import CSV → PostgreSQL`);
  console.log(`   Source: ${DATA_DIR}\n`);

  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith('_export.csv'));
  let total = 0;

  for (const file of files.sort()) {
    const entityName = FILE_TO_ENTITY[file];
    if (!entityName) continue;

    const content = readFileSync(join(DATA_DIR, file), 'utf-8');
    const rows = parseCSV(content);
    if (rows.length === 0) {
      console.log(`⏭  ${entityName}: vide`);
      continue;
    }

    const n = await importRows(entityName, rows);
    console.log(`✓  ${entityName}: ${n} enregistrement(s)`);
    total += n;
  }

  console.log(`\n✅ ${total} enregistrements importés\n`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
