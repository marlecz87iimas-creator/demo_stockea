import { formatDate } from '../demo/config';
import { useDemo } from '../demo/DataContext';

export default function MovimientosPage() {
  const { productos, materiales, ventas } = useDemo();

  const movimientos = [
    ...productos.map((p) => ({
      id: `in-${p.id}`,
      tipo: 'Entrada',
      detalle: `Producto: ${p.name}`,
      cantidad: p.quantity,
      fecha: p.createdAt,
    })),
    ...materiales.map((m) => ({
      id: `in-${m.id}`,
      tipo: 'Entrada',
      detalle: `Material: ${m.name}`,
      cantidad: m.quantity,
      fecha: m.createdAt,
    })),
    ...ventas.map((v) => ({
      id: `out-${v.id}`,
      tipo: 'Salida',
      detalle: `Venta ${v.folio} · ${v.customer}`,
      cantidad: 1,
      fecha: v.createdAt,
    })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <div>
      <div className="page-header">
        <h2>Movimientos</h2>
      </div>
      <div className="panel">
        {movimientos.length === 0 ? (
          <div className="empty">Los movimientos aparecen al crear ítems o ventas.</div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Detalle</th>
                  <th>Cantidad</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m) => (
                  <tr key={m.id}>
                    <td>{m.tipo}</td>
                    <td>{m.detalle}</td>
                    <td>{m.cantidad}</td>
                    <td><small>{formatDate(m.fecha)}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
