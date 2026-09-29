import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { userDisplayName, primaryRoleLabel } from '../auth/auth';
import { DEMO_LIMIT, DEMO_MODE } from '../demo/config';
import { useMaintenance } from '../hooks/useMaintenance';
import { isDisplayableLogoUrl } from '../utils/logoImage';
import StockeaLogo from './StockeaLogo';
import { BranchEntry, useWorkingBranch } from './WorkingBranch';

const moduleLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊', path: 'dashboard' },
  { to: '/ventas', label: 'Ventas', icon: '💰', path: 'ventas' },
  { to: '/inventario', label: 'Inventario', icon: '📦', path: 'inventario' },
  { to: '/productos', label: 'Productos', icon: '🔧', path: 'productos' },
  { to: '/materiales', label: 'Materiales', icon: '🪵', path: 'materiales' },
  { to: '/movimientos', label: 'Movimientos', icon: '📋', path: 'movimientos' },
  { to: '/reportes', label: 'Reportes', icon: '📈', path: 'reportes' },
];

const adminLinks = [
  { to: '/admin/sistemas', label: 'Sistemas', icon: '🏢', adminOnly: true, configOnly: false },
  { to: '/configuracion', label: 'Configuración', icon: '⚙️', adminOnly: false, configOnly: true },
  { to: '/usuarios', label: 'Usuarios', icon: '👥', adminOnly: false, configOnly: false },
];

const operationalPaths = ['/dashboard', '/ventas', '/inventario', '/productos', '/materiales', '/movimientos', '/reportes'];

function operationalPath(pathname: string): boolean {
  return operationalPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export default function Layout() {
  const { session, logout, cambiarOrganizacion } = useAuth();
  const { branch, branches, needsChoice, selectBranch } = useWorkingBranch();
  const { showBanner, bannerMessage, phase } = useMaintenance();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const orgs = session?.organizations ?? [];
  const orgActiva = orgs.find((o) => o.id === session?.orgId);
  const entryImage = isDisplayableLogoUrl(branch?.image_url) ? branch?.image_url : session?.logoUrl;
  const entryAlt = branch?.name || orgActiva?.name || 'Logo';
  const fecha = new Date().toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const visibleModules = moduleLinks.filter(
    (l) => session?.orgId && session.canAccessPath(l.path),
  );

  const visibleAdminLinks = (session?.canManageOrganizations || session?.canManageOrgUsers || session?.canManageSystemConfig)
    ? adminLinks.filter((l) => {
      if (l.adminOnly) return !!session?.canManageOrganizations;
      if (l.configOnly) return !!session?.canManageSystemConfig;
      return !!session?.canManageOrgUsers;
    })
    : [];

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.classList.toggle('nav-open', menuOpen);
    return () => document.body.classList.remove('nav-open');
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `nav-link${isActive ? ' active' : ''}`;

  const brandTitle = (
    <div className="platform-brand">
      <StockeaLogo variant="brand" />
      {entryImage && (
        <img src={entryImage} alt={entryAlt} className="brand-logo brand-logo-org" />
      )}
    </div>
  );

  return (
    <div className="app-layout">
      <header className="topbar">
        <button
          type="button"
          className="menu-toggle"
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? '✕' : '☰'}
        </button>
        <div className="topbar-title">
          {brandTitle}
          {orgActiva && <span className="topbar-org">{orgActiva.name}</span>}
        </div>
      </header>

      {menuOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Cerrar menú"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside className={`sidebar${menuOpen ? ' is-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-row sidebar-brand-desktop">
            <StockeaLogo variant="brand" className="stockea-logo-sidebar" />
            {entryImage && (
              <img src={entryImage} alt={entryAlt} className="brand-logo brand-logo-sidebar brand-logo-org" />
            )}
          </div>
          {session?.systemTipo === 'DENTISTA' && (
            <div className="sidebar-brand-meta">Clínica dental</div>
          )}
          <div className="sidebar-brand-meta sidebar-brand-desktop">
            {orgActiva ? (
              <span>
                Inventario <strong>{orgActiva.name}</strong>
                {branch ? <> · {branch.name}</> : null}
              </span>
            ) : (
              <span>Control de inventario</span>
            )}
          </div>
          {branches.length > 1 && (
            <select
              className="org-selector"
              value={branch?.id ?? ''}
              onChange={(e) => selectBranch(e.target.value)}
              aria-label="Sucursal de trabajo"
            >
              <option value="">Elegir sucursal</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          {session?.isPlatformAdmin && orgs.length > 1 && (
            <select
              className="org-selector"
              value={session?.orgId ?? ''}
              onChange={(e) => cambiarOrganizacion(e.target.value)}
              aria-label="Cambiar organización"
            >
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          )}
          {session && (
            <div className="sidebar-brand-meta">
              {userDisplayName(session)}
              {session.roles.length > 0 && (
                <span> · {primaryRoleLabel(session.roles)}</span>
              )}
            </div>
          )}
          <div className="sidebar-brand-meta sidebar-brand-date">{fecha}</div>
        </div>
        <nav>
          {visibleAdminLinks.map((l) => (
            <NavLink key={l.to} to={l.to} className={navClass}>
              <span>{l.icon}</span>
              <span>{l.label}</span>
            </NavLink>
          ))}
          {visibleModules.map((l) => (
            <NavLink key={l.to} to={l.to} className={navClass}>
              <span>{l.icon}</span>
              <span>{l.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <button className="btn btn-secondary btn-sm logout-btn" onClick={logout}>
            {DEMO_MODE ? 'Reiniciar demo' : 'Cerrar sesión'}
          </button>
        </div>
      </aside>
      <main className="main-content">
        {DEMO_MODE && (
          <div className="alert access-banner demo-banner" role="status">
            Modo demo · máximo {DEMO_LIMIT} de cada recurso · los datos se pierden al cerrar la página
          </div>
        )}
        {showBanner && bannerMessage && (
          <div
            className={`alert access-banner maintenance-banner${phase === 'active' ? ' maintenance-banner-active' : ''}`}
            role="status"
          >
            {bannerMessage}
            {phase === 'active' && (
              <div className="maintenance-banner-sub">
                No se pueden realizar ventas, movimientos ni cambios de inventario.
              </div>
            )}
          </div>
        )}
        {needsChoice && operationalPath(location.pathname) && <BranchEntry />}
        <Outlet />
      </main>
    </div>
  );
}
