import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { listBranches } from '../api/organizations';
import { useAuth } from '../auth/AuthContext';
import { branchLabel } from '../domain/branches';
import type { Branch } from '../types';
import { isDisplayableLogoUrl } from '../utils/logoImage';

const STORAGE_PREFIX = 'stockea.workingBranch.';

interface WorkingBranchValue {
  branches: Branch[];
  branch: Branch | null;
  needsChoice: boolean;
  loading: boolean;
  selectBranch: (branchId: string) => void;
}

const WorkingBranchContext = createContext<WorkingBranchValue | null>(null);

export function WorkingBranchProvider({ children }: { children?: ReactNode }) {
  const { session } = useAuth();
  const orgId = session?.orgId ?? '';
  const token = session?.token ?? '';
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token || !orgId) {
      setBranches([]);
      setBranchId('');
      return;
    }
    setLoading(true);
    try {
      const list = await listBranches(token, orgId);
      const active = list.filter((b) => b.status === 'active');
      setBranches(active);
      const saved = localStorage.getItem(STORAGE_PREFIX + orgId) ?? '';
      const valid = active.some((b) => b.id === saved);
      if (valid) {
        setBranchId(saved);
      } else if (active.length === 1) {
        setBranchId(active[0].id);
        localStorage.setItem(STORAGE_PREFIX + orgId, active[0].id);
      } else {
        setBranchId('');
      }
    } catch {
      setBranches([]);
      setBranchId('');
    } finally {
      setLoading(false);
    }
  }, [token, orgId]);

  useEffect(() => { load().catch(console.error); }, [load]);

  useEffect(() => {
    const onChange = () => { load().catch(console.error); };
    window.addEventListener('stockea-branches-changed', onChange);
    return () => window.removeEventListener('stockea-branches-changed', onChange);
  }, [load]);

  const selectBranch = useCallback((id: string) => {
    if (!orgId || !id) return;
    setBranchId(id);
    localStorage.setItem(STORAGE_PREFIX + orgId, id);
  }, [orgId]);

  const branch = branches.find((b) => b.id === branchId) ?? null;
  const value = useMemo<WorkingBranchValue>(() => ({
    branches,
    branch,
    needsChoice: !loading && branches.length > 1 && !branch,
    loading,
    selectBranch,
  }), [branches, branch, loading, selectBranch]);

  return (
    <WorkingBranchContext.Provider value={value}>
      {children ?? <Outlet />}
    </WorkingBranchContext.Provider>
  );
}

export function useWorkingBranch(): WorkingBranchValue {
  const value = useContext(WorkingBranchContext);
  if (!value) {
    return {
      branches: [],
      branch: null,
      needsChoice: false,
      loading: false,
      selectBranch: () => {},
    };
  }
  return value;
}

export function notifyBranchesChanged(): void {
  window.dispatchEvent(new Event('stockea-branches-changed'));
}

export function BranchEntry() {
  const { branches, selectBranch } = useWorkingBranch();

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Elige la sucursal</h2>
          <p className="page-subtitle">La imagen de la sucursal se mostrará mientras trabajes desde ahí.</p>
        </div>
      </div>
      <div className="branch-entry">
        {branches.map((b) => (
          <button key={b.id} type="button" className="branch-entry-card" onClick={() => selectBranch(b.id)}>
            {isDisplayableLogoUrl(b.image_url) ? (
              <img src={b.image_url} alt="" />
            ) : (
              <span className="branch-entry-placeholder">Sin imagen</span>
            )}
            <strong>{branchLabel(b)}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}
