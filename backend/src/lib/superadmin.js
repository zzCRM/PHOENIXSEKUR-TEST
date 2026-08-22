/** Emails avec accès Super Admin plateforme (comme les gros SaaS). */
export function getSuperAdminEmails() {
  const fromEnv = process.env.SUPER_ADMIN_EMAILS || process.env.SUPER_ADMIN_EMAIL || '';
  const defaults = 'serviceclient@ppsecurity.fr,admin@phoenixsekur.fr,contact@ppsecurity.fr';
  const list = `${fromEnv},${defaults}`
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(list)];
}

export function isSuperAdmin(user) {
  if (!user?.email) return false;
  if (user.role === 'superadmin') return true;
  return getSuperAdminEmails().includes(user.email.toLowerCase());
}
