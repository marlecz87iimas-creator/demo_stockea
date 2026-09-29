import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { canAccessStockeaPath } from '../domain/stockeaRoles';

/** Restringe módulos según rol Stockea (vendedor, cajero, supervisor, admin). */
export default function StockeaAccessRoute() {
  const { session } = useAuth();
  const location = useLocation();
  const segment = location.pathname.replace(/^\//, '').split('/')[0] || 'dashboard';

  if (!session?.orgId) {
    return <Navigate to="/login" replace />;
  }

  if (!canAccessStockeaPath(session.stockeaProfile, segment)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
