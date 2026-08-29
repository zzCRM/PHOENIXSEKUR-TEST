import { useAuth } from '@/lib/AuthContext';

export function useSuperAdmin() {
  const { user } = useAuth();
  return {
    isSuperAdmin: !!user?.superadmin,
    user,
  };
}
