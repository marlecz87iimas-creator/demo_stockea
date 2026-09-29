import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function OrgUsersRoute() {
  const { session } = useAuth();

  if (!session?.canManageOrgUsers) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
