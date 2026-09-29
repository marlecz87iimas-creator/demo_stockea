import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

/** Permite rutas a cualquier usuario autenticado con organización activa. */
export default function OrgRoute() {
  const { session } = useAuth();

  if (!session?.orgId) {
    return (
      <div>
        <div className="page-header"><h2>Sin organización</h2></div>
        <div className="alert alert-error">
          No tienes una organización asignada.
          {session?.isPlatformAdmin && (
            <> Ve a <Link to="/admin/sistemas">Sistemas</Link> para crear una.</>
          )}
        </div>
      </div>
    );
  }

  return <Outlet />;
}
