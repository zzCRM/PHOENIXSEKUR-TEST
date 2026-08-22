import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getHomePathForUser } from '@/lib/roleRoutes';

/** Redirige vers l'espace adapté au rôle si l'utilisateur arrive sur /. */
export default function RoleHomeRedirect() {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLoadingAuth || !isAuthenticated || !user) return;
    if (location.pathname !== '/') return;
    const target = getHomePathForUser(user);
    if (target !== '/') navigate(target, { replace: true });
  }, [user, isAuthenticated, isLoadingAuth, location.pathname, navigate]);

  return null;
}
