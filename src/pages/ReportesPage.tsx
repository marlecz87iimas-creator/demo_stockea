import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSummary, listMovements, listProducts, listSales } from '../api/stockea';
import { useAuth } from '../auth/AuthContext';
import {
  buildSalesPeriodReport,
  creditStatusLabel,
  filterCreditSales,
  localDateInputValue,
  resolvePeriodRange,
  uniqueSellers,
  type SalesReportPeriod,
} from '../domain/dailyReports';
import { creditPeriodSummary } from '../domain/creditTypes';
import { fetchReportData } from '../domain/reports';
import { tipoPagoLabel } from '../domain/paymentTypes';
import { useCloudRefresh } from '../hooks/useCloudRefresh';
import type { Reporte, Sale } from '../types';
import { downloadCreditSalesExcel } from '../utils/creditSalesExcel';
import { downloadSalesPeriodExcel } from '../utils/dailyReportExcel';
import { alertaBadge, formatDate, formatMoney } from '../utils/format';
import { printCreditSalesReport } from '../utils/printCreditSalesReport';
import { printSalesPeriodReport } from '../utils/printSalesReport';

async function fetchSalesInRange(
  token: string,
  orgId: string,
  from: string,
  to: string,
): Promise<Sale[]> {
  const all: Sale[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const res = await listSales(token, orgId, { from, to, limit: 1000, page });
    const items = Array.isArray(res?.items) ? res.items : [];
    all.push(...items);
    const total = Number(res?.total) || 0;
    if (items.length < 1000 || all.length >= total) break;
  }
  return all;
}

