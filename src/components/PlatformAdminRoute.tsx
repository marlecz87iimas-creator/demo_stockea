import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function PlatformAdminRoute() {
  const { session } = useAuth();

  if (!session?.isPlatformAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
