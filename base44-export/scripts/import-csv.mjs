#!/usr/bin/env node
/**
 * Import CSV exports into Base44 entities.
 * Requires BASE44_ACCESS_TOKEN env var (get it from Base44 app URL: ?access_token=...)
 *
 * Usage: BASE44_ACCESS_TOKEN=xxx node scripts/import-csv.mjs
 */
import { createClient } from '@base44/sdk';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../data/exports');

const APP_ID = process.env.VITE_BASE44_APP_ID || '69ebeeab8b7d7f109e7d5a6c';
const APP_BASE_URL = process.env.VITE_BASE44_APP_BASE_URL || 'https://phoenixsekur.base44.app';
const TOKEN = process.env.BASE44_ACCESS_TOKEN;

const SKIP_FIELDS = new Set(['created_by', 'created_by_id', 'is_sample']);

function parseCSV(content) {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const row = {};
    headers.forEach((h, idx) => {
      let val = values[idx] ?? '';
      if (val === '') {
        row[h] = val;
        return;
      }
      if ((val.startsWith('[') && val.endsWith(']')) || (val.startsWith('{') && val.endsWith('}'))) {
        try {
          val = JSON.parse(val);
        } catch {
          /* keep as string */
        }
      } else if (val === 'true' || val === 'false') {
        val = val === 'true';
      } else if (!isNaN(val) && val !== '' && !val.startsWith('0')) {
        const num = Number(val);
        if (!isNaN(num) && String(num) === val) val = num;
      }
      row[h] = val;
    });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      result.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current);
  return result;
}

function entityNameFromFile(filename) {
  return filename.replace('_export.csv', '');
}

async function importEntity(base44, entityName, rows) {
  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const row of rows) {
    const { id, ...rest } = row;
    const data = {};
    for (const [k, v] of Object.entries(rest)) {
      if (!SKIP_FIELDS.has(k)) data[k] = v;
    }

    try {
      if (id) {
        try {
          await base44.entities[entityName].update(id, data);
          updated++;
        } catch {
          await base44.entities[entityName].create({ ...data, id });
          created++;
        }
      } else {
        await base44.entities[entityName].create(data);
        created++;
      }
    } catch (err) {
      errors++;
      console.error(`  ✗ ${entityName} ${id || '(new)'}: ${err.message || err}`);
    }
  }

  return { created, updated, errors };
}

async function main() {
  if (!TOKEN) {
    console.log('⚠️  BASE44_ACCESS_TOKEN non défini — import ignoré.');
    console.log('   Pour importer: BASE44_ACCESS_TOKEN=xxx node scripts/import-csv.mjs');
    console.log('   (Token disponible dans l\'URL Base44: ?access_token=...)');
    process.exit(0);
  }

  const base44 = createClient({
    appId: APP_ID,
    token: TOKEN,
    appBaseUrl: APP_BASE_URL,
    requiresAuth: true,
  });

  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith('_export.csv'));
  console.log(`\n📦 Import de ${files.length} fichiers CSV vers Base44 (${APP_ID})\n`);

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  for (const file of files.sort()) {
    const content = readFileSync(join(DATA_DIR, file), 'utf-8');
    const rows = parseCSV(content);
    const entityName = entityNameFromFile(file);

    if (rows.length === 0) {
      console.log(`⏭  ${entityName}: vide, ignoré`);
      continue;
    }

    console.log(`→ ${entityName}: ${rows.length} enregistrement(s)...`);
    const { created, updated, errors } = await importEntity(base44, entityName, rows);
    console.log(`  ✓ ${created} créé(s), ${updated} mis à jour, ${errors} erreur(s)`);
    totalCreated += created;
    totalUpdated += updated;
    totalErrors += errors;
  }

  console.log(`\n✅ Terminé: ${totalCreated} créés, ${totalUpdated} mis à jour, ${totalErrors} erreurs\n`);
}

main().catch((err) => {
  console.error('Erreur fatale:', err);
  process.exit(1);
});
