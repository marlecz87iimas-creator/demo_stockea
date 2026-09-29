import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function ProtectedRoute() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-page">
        <div className="empty" style={{ color: '#8ba4c4' }}>Cargando...</div>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  return <Outlet />;
}
