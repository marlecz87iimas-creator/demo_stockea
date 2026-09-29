import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { DEMO_LIMIT } from '../demo/config';
import { useDemo } from '../demo/DataContext';
import StockeaLogo from './StockeaLogo';

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/ventas', label: 'Ventas', icon: '💰' },
  { to: '/inventario', label: 'Inventario', icon: '📦' },
  { to: '/productos', label: 'Productos', icon: '🔧' },
  { to: '/materiales', label: 'Materiales', icon: '🪵' },
  { to: '/movimientos', label: 'Movimientos', icon: '📋' },
  { to: '/reportes', label: 'Reportes', icon: '📈' },
  { to: '/admin/sistemas', label: 'Sistemas', icon: '🏢' },
  { to: '/configuracion', label: 'Configuración', icon: '⚙️' },
  { to: '/usuarios', label: 'Usuarios', icon: '👥' },
];

export default function Layout() {
  const { orgName, reset } = useDemo();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const fecha = new Date().toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  useEffect(() => {
    document.body.classList.toggle('nav-open', menuOpen);
    return () => document.body.classList.remove('nav-open');
  }, [menuOpen]);

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `nav-link${isActive ? ' active' : ''}`;

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
          <div className="platform-brand">
            <StockeaLogo variant="brand" />
          </div>
          <span className="topbar-org">{orgName}</span>
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
          </div>
          <div className="sidebar-brand-meta sidebar-brand-desktop">
            Inventario <strong>{orgName}</strong>
          </div>
          <div className="sidebar-brand-meta">Usuario Demo · Principal</div>
          <div className="sidebar-brand-meta sidebar-brand-date">{fecha}</div>
        </div>
        <nav>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={navClass}>
              <span>{l.icon}</span>
              <span>{l.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <button type="button" className="btn btn-secondary btn-sm logout-btn" onClick={reset}>
            Reiniciar demo
          </button>
        </div>
      </aside>

      <main className="main-content">
        <div className="alert access-banner demo-banner" role="status">
          Modo demo visual · máximo {DEMO_LIMIT} de cada recurso · sin conexión · datos temporales
        </div>
        <Outlet />
      </main>
    </div>
  );
}
