import { isSuperAdmin } from './superadmin.js';
import { getAppUrl } from './auth-cookie.js';

/** Chemin applicatif par défaut selon le rôle utilisateur. */
export function getAppPathForRole(user) {
  if (!user) return '/';
  if (isSuperAdmin(user)) return '/super-admin';
  const role = (user.role || '').toLowerCase();
  if (role === 'client') return '/espace-client';
  if (role === 'agent' || role === 'user') return '/espace-agent';
  return '/';
}

export function getAppRedirectUrl(user) {
  const appUrl = getAppUrl();
  const path = getAppPathForRole(user);
  return `${appUrl}${path}`;
}
