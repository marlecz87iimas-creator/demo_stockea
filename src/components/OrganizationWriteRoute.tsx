import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function OrganizationWriteRoute() {
  const { session } = useAuth();

  if (!session?.canManageOrganizations) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
