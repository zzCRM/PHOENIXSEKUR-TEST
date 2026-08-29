import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * companyId = identifiant société (User.companyId en base).
 * Isolation multi-tenant : jamais utiliser user.id à la place.
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
        const cid = u.company_id || u.companyId || null;
        setCompanyId(cid);
        setIsAdmin(u.role === 'admin' || u.role === 'superadmin' || !!u.superadmin);
      }
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return { user, companyId, isAdmin, loading };
}
