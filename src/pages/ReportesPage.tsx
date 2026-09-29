import { money } from '../demo/config';
import { useDemo } from '../demo/DataContext';

export default function ReportesPage() {
  const { productos, materiales, ventas } = useDemo();
  const valorInventario = [...productos, ...materiales]
    .reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const ventasTotal = ventas.reduce((s, v) => s + v.total, 0);

  return (
    <div>
      <div className="page-header">
        <h2>Reportes</h2>
      </div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Ítems en catálogo</div>
          <div className="stat-value">{productos.length + materiales.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Valor inventario</div>
          <div className="stat-value">{money(valorInventario)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Ventas</div>
          <div className="stat-value">{ventas.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Monto vendido</div>
          <div className="stat-value">{money(ventasTotal)}</div>
        </div>
      </div>
      <div className="panel" style={{ marginTop: '1.25rem' }}>
        <div className="empty">
          Vista de reporte solo visual. En la versión completa aquí se exportan Excel, créditos y filtros por sucursal.
        </div>
      </div>
    </div>
  );
}
