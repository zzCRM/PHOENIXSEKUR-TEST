/** Route d'accueil applicative selon le rôle connecté. */
export function getHomePathForUser(user) {
  if (!user) return '/';
  if (user.superadmin) return '/super-admin';
  const role = (user.role || '').toLowerCase();
  if (role === 'client') return '/espace-client';
  if (role === 'agent' || role === 'user') return '/espace-agent';
  return '/';
}
