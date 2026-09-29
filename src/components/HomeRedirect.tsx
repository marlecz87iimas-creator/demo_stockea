import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { DEMO_MODE } from '../demo/config';
import StockeaLogo from './StockeaLogo';

export default function HomeRedirect() {
  const { session, logout } = useAuth();

  if (DEMO_MODE && session?.orgId && session.canAccessPath('dashboard')) {
    return <Navigate to="/dashboard" replace />;
  }

  if (session?.isPlatformAdmin) {
    return <Navigate to="/admin/sistemas" replace />;
  }

  if (session?.orgId && session.canAccessPath('dashboard')) {
    return <Navigate to="/dashboard" replace />;
  }

  if (session?.canAccessPath('ventas')) {
    return <Navigate to="/ventas" replace />;
  }

  if (session) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-brand">
            <StockeaLogo variant="login" />
            <p>No hay una organización disponible para esta cuenta.</p>
          </div>
          <div className="alert alert-error">
            El usuario existe, pero no pertenece a ninguna organización con Stockea.
            En Hildra Admin agrégalo como miembro e instala Stockea en esa organización.
          </div>
          <button type="button" className="btn btn-primary auth-submit" onClick={logout}>
            Volver a iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  return <Navigate to="/login" replace />;
}
