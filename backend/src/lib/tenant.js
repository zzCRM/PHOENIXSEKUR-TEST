/** Société technique réservée à la plateforme (Super Admin). Jamais listée chez un client. */
export const PLATFORM_COMPANY_ID = '__platform__';

export function isPlatformCompanyId(companyId) {
  return !companyId || companyId === PLATFORM_COMPANY_ID || companyId === 'platform';
}

/** Emails comptes plateforme — exclus des listes société. */
export function getPlatformEmails() {
  const fromEnv = [
    process.env.ADMIN_EMAIL,
    ...(process.env.SUPER_ADMIN_EMAILS || '').split(','),
  ]
    .map((e) => String(e || '').trim().toLowerCase())
    .filter(Boolean);

  const defaults = ['admin@phoenixsekur.fr'];
  return [...new Set([...defaults, ...fromEnv])];
}

export function isPlatformUser(user) {
  if (!user) return false;
  if (user.role === 'superadmin') return true;
  if (isPlatformCompanyId(user.companyId)) return true;
  const email = String(user.email || '').toLowerCase();
  return getPlatformEmails().includes(email);
}
