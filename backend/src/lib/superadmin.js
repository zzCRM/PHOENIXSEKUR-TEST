/** Accès Super Admin plateforme — réservé au rôle `superadmin` en base. */
export function isSuperAdmin(user) {
  if (!user?.email) return false;
  return user.role === 'superadmin';
}

/** @deprecated Conservé pour compatibilité — utiliser le rôle en base. */
export function getSuperAdminEmails() {
  return [];
}
