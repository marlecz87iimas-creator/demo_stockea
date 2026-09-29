import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { inventoryAccessLabel } from '../auth/access';

export default function InventoryAccessRoute() {
  const { session } = useAuth();

  if (!session?.orgId) {
    return (
      <div>
        <div className="page-header"><h2>Sin organización</h2></div>
        <div className="alert alert-error">
          No tienes una organización asignada.
          {session?.canManageOrganizations && (
            <> Ve a <Link to="/admin/sistemas">Sistemas</Link> para crear una.</>
          )}
        </div>
      </div>
    );
  }

  if (!session.canAccessInventory) {
    return (
      <div>
        <div className="page-header"><h2>Inventario no disponible</h2></div>
        <div className="panel" style={{ padding: '1.5rem' }}>
          <p style={{ marginBottom: '0.75rem' }}>
            Para acceder al inventario de Stockea, tu organización debe tener instalada la app
            <strong> Costea</strong> o <strong>Stockea</strong> en Hildra Core.
          </p>
          {session.canManageOrganizations && (
            <p className="page-subtitle">
              Puedes instalar Stockea desde <Link to="/admin/sistemas">Sistemas</Link>.
            </p>
          )}
        </div>
      </div>
    );
  }

  const via = inventoryAccessLabel(session.installedApps);
  if (via === 'Costea') {
    return (
      <>
        <div className="alert alert-info access-banner">
          Inventario habilitado por tu licencia de <strong>Costea</strong>.
        </div>
        <Outlet />
      </>
    );
  }

  return <Outlet />;
}
