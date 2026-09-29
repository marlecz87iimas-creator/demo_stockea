import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listProducts, listSales } from '../api/stockea';
import { useAuth } from '../auth/AuthContext';
import { useWorkingBranch } from '../components/WorkingBranch';
import { branchLabel } from '../domain/branches';
import { buildDashboard, currentWeekRangeISO, type DashboardData } from '../domain/dashboard';
import { useCloudRefresh } from '../hooks/useCloudRefresh';
import type { Product, Sale } from '../types';
import { alertaBadge, creditDueBadge, creditDueLabel, formatDate, formatDateOnly, formatMoney } from '../utils/format';
import { isDisplayableLogoUrl } from '../utils/logoImage';

function deSucursal<T extends { branch_id?: string }>(items: T[], branchId?: string): T[] {
  if (!branchId) return items;
  return items.filter((item) => item.branch_id === branchId);
}

export default function DashboardPage() {
  const { session } = useAuth();
  const { branch, branches, selectBranch } = useWorkingBranch();
  const [productos, setProductos] = useState<Product[]>([]);
  const [ventas, setVentas] = useState<Sale[]>([]);
  const [creditos, setCreditos] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const cargar = useCallback(async () => {
    if (!session?.token || !session.orgId) return;
    try {
      const week = currentWeekRangeISO();
      const [productsResult, salesResult, creditDueResult] = await Promise.all([
        listProducts(session.token, session.orgId, { limit: 500, status: 'active' }),
        listSales(session.token, session.orgId, { limit: 200 }),
        listSales(session.token, session.orgId, {
          limit: 100,
          credit_due_from: week.from,
          credit_due_to: week.to,
        }),
      ]);
      setProductos(productsResult.items ?? []);
      setVentas(salesResult.items ?? []);
      setCreditos(creditDueResult.items ?? []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
      setProductos([]);
      setVentas([]);
      setCreditos([]);
    } finally {
      setLoading(false);
    }
  }, [session]);

  const data = useMemo<DashboardData | null>(() => {
    if (loading || error) return null;
    return buildDashboard(
      deSucursal(productos, branch?.id),
      deSucursal(ventas, branch?.id),
      deSucursal(creditos, branch?.id),
    );
  }, [loading, error, productos, ventas, creditos, branch]);

  useEffect(() => { cargar(); }, [cargar]);
  useCloudRefresh(cargar, Boolean(session?.token && session.orgId));

  if (!session?.orgId) {
    return (
      <div>
        <div className="page-header"><h2>Dashboard</h2></div>
        <div className="alert alert-error">
          No tienes una organización asignada. Contacta al administrador de Hildra.
        </div>
      </div>
    );
  }

  const logoBanner = branch ? (
    <div className="org-logo-banner" aria-label={`Imagen de ${branch.name}`}>
      {isDisplayableLogoUrl(branch.image_url) ? (
        <img
          src={branch.image_url}
          alt={branch.name}
          className="org-logo-banner-img"
        />
      ) : (
        <span className="branch-entry-placeholder">{branch.name} · Sin imagen</span>
      )}
    </div>
  ) : null;

  if (loading) {
    return (
      <div>
        {logoBanner}
        <div className="empty">Cargando dashboard...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        {logoBanner}
        <div className="page-header"><h2>Dashboard</h2></div>
        <div className="alert alert-error">{error || 'No se pudo cargar el dashboard'}</div>
      </div>
    );
  }

  const { ventas_dia, proximos_a_acabarse, agotados, creditos_por_vencer } = data;
  const hoy = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  const creditosUrgentes = creditos_por_vencer.filter((c) => c.nivel !== 'PROXIMO');

  const q = busqueda.trim().toLowerCase();
  const coincide = (...vals: (string | number | null | undefined)[]) =>
    !q || vals.some((v) => String(v ?? '').toLowerCase().includes(q));
  const ventasFiltradas = ventas_dia.ventas.filter((v) =>
    coincide(v.folio, v.seller_name, v.seller_email, v.org_name, v.customer_name, v.customer_phone),
  );
  const proximosFiltrados = proximos_a_acabarse.filter((p) =>
    coincide(p.sku, p.producto_nombre),
  );
  const agotadosFiltrados = agotados.filter((p) =>
    coincide(p.sku, p.producto_nombre),
  );
  const creditosFiltrados = creditos_por_vencer.filter((c) =>
    coincide(c.folio, c.vendedor, c.cliente, c.telefono),
  );
  const vacioBusqueda = 'Sin coincidencias para la búsqueda';

  return (
    <>
      {logoBanner}

      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <p className="page-subtitle">
            Resumen del día — {hoy}{branch ? ` · ${branch.name}` : ''}
          </p>
          {branches.length > 0 && (
            <label className="dashboard-branch-field">
              Sucursal
              <select
                className="org-selector dashboard-branch-select"
                value={branch?.id ?? ''}
                onChange={(e) => selectBranch(e.target.value)}
                aria-label="Sucursal del dashboard"
              >
                {!branch && <option value="">Elige la sucursal</option>}
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{branchLabel(b)}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <Link to="/ventas" className="btn btn-primary">+ Nueva venta</Link>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Ventas hoy</div>
          <div className="stat-value">{ventas_dia.cantidad_ventas}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Ingresos del día</div>
          <div className="stat-value" style={{ fontSize: '1.35rem' }}>{formatMoney(ventas_dia.monto_total)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Por agotarse</div>
          <div className="stat-value" style={{ color: 'var(--warning)' }}>{proximos_a_acabarse.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Agotados</div>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>{agotados.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Créditos por vencer</div>
          <div className="stat-value" style={{ color: creditos_por_vencer.length ? 'var(--warning)' : undefined }}>
            {creditos_por_vencer.length}
          </div>
        </div>
      </div>

      {creditosUrgentes.length > 0 && (
        <div className="alert" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', color: 'var(--text)' }}>
          {creditosUrgentes.length === 1
            ? '1 venta a crédito vence hoy o ya venció esta semana.'
            : `${creditosUrgentes.length} ventas a crédito vencen hoy o ya vencieron esta semana.`}
          {' '}Revisa la sección de créditos por vencer.
        </div>
      )}

      {creditos_por_vencer.length > 0 && creditosUrgentes.length === 0 && (
        <div className="alert" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid var(--warning)', color: 'var(--text)' }}>
          {creditos_por_vencer.length === 1
            ? '1 venta a crédito vence esta semana.'
            : `${creditos_por_vencer.length} ventas a crédito vencen esta semana.`}
        </div>
      )}

      <div className="panel">
        <div className="filter-bar">
          <input
            placeholder="Buscar en el dashboard: SKU, producto, vendedor o folio..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ flex: 1, minWidth: 240 }}
          />
          {busqueda && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setBusqueda('')}>
              Limpiar
            </button>
          )}
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="panel">
          <div className="panel-header">Ventas del día</div>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Folio</th><th>Cliente</th><th>Vendedor</th><th>Total</th><th>Hora</th></tr>
              </thead>
              <tbody>
                {ventasFiltradas.length === 0 ? (
                  <tr><td colSpan={5} className="empty">{q ? vacioBusqueda : 'Sin ventas registradas hoy'}</td></tr>
                ) : ventasFiltradas.map((v) => (
                  <tr key={v.id}>
                    <td><code>{v.folio}</code></td>
                    <td>
                      {v.customer_name || '—'}
                      {v.customer_phone ? (
                        <div className="page-subtitle">{v.customer_phone}</div>
                      ) : null}
                    </td>
                    <td>{v.seller_name || v.seller_email || '—'}</td>
                    <td><strong>{formatMoney(v.total || v.subtotal)}</strong></td>
                    <td><small>{formatDate(v.created_at)}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">Próximos a acabarse</div>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>SKU</th><th>Producto</th><th>Stock</th><th>Mínimo</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {proximosFiltrados.length === 0 ? (
                  <tr><td colSpan={5} className="empty">{q ? vacioBusqueda : 'Todo en niveles normales'}</td></tr>
                ) : proximosFiltrados.map((p) => (
                  <tr key={p.product_id}>
                    <td><code>{p.sku}</code></td>
                    <td>{p.producto_nombre}</td>
                    <td><strong>{p.cantidad}</strong></td>
                    <td>{p.stock_minimo}</td>
                    <td><span className={alertaBadge(p.nivel)}>{p.nivel}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">Créditos por vencer esta semana</div>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Folio</th><th>Cliente</th><th>Vendedor</th><th>Total</th><th>Vence</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {creditosFiltrados.length === 0 ? (
                  <tr><td colSpan={6} className="empty">{q ? vacioBusqueda : 'Sin créditos por vencer esta semana'}</td></tr>
                ) : creditosFiltrados.map((c) => (
                  <tr key={c.sale_id}>
                    <td><code>{c.folio}</code></td>
                    <td>
                      {c.cliente}
                      {c.telefono ? (
                        <div className="page-subtitle">{c.telefono}</div>
                      ) : null}
                    </td>
                    <td>{c.vendedor}</td>
                    <td><strong>{formatMoney(c.total)}</strong></td>
                    <td><small>{formatDateOnly(c.credit_due_at)}</small></td>
                    <td><span className={creditDueBadge(c.nivel)}>{creditDueLabel(c.dias_restantes)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">Productos agotados</div>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>SKU</th><th>Producto</th><th>Mínimo</th></tr>
              </thead>
              <tbody>
                {agotadosFiltrados.length === 0 ? (
                  <tr><td colSpan={3} className="empty">{q ? vacioBusqueda : 'No hay productos agotados'}</td></tr>
                ) : agotadosFiltrados.map((p) => (
                  <tr key={p.product_id}>
                    <td><code>{p.sku}</code></td>
                    <td>{p.producto_nombre}</td>
                    <td>{p.stock_minimo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
