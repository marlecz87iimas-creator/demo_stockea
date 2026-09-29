import { useEffect, useState } from 'react';
import { listBranches } from '../api/organizations';
import { useAuth } from '../auth/AuthContext';
import type { Branch } from '../types';

export function useOrgBranches(): Branch[] {
  const { session } = useAuth();
  const [sucursales, setSucursales] = useState<Branch[]>([]);

  useEffect(() => {
    if (!session?.token || !session.orgId) {
      setSucursales([]);
      return;
    }
    let cancelled = false;
    listBranches(session.token, session.orgId)
      .then((branches) => {
        if (!cancelled) setSucursales(branches.filter((b) => b.status === 'active'));
      })
      .catch(() => {
        if (!cancelled) setSucursales([]);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  return sucursales;
}
