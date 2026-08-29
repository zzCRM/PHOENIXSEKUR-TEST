#!/usr/bin/env node
/** Sample data for Phase 3 modules (Alertes, Main courante, Demandes) */
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { generateId } from '../src/lib/prisma.js';

dotenv.config();

const prisma = new PrismaClient();
const COMPANY_ID = process.env.ADMIN_COMPANY_ID || '69edb44339460eb505c2a699';
const today = new Date().toISOString().split('T')[0];
const now = new Date().toTimeString().slice(0, 5);

async function upsertEntity(model, id, data) {
  return prisma[model].upsert({
    where: { id },
    create: { id, companyId: COMPANY_ID, data },
    update: { companyId: COMPANY_ID, data },
  });
}

async function main() {
  console.log('\n📋 Seed Phase 3 — données exemple\n');

  await upsertEntity('alerte', 'seed-alerte-1', {
    company_id: COMPANY_ID,
    type: 'debut_service',
    agent_name: 'Jean Dupont',
    site_name: 'TENNECO',
    message: 'Prise de service confirmée — TENNECO',
    date: today,
    time: now,
    read: false,
    severity: 'info',
  });

  await upsertEntity('alerte', 'seed-alerte-2', {
    company_id: COMPANY_ID,
    type: 'incident',
    agent_name: 'Jean Dupont',
    site_name: 'TENNECO',
    message: 'Porte arrière non verrouillée — vérification effectuée',
    date: today,
    time: now,
    read: false,
    severity: 'attention',
  });

  await upsertEntity('mainCourante', 'seed-mc-1', {
    company_id: COMPANY_ID,
    site_id: '6a81ca659ab3b80034e9fa07',
    site_name: 'TENNECO',
    client_name: 'FÉDÉRAL MOGUL',
    agent_name: 'Jean Dupont',
    date: today,
    time: now,
    category: 'service',
    event_type: 'debut_service',
    content: 'Prise de service — ronde matinale effectuée sans anomalie.',
    auto: false,
    type: 'arrivee',
    severity: 'normal',
  });

  await upsertEntity('demande', 'seed-demande-1', {
    company_id: COMPANY_ID,
    subject: 'Demande planning semaine prochaine',
    message: 'Merci de nous transmettre le planning mis à jour pour le site TENNECO.',
    from_type: 'client',
    from_name: 'FÉDÉRAL MOGUL',
    priority: 'normale',
    status: 'nouvelle',
  });

  console.log('✓  2 alertes');
  console.log('✓  1 entrée main courante');
  console.log('✓  1 demande\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
