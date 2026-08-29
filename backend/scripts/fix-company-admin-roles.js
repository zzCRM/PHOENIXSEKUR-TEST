#!/usr/bin/env node
/**
 * Corrige les rôles : certains emails sont des admins société, pas Super Admin plateforme.
 * Usage: node scripts/fix-company-admin-roles.js
 */
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const prisma = new PrismaClient();

/** Emails admin société — ne doivent jamais avoir le rôle superadmin. */
const COMPANY_ADMIN_EMAILS = (process.env.COMPANY_ADMIN_EMAILS
  || 'serviceclient@ppsecurity.fr,contact@ppsecurity.fr')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

async function main() {
  for (const email of COMPANY_ADMIN_EMAILS) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && user.role === 'superadmin') {
      await prisma.user.update({
        where: { email },
        data: { role: 'admin' },
      });
      console.log(`✓ ${email} : superadmin → admin (admin société)`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
