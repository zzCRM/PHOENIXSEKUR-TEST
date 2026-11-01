#!/usr/bin/env node
/**
 * Diagnostic, simulation et application de la migration vers les pointeaux.
 *
 *   node scripts/pointeaux-migration.js diagnostic [--company=ID]
 *   node scripts/pointeaux-migration.js simulation [--company=ID] [--decisions=fichier.json] [--out=plan.json]
 *   CONFIRM_MIGRATION=oui node scripts/pointeaux-migration.js appliquer --plan=plan.json
 *
 * diagnostic et simulation ne font que des lectures. appliquer ne fait que CRÉER des
 * pointeaux : aucune ronde, exécution, mission ou main courante n'est modifiée ni supprimée.
 * Les points sans tag NFC ne deviennent jamais des pointeaux.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { toApiRecord } from '../src/lib/prisma.js';
import { analyze, planMigration } from '../src/lib/pointeauxMigration.js';
import { pointeauTagKey } from '../../shared/pointeaux.js';

dotenv.config();
const prisma = new PrismaClient();

const args = process.argv.slice(2);
const command = args[0];
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

async function load(companyId) {
  const where = companyId ? { companyId } : undefined;
  const [sites, rondes, executions, missions, pointeaux] = await Promise.all([
    prisma.site.findMany({ where }),
    prisma.ronde.findMany({ where }),
    prisma.rondeExecution.findMany({ where }),
    prisma.mission.findMany({ where }),
    prisma.pointeau.findMany({ where }),
  ]);
  return {
    sites: sites.map(toApiRecord),
    rondes: rondes.map(toApiRecord),
    executions: executions.map(toApiRecord),
    missions: missions.map(toApiRecord),
    pointeaux: pointeaux.map(toApiRecord).map((p, index) => ({ ...p, status: pointeaux[index].status })),
  };
}

function output(value, file) {
  const json = JSON.stringify(value, null, 2);
  if (file) {
    writeFileSync(file, json);
    console.log(`Écrit : ${file}`);
  } else {
    console.log(json);
  }
}

async function main() {
  const companyId = option('company');
  if (command === 'diagnostic') {
    const data = await load(companyId);
    output(analyze(data), option('out'));
  } else if (command === 'simulation') {
    const data = await load(companyId);
    const decisions = option('decisions') ? JSON.parse(readFileSync(option('decisions'), 'utf8')) : {};
    output({ genere_le: new Date().toISOString(), company_id: companyId || null, ...planMigration(data, decisions) }, option('out'));
  } else if (command === 'appliquer') {
    if (process.env.CONFIRM_MIGRATION !== 'oui') {
      throw new Error('Refusé : définissez CONFIRM_MIGRATION=oui après avoir validé le plan et sauvegardé la base.');
    }
    const plan = JSON.parse(readFileSync(option('plan') || '', 'utf8'));
    let created = 0;
    for (const item of plan.a_creer || []) {
      const { company_id, site_id, status, ...data } = item;
      const tagKey = pointeauTagKey({ status, nfc_tag_id: data.nfc_tag_id });
      const exists = await prisma.pointeau.findFirst({ where: { companyId: company_id, tagKey } });
      if (exists) continue;
      await prisma.pointeau.create({
        data: {
          id: randomUUID(),
          companyId: company_id,
          siteId: site_id,
          status,
          tagKey,
          data: { ...data, company_id, site_id, status },
          createdBy: 'migration-pointeaux',
        },
      });
      created += 1;
    }
    console.log(`${created} pointeau(x) créé(s). Aucune autre donnée n'a été modifiée.`);
  } else {
    console.log('Usage : diagnostic | simulation | appliquer (voir l’en-tête du fichier)');
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
