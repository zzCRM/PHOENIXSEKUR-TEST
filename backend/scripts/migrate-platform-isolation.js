#!/usr/bin/env node
/**
 * Isole les comptes plateforme (Super Admin) hors des sociétés clientes.
 * Usage: node scripts/migrate-platform-isolation.js
 */
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const prisma = new PrismaClient();
const PLATFORM_COMPANY_ID = '__platform__';

const PLATFORM_EMAILS = [
  process.env.ADMIN_EMAIL || 'admin@phoenixsekur.fr',
  ...(process.env.SUPER_ADMIN_EMAILS || '').split(','),
]
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

async function main() {
  // 1) Tous les superadmin → société plateforme
  const supers = await prisma.user.updateMany({
    where: { role: 'superadmin' },
    data: { companyId: PLATFORM_COMPANY_ID },
  });
  console.log(`✓ ${supers.count} superadmin → ${PLATFORM_COMPANY_ID}`);

  // 2) Emails plateforme connus → société plateforme + rôle superadmin si admin@
  for (const email of PLATFORM_EMAILS) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) continue;
    const data = { companyId: PLATFORM_COMPANY_ID };
    if (email === (process.env.ADMIN_EMAIL || 'admin@phoenixsekur.fr').toLowerCase()) {
      data.role = 'superadmin';
    }
    await prisma.user.update({ where: { email }, data });
    console.log(`✓ ${email} isolé sur ${PLATFORM_COMPANY_ID} (role=${data.role || user.role})`);
  }

  // 3) Invitations orphelines liées à ces emails / rôle admin plateforme
  const inv = await prisma.invitation.updateMany({
    where: {
      OR: [
        { email: { in: PLATFORM_EMAILS } },
        { role: 'superadmin' },
      ],
      acceptedAt: null,
    },
    data: { companyId: PLATFORM_COMPANY_ID },
  });
  console.log(`✓ ${inv.count} invitation(s) plateforme isolée(s)`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
