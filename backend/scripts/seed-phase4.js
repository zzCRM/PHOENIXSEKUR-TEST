#!/usr/bin/env node
/** Sample data Phase 4: Rondes, Géoloc, Documents, RH */
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const prisma = new PrismaClient();
const COMPANY_ID = process.env.ADMIN_COMPANY_ID || '69edb44339460eb505c2a699';
const SITE_ID = '6a81ca659ab3b80034e9fa07';
const CLIENT_NAME = 'FÉDÉRAL MOGUL';
const SITE_NAME = 'TENNECO';
const today = new Date().toISOString().split('T')[0];
const now = new Date().toISOString();

async function upsert(model, id, data) {
  return prisma[model].upsert({
    where: { id },
    create: { id, companyId: COMPANY_ID, data },
    update: { companyId: COMPANY_ID, data },
  });
}

async function main() {
  console.log('\n📋 Seed Phase 4 — Rondes, Géoloc, Documents, RH\n');

  await upsert('ronde', 'seed-ronde-1', {
    company_id: COMPANY_ID,
    name: 'Ronde nocturne TENNECO',
    site_id: SITE_ID,
    site_name: SITE_NAME,
    client_name: CLIENT_NAME,
    description: 'Tournée de sécurité — entrepôt et parkings',
    status: 'actif',
    sens_ronde: 'Sens horaire uniquement',
    checkpoints: [
      { id: 'cp-1', name: 'Entrée principale', order: 1, nfc_tag_id: 'NFC-TENNECO-01', latitude: 48.8566, longitude: 2.3522 },
      { id: 'cp-2', name: 'Parking nord', order: 2, nfc_tag_id: 'NFC-TENNECO-02', latitude: 48.8570, longitude: 2.3528 },
      { id: 'cp-3', name: 'Local technique', order: 3, nfc_tag_id: 'NFC-TENNECO-03', latitude: 48.8562, longitude: 2.3518 },
    ],
  });

  await upsert('geolocation', 'seed-geo-1', {
    company_id: COMPANY_ID,
    agent_id: 'agent-jean',
    agent_name: 'Jean Dupont',
    site_id: SITE_ID,
    site_name: SITE_NAME,
    latitude: 48.8566,
    longitude: 2.3522,
    accuracy: 12,
    timestamp: now,
    date: today,
  });

  await upsert('geolocation', 'seed-geo-2', {
    company_id: COMPANY_ID,
    agent_id: 'agent-jean',
    agent_name: 'Jean Dupont',
    site_id: SITE_ID,
    site_name: SITE_NAME,
    latitude: 48.8570,
    longitude: 2.3528,
    accuracy: 8,
    timestamp: new Date(Date.now() - 120000).toISOString(),
    date: today,
  });

  await upsert('document', 'seed-doc-1', {
    company_id: COMPANY_ID,
    name: 'Procédure rondes NFC',
    type: 'procedure',
    target_type: 'tous',
    description: 'Guide des rondes et points de contrôle NFC',
    date: today,
    file_url: '',
  });

  await upsert('conge', 'seed-conge-1', {
    company_id: COMPANY_ID,
    agent_id: 'agent-jean',
    agent_name: 'Jean Dupont',
    type: 'conge_paye',
    date_debut: '2026-09-01',
    date_fin: '2026-09-05',
    nb_jours: 5,
    motif: 'Congés annuels',
    status: 'en_attente',
  });

  await upsert('pretMateriel', 'seed-pret-1', {
    company_id: COMPANY_ID,
    agent_id: 'agent-jean',
    agent_name: 'Jean Dupont',
    materiel: 'Radio VHF',
    date_pret: today,
    date_retour_prevue: '2026-12-31',
    status: 'en_cours',
  });

  await upsert('ficheDePaie', 'seed-fiche-1', {
    company_id: COMPANY_ID,
    agent_id: 'agent-jean',
    agent_name: 'Jean Dupont',
    month: 7,
    year: 2026,
    net_a_payer: 1850,
    file_url: '',
  });

  await upsert('priseDeService', 'seed-pds-1', {
    company_id: COMPANY_ID,
    agent_id: 'agent-jean',
    agent_name: 'Jean Dupont',
    site_id: SITE_ID,
    site_name: SITE_NAME,
    date: today,
    start_time: '08:00',
    status: 'en_service',
  });

  await upsert('rondeExecution', 'seed-rex-1', {
    company_id: COMPANY_ID,
    ronde_id: 'seed-ronde-1',
    ronde_name: 'Ronde nocturne TENNECO',
    agent_id: 'agent-jean',
    agent_name: 'Jean Dupont',
    site_id: SITE_ID,
    site_name: SITE_NAME,
    date: today,
    start_time: '22:00',
    status: 'terminee',
    checkpoints_done: 3,
    checkpoints_total: 3,
  });

  console.log('✓  1 ronde (3 points NFC)');
  console.log('✓  2 positions géoloc');
  console.log('✓  1 document');
  console.log('✓  1 congé');
  console.log('✓  1 prêt matériel');
  console.log('✓  1 fiche de paie');
  console.log('✓  1 prise de service');
  console.log('✓  1 exécution ronde\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
