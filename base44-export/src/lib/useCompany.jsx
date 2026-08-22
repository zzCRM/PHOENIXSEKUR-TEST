import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * companyId = identifiant unique de la société.
 * - Si l'utilisateur est ADMIN : son user.id est le company_id (il EST le propriétaire de la société).
 * - Si l'utilisateur est non-admin (agent, client) : son company_id est stocké
 *   dans le champ `company_id` de son profil (renseigné lors de l'onboarding).
 *
 * Cela garantit l'isolation totale des données entre sociétés distinctes.
 */
export function useCompany() {
  const [user, setUser] = useState(null);
  const [companyId, setCompanyId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    base44.auth.me().then(u => {
      if (cancelled) return;
      if (u) {
        setUser(u);
        // Admin = propriétaire de la société, son ID est le company_id
        // Agent/Client non-admin = company_id stocké sur son profil
        const cid = u.company_id || u.companyId || (u.role === 'admin' ? u.id : null);
        setCompanyId(cid);
        setIsAdmin(u.role === 'admin' || u.role === 'superadmin' || u.superadmin);
      }
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return { user, companyId, isAdmin, loading };
}