export default function ReportesPage() {
  const { session } = useAuth();
  const orgName = session?.organizations.find((o) => o.id === session.orgId)?.name;

  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [period, setPeriod] = useState<SalesReportPeriod>('diario');
  const [anchorDate, setAnchorDate] = useState(localDateInputValue());
  const [customFrom, setCustomFrom] = useState(localDateInputValue());
  const [customTo, setCustomTo] = useState(localDateInputValue());
  const [sellerId, setSellerId] = useState('');
  const [rawSales, setRawSales] = useState<Sale[]>([]);
  const [loadingVentas, setLoadingVentas] = useState(false);
  const [errorVentas, setErrorVentas] = useState('');
  const [rangeMeta, setRangeMeta] = useState(() => resolvePeriodRange('diario', localDateInputValue()));

  const [creditoFrom, setCreditoFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return localDateInputValue(d);
  });
  const [creditoTo, setCreditoTo] = useState(localDateInputValue());
  const [creditos, setCreditos] = useState<Sale[]>([]);
  const [loadingCreditos, setLoadingCreditos] = useState(false);
  const [errorCreditos, setErrorCreditos] = useState('');

  const sellers = useMemo(() => uniqueSellers(rawSales), [rawSales]);

  const ventasReport = useMemo(
    () => buildSalesPeriodReport({
      period,
      label: rangeMeta.label,
      fromYMD: rangeMeta.fromYMD,
      toYMD: rangeMeta.toYMD,
      sales: rawSales,
      sellerId: sellerId || null,
    }),
    [period, rangeMeta, rawSales, sellerId],
  );

  const cargar = useCallback(async () => {
    if (!session?.token || !session.orgId) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchReportData(session.token, session.orgId, {
        getSummary,
        listProducts,
        listMovements,
        listSales,
      });
      setReporte(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar reportes');
      setReporte(null);
    } finally {
      setLoading(false);
    }
  }, [session]);

  const cargarVentas = useCallback(async () => {
    if (!session?.token || !session.orgId) return;
    setLoadingVentas(true);
    setErrorVentas('');
    try {
      const range = resolvePeriodRange(
        period,
        anchorDate,
        customFrom,
        customTo,
      );
      setRangeMeta(range);
      const sales = await fetchSalesInRange(session.token, session.orgId, range.from, range.to);
      setRawSales(sales);
    } catch (e) {
      setErrorVentas(e instanceof Error ? e.message : 'Error al cargar el reporte de ventas');
      setRawSales([]);
    } finally {
      setLoadingVentas(false);
    }
  }, [session, period, anchorDate, customFrom, customTo]);

  const cargarCreditos = useCallback(async () => {
    if (!session?.token || !session.orgId) return;
    setLoadingCreditos(true);
    setErrorCreditos('');
    try {
      const range = resolvePeriodRange('personalizado', creditoFrom, creditoFrom, creditoTo);
      const sales = await fetchSalesInRange(session.token, session.orgId, range.from, range.to);
      setCreditos(filterCreditSales(sales));
    } catch (e) {
      setErrorCreditos(e instanceof Error ? e.message : 'Error al cargar ventas a crédito');
      setCreditos([]);
    } finally {
      setLoadingCreditos(false);
    }
  }, [session, creditoFrom, creditoTo]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { cargarVentas(); }, [cargarVentas]);
  useEffect(() => { cargarCreditos(); }, [cargarCreditos]);
  useCloudRefresh(() => {
    cargar();
    cargarVentas();
    cargarCreditos();
  }, Boolean(session?.token && session.orgId));

  if (!session?.orgId) {
    return (
      <div>
        <div className="page-header"><h2>Reportes</h2></div>
        <div className="alert alert-error">Selecciona una organización para ver reportes.</div>
      </div>
    );
  }

  if (loading && !reporte && loadingVentas) {
    return <div className="empty">Cargando reportes...</div>;
  }

  const inventario = reporte?.inventario;
  const ventasSnap = reporte?.ventas;
  const por_categoria = reporte?.por_categoria ?? [];
  const alertas = reporte?.alertas ?? [];
  const movimientos_recientes = reporte?.movimientos_recientes ?? [];

  const creditosPendientes = creditos.filter((c) => !c.credit_paid_at).length;
  const creditosPagados = creditos.filter((c) => Boolean(c.credit_paid_at)).length;
  const creditosMonto = creditos.reduce((s, c) => s + c.total, 0);

  const imprimirCreditos = (filter: 'todos' | 'pendientes' | 'pagados') => {
    try {
      printCreditSalesReport(creditos, {
        fromYMD: creditoFrom,
        toYMD: creditoTo,
        orgName,
        filter,
      });
    } catch (e) {
      setErrorCreditos(e instanceof Error ? e.message : 'No se pudo imprimir el reporte');
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Reportes</h2>
          <p className="page-subtitle">Ventas por periodo, créditos e inventario{orgName ? ` · ${orgName}` : ''}</p>
        </div>
      </div>

      <div className="panel report-sales-panel" id="reporte-ventas-dashboard">
        <div className="panel-header report-panel-header">
          <span>Reporte de ventas</span>
          <div className="report-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={cargarVentas}
              disabled={loadingVentas}
            >
              Actualizar
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => printSalesPeriodReport(ventasReport, orgName)}
              disabled={loadingVentas}
            >
              Imprimir
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                try {
                  downloadSalesPeriodExcel(ventasReport);
                } catch (e) {
                  setErrorVentas(e instanceof Error ? e.message : 'No se pudo generar el Excel');
                }
              }}
              disabled={ventasReport.total_ventas === 0 || loadingVentas}
            >
              Descargar Excel
            </button>
          </div>
        </div>

        <div className="filter-bar report-filters">
          <div className="form-field">
            <label htmlFor="report-period">Periodo</label>
            <select
              id="report-period"
              value={period}
              onChange={(e) => setPeriod(e.target.value as SalesReportPeriod)}
            >
              <option value="diario">Diario</option>
              <option value="semanal">Semanal</option>
              <option value="mensual">Mensual</option>
              <option value="personalizado">Personalizado</option>
            </select>
          </div>

          {period === 'personalizado' ? (
            <>
              <div className="form-field">
                <label htmlFor="report-from">Desde</label>
                <input
                  id="report-from"
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label htmlFor="report-to">Hasta</label>
                <input
                  id="report-to"
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </div>
            </>
          ) : (
            <div className="form-field">
              <label htmlFor="report-anchor">
                {period === 'diario' ? 'Fecha' : period === 'semanal' ? 'Semana de' : 'Mes de'}
              </label>
              <input
                id="report-anchor"
                type={period === 'mensual' ? 'month' : 'date'}
                value={period === 'mensual' ? anchorDate.slice(0, 7) : anchorDate}
                onChange={(e) => {
                  const v = e.target.value;
                  if (period === 'mensual' && /^\d{4}-\d{2}$/.test(v)) {
                    setAnchorDate(`${v}-01`);
                  } else {
                    setAnchorDate(v);
                  }
                }}
              />
            </div>
          )}

          <div className="form-field">
            <label htmlFor="report-seller">Vendedor</label>
            <select
              id="report-seller"
              value={sellerId}
              onChange={(e) => setSellerId(e.target.value)}
            >
              <option value="">Todos</option>
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {errorVentas && <div className="alert alert-error" style={{ margin: '1rem' }}>{errorVentas}</div>}

        {loadingVentas && rawSales.length === 0 ? (
          <div className="empty">Cargando reporte de ventas…</div>
        ) : (
          <div className="report-dashboard">
            <p className="report-period-label">{ventasReport.label}</p>
            <div className="stats-grid" style={{ padding: '0 1rem 1rem' }}>
              <div className="stat-card">
                <div className="stat-label">Ventas</div>
                <div className="stat-value">{ventasReport.total_ventas}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Monto total</div>
                <div className="stat-value" style={{ fontSize: '1.2rem' }}>{formatMoney(ventasReport.monto_total)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Tipos de pago</div>
                <div className="stat-value">{ventasReport.por_tipo.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Vendedores</div>
                <div className="stat-value">{ventasReport.por_vendedor.length}</div>
              </div>
            </div>

            <div className="report-grid">
              <div className="data-table-wrap" style={{ padding: '0 1rem 1rem' }}>
                <h3 className="report-section-title">Por tipo de pago</h3>
                <table className="data-table">
                  <thead>
                    <tr><th>Tipo</th><th>Cantidad</th><th>Monto</th></tr>
                  </thead>
                  <tbody>
                    {ventasReport.por_tipo.length === 0 ? (
                      <tr><td colSpan={3} className="empty">Sin ventas</td></tr>
                    ) : ventasReport.por_tipo.map((r) => (
                      <tr key={r.key}>
                        <td>{r.label}</td>
                        <td>{r.cantidad}</td>
                        <td><strong>{formatMoney(r.monto)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="data-table-wrap" style={{ padding: '0 1rem 1rem' }}>
                <h3 className="report-section-title">Por vendedor</h3>
                <table className="data-table">
                  <thead>
                    <tr><th>Vendedor</th><th>Cantidad</th><th>Monto</th></tr>
                  </thead>
                  <tbody>
                    {ventasReport.por_vendedor.length === 0 ? (
                      <tr><td colSpan={3} className="empty">Sin ventas</td></tr>
                    ) : ventasReport.por_vendedor.map((r) => (
                      <tr key={r.key}>
                        <td>{r.label}</td>
                        <td>{r.cantidad}</td>
                        <td><strong>{formatMoney(r.monto)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="data-table-wrap" style={{ padding: '0 1rem 1rem' }}>
              <h3 className="report-section-title">Por sucursal</h3>
              <table className="data-table">
                <thead>
                  <tr><th>Sucursal</th><th>Cantidad</th><th>Monto</th></tr>
                </thead>
                <tbody>
                  {ventasReport.por_sucursal.length === 0 ? (
                    <tr><td colSpan={3} className="empty">Sin ventas</td></tr>
                  ) : ventasReport.por_sucursal.map((r) => (
                    <tr key={r.key}>
                      <td>{r.label}</td>
                      <td>{r.cantidad}</td>
                      <td><strong>{formatMoney(r.monto)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="data-table-wrap" style={{ padding: '0 1rem 1rem' }}>
              <h3 className="report-section-title">Detalle de ventas</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Sucursal</th>
                    <th>Pago</th>
                    <th>Vendedor</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ventasReport.ventas.length === 0 ? (
                    <tr><td colSpan={7} className="empty">Sin ventas en el periodo</td></tr>
                  ) : ventasReport.ventas.map((v) => (
                    <tr key={v.id}>
                      <td><code>{v.folio}</code></td>
                      <td><small>{formatDate(v.created_at)}</small></td>
                      <td>
                        {v.customer_name || '—'}
                        {v.customer_phone ? (
                          <div className="page-subtitle">{v.customer_phone}</div>
                        ) : null}
                      </td>
                      <td>
                        {v.branch_name
                          ? (v.branch_code ? `${v.branch_name} (${v.branch_code})` : v.branch_name)
                          : (v.branch_code || 'Sin sucursal')}
                      </td>
                      <td>{tipoPagoLabel(v.payment_type)}</td>
                      <td>{v.seller_name || v.seller_email || '—'}</td>
                      <td><strong>{formatMoney(v.total)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-header report-panel-header">
          <span>Ventas a crédito</span>
          <div className="report-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={cargarCreditos}
              disabled={loadingCreditos}
            >
              Actualizar
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => imprimirCreditos('todos')}
              disabled={loadingCreditos || creditos.length === 0}
            >
              Imprimir todos
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => imprimirCreditos('pendientes')}
              disabled={loadingCreditos || creditosPendientes === 0}
            >
              Imprimir pendientes
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => imprimirCreditos('pagados')}
              disabled={loadingCreditos || creditosPagados === 0}
            >
              Imprimir pagados
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                try {
                  downloadCreditSalesExcel(creditos, {
                    fromYMD: creditoFrom,
                    toYMD: creditoTo,
                    orgName,
                  });
                } catch (e) {
                  setErrorCreditos(e instanceof Error ? e.message : 'No se pudo generar el Excel');
                }
              }}
              disabled={loadingCreditos || creditos.length === 0}
            >
              Descargar Excel
            </button>
          </div>
        </div>

        <div className="filter-bar report-filters">
          <div className="form-field">
            <label htmlFor="credito-from">Desde</label>
            <input
              id="credito-from"
              type="date"
              value={creditoFrom}
              onChange={(e) => setCreditoFrom(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="credito-to">Hasta</label>
            <input
              id="credito-to"
              type="date"
              value={creditoTo}
              onChange={(e) => setCreditoTo(e.target.value)}
            />
          </div>
        </div>

        {errorCreditos && <div className="alert alert-error" style={{ margin: '1rem' }}>{errorCreditos}</div>}

        {loadingCreditos && creditos.length === 0 ? (
          <div className="empty">Cargando créditos…</div>
        ) : (
          <>
            <div className="stats-grid" style={{ padding: '1rem' }}>
              <div className="stat-card">
                <div className="stat-label">Créditos</div>
                <div className="stat-value">{creditos.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Pendientes</div>
                <div className="stat-value">{creditosPendientes}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Monto total</div>
                <div className="stat-value" style={{ fontSize: '1.2rem' }}>{formatMoney(creditosMonto)}</div>
              </div>
            </div>

            <div className="data-table-wrap" style={{ padding: '0 1rem 1rem' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Vendedor</th>
                    <th>Total</th>
                    <th>Plazo</th>
                    <th>Vence</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {creditos.length === 0 ? (
                    <tr><td colSpan={8} className="empty">Sin ventas a crédito en el rango</td></tr>
                  ) : creditos.map((v) => (
                    <tr key={v.id}>
                      <td><code>{v.folio}</code></td>
                      <td><small>{formatDate(v.created_at)}</small></td>
                      <td>
                        {v.customer_name || '—'}
                        {v.customer_phone ? (
                          <div className="page-subtitle">{v.customer_phone}</div>
                        ) : null}
                      </td>
                      <td>{v.seller_name || v.seller_email || '—'}</td>
                      <td><strong>{formatMoney(v.total)}</strong></td>
                      <td>{creditPeriodSummary(v.credit_period_value, v.credit_period_unit) || '—'}</td>
                      <td><small>{v.credit_due_at ? formatDate(v.credit_due_at) : '—'}</small></td>
                      <td>{creditStatusLabel(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {reporte && inventario && ventasSnap && (
        <>
          <div className="page-header" style={{ marginTop: '0.5rem' }}>
            <h2 style={{ fontSize: '1.15rem' }}>Inventario</h2>
          </div>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Productos activos</div>
              <div className="stat-value">{inventario.total_productos}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Unidades en stock</div>
              <div className="stat-value">{Math.round(inventario.total_unidades)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Alertas críticas</div>
              <div className="stat-value" style={{ color: 'var(--danger)' }}>{inventario.alertas_criticas}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Alertas bajas</div>
              <div className="stat-value" style={{ color: 'var(--warning)' }}>{inventario.alertas_bajas}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Ventas registradas</div>
              <div className="stat-value">{ventasSnap.total_ventas}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Monto total ventas</div>
              <div className="stat-value" style={{ fontSize: '1.2rem' }}>{formatMoney(ventasSnap.monto_total)}</div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">Inventario por categoría</div>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Categoría</th><th>Productos</th><th>Unidades</th><th>Alertas</th></tr>
                </thead>
                <tbody>
                  {por_categoria.length === 0 ? (
                    <tr><td colSpan={4} className="empty">Sin productos activos</td></tr>
                  ) : por_categoria.map((c) => (
                    <tr key={c.categoria}>
                      <td>{c.categoria}</td>
                      <td>{c.productos}</td>
                      <td>{Math.round(c.unidades)}</td>
                      <td>{c.alertas > 0 ? <span className="badge badge-bajo">{c.alertas}</span> : '0'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">Alertas de reabastecimiento ({alertas.length})</div>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>SKU</th><th>Producto</th><th>Stock</th><th>Sugerido</th><th>Nivel</th></tr>
                </thead>
                <tbody>
                  {alertas.length === 0 ? (
                    <tr><td colSpan={5} className="empty">Sin alertas</td></tr>
                  ) : alertas.map((a) => (
                    <tr key={a.product_id}>
                      <td><code>{a.sku}</code></td>
                      <td>{a.producto_nombre}</td>
                      <td>{a.cantidad_actual} / {a.stock_minimo}</td>
                      <td>+{a.cantidad_sugerida}</td>
                      <td><span className={alertaBadge(a.nivel)}>{a.nivel}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">Movimientos recientes</div>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Fecha</th><th>Tipo</th><th>Producto</th><th>Cantidad</th></tr>
                </thead>
                <tbody>
                  {movimientos_recientes.length === 0 ? (
                    <tr><td colSpan={4} className="empty">Sin movimientos</td></tr>
                  ) : movimientos_recientes.map((m) => (
                    <tr key={m.id}>
                      <td><small>{formatDate(m.fecha)}</small></td>
                      <td>{m.tipo}</td>
                      <td><code>{m.sku}</code> {m.producto_nombre}</td>
                      <td>{m.cantidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
