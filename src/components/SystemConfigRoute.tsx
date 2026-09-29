import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

/** Solo administrador y principal pueden ver configuración del sistema. */
export default function SystemConfigRoute() {
  const { session } = useAuth();

  if (!session?.canManageSystemConfig) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
