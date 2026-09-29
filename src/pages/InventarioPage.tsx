import { money } from '../demo/config';
import { useDemo } from '../demo/DataContext';

export default function InventarioPage() {
  const { productos, materiales } = useDemo();
  const items = [
    ...productos.map((p) => ({ ...p, tipo: 'Producto' })),
    ...materiales.map((m) => ({ ...m, tipo: 'Material' })),
  ];

  return (
    <div>
      <div className="page-header">
        <h2>Inventario</h2>
      </div>
      <div className="panel">
        {items.length === 0 ? (
          <div className="empty">El inventario se llena al crear productos o materiales.</div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>SKU</th>
                  <th>Nombre</th>
                  <th>Stock</th>
                  <th>Precio / costo</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.tipo}</td>
                    <td>{item.sku}</td>
                    <td>{item.name}</td>
                    <td>{item.quantity}</td>
                    <td>{money(item.unitPrice)}</td>
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
