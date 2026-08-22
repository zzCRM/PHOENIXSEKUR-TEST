#!/usr/bin/env node
/**
 * Créer ou mettre à jour un utilisateur.
 * Usage: node scripts/create-user.js <email> <password> [admin|user]
 */
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const [email, password, role = 'admin'] = process.argv.slice(2);
const companyId = process.env.ADMIN_COMPANY_ID || '69edb44339460eb505c2a699';

if (!email || !password) {
  console.error('Usage: node scripts/create-user.js <email> <password> [admin|user]');
  process.exit(1);
}

const prisma = new PrismaClient();
const passwordHash = await bcrypt.hash(password, 12);

const user = await prisma.user.upsert({
  where: { email },
  update: { passwordHash, role, companyId, isActive: true },
  create: {
    email,
    passwordHash,
    role,
    companyId,
    firstName: email.split('@')[0],
    lastName: '',
  },
});

console.log(`✅ Compte prêt: ${user.email} (${user.role})`);
console.log(`   Mot de passe: ${password}`);
console.log(`   Company ID: ${companyId}`);

await prisma.$disconnect();
