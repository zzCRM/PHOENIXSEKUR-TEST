#!/usr/bin/env node
/**
 * Create default admin user for Phoenix Sekur.
 * Usage: node scripts/seed-admin.js
 */
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const prisma = new PrismaClient();

const ADMIN = {
  email: process.env.ADMIN_EMAIL || 'admin@phoenixsekur.fr',
  password: process.env.ADMIN_PASSWORD || 'Phoenix2026!',
  companyId: process.env.ADMIN_COMPANY_ID || '69edb44339460eb505c2a699',
  firstName: 'Admin',
  lastName: 'Phoenix',
  role: 'admin',
};

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: ADMIN.email } });
  if (existing) {
    console.log(`ℹ️  Admin déjà existant: ${ADMIN.email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN.password, 12);
  await prisma.user.create({
    data: {
      email: ADMIN.email,
      passwordHash,
      companyId: ADMIN.companyId,
      firstName: ADMIN.firstName,
      lastName: ADMIN.lastName,
      role: ADMIN.role,
    },
  });

  console.log('\n✅ Compte admin créé');
  console.log(`   Email    : ${ADMIN.email}`);
  console.log(`   Password : ${ADMIN.password}`);
  console.log(`   Company  : ${ADMIN.companyId}\n`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
