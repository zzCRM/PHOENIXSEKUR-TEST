import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { shouldRedirectPath } from '@/lib/roleRoutes';

/**
 * Envoie chaque rôle vers le bon espace.
 * Empêche surtout d’ouvrir /espace-agent (PWA) quand on n’est pas collaborateur.
 */
export default function RoleHomeRedirect() {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLoadingAuth || !isAuthenticated || !user) return;
    const target = shouldRedirectPath(user, location.pathname);
    if (target && target !== location.pathname) {
      navigate(target, { replace: true });
    }
  }, [user, isAuthenticated, isLoadingAuth, location.pathname, navigate]);

  return null;
}
