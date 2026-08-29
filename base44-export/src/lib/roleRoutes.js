/** Route d'accueil applicative selon le rôle connecté. */
export function getHomePathForUser(user) {
  if (!user) return '/';
  if (user.superadmin) return '/super-admin';
  const role = (user.role || '').toLowerCase();
  if (role === 'client') return '/espace-client';
  if (role === 'agent' || role === 'user') return '/espace-agent';
  return '/';
}

export function getUserAppRole(user) {
  if (!user) return null;
  if (user.superadmin) return 'superadmin';
  return String(user.role || '').toLowerCase() || null;
}

/** Un collaborateur / client ne doit pas rester sur le mauvais portail. */
export function shouldRedirectPath(user, pathname) {
  const home = getHomePathForUser(user);
  const role = getUserAppRole(user);
  const path = pathname || '/';

  if (role === 'agent' || role === 'user') {
    if (path !== '/espace-agent') return '/espace-agent';
    return null;
  }
  if (role === 'client') {
    if (path !== '/espace-client') return '/espace-client';
    return null;
  }

  // Admin / superadmin : ne pas ouvrir automatiquement les portails salarié / client
  if (path === '/espace-agent' || path === '/espace-client') {
    return home;
  }
  if (path === '/' && home !== '/') {
    return home;
  }
  return null;
}
