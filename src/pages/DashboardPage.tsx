import { money } from '../demo/config';
import { useDemo } from '../demo/DataContext';

export default function DashboardPage() {
  const { productos, materiales, ventas, sucursales } = useDemo();
  const stock = productos.reduce((s, p) => s + p.quantity, 0)
    + materiales.reduce((s, p) => s + p.quantity, 0);
  const ventasTotal = ventas.reduce((s, v) => s + v.total, 0);

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Productos</div>
          <div className="stat-value">{productos.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Materiales</div>
          <div className="stat-value">{materiales.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Unidades</div>
          <div className="stat-value">{stock}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Ventas demo</div>
          <div className="stat-value">{money(ventasTotal)}</div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: '1.25rem' }}>
        <div className="panel-header">
          <h3>Resumen rápido</h3>
        </div>
        <div className="empty" style={{ padding: '1.25rem' }}>
          {sucursales.length} sucursal(es) · {ventas.length} venta(s) registrada(s).
          Crea productos o materiales para llenar el inventario de esta demo.
        </div>
      </div>
    </div>
  );
}
