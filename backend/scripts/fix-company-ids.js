#!/usr/bin/env node
/** Reassign company_id 'default' → real company ID for migrated records */
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { ENTITY_MODELS } from '../src/lib/prisma.js';

dotenv.config();

const prisma = new PrismaClient();
const COMPANY_ID = process.env.ADMIN_COMPANY_ID || '69edb44339460eb505c2a699';

const MODELS = Object.values(ENTITY_MODELS);

async function main() {
  console.log(`\n🔧 Fix company_id → ${COMPANY_ID}\n`);
  let total = 0;

  for (const model of MODELS) {
    const delegate = prisma[model];
    if (!delegate?.updateMany) continue;

    const result = await delegate.updateMany({
      where: { companyId: 'default' },
      data: { companyId: COMPANY_ID },
    });

    if (result.count > 0) {
      console.log(`✓  ${model}: ${result.count} corrigé(s)`);
      total += result.count;
    }
  }

  console.log(`\n✅ ${total} enregistrements corrigés\n`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
