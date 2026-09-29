import { useCallback, useEffect, useState } from 'react';
import { deleteMovement, listMovements, listProducts } from '../api/stockea';
import { useAuth } from '../auth/AuthContext';
import { movementTypeBadge, movementTypeLabel } from '../auth/auth';
import type { Product, StockMovement } from '../types';
import { formatDateOnly, formatMoney, formatQuantity } from '../utils/format';
import { isMaterialPurchase } from '../utils/materialPurchase';
import { useCloudRefresh } from '../hooks/useCloudRefresh';
import { useMaintenance } from '../hooks/useMaintenance';

export default function MovimientosPage() {
  const { session } = useAuth();
  const { blocked, blockedMessage } = useMaintenance();
  const [movimientos, setMovimientos] = useState<StockMovement[]>([]);
  const [productos, setProductos] = useState<Map<string, Product>>(new Map());
  const [filtroTipo, setFiltroTipo] = useState('');
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!session?.token || !session.orgId) return;
    const [movResult, prodResult] = await Promise.all([
      listMovements(session.token, session.orgId, { limit: 50 }),
      listProducts(session.token, session.orgId, { limit: 100 }),
    ]);
    setMovimientos(movResult.items);
    setProductos(new Map(prodResult.items.map((p) => [p.id, p])));
    setLoading(false);
  }, [session]);

  useEffect(() => { cargar().catch(console.error); }, [cargar]);
  useCloudRefresh(cargar, Boolean(session?.token && session.orgId));

  const filtrados = movimientos.filter((m) => !filtroTipo || m.movement_type === filtroTipo);

  const puedeEliminar = (m: StockMovement) => !m.note?.startsWith('Venta ');

  const eliminar = async (m: StockMovement) => {
    if (!session?.token || !session.orgId) return;
    if (blocked) {
      alert(blockedMessage);
      return;
    }
    if (!puedeEliminar(m)) {
      alert('Los movimientos generados por ventas no se pueden eliminar.');
      return;
    }
    if (!confirm('¿Eliminar este movimiento? Se revertirá el cambio en el stock.')) return;
    try {
      await deleteMovement(session.token, session.orgId, m.id);
      cargar();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al eliminar');
    }
  };

  if (loading) return <div className="empty">Cargando movimientos...</div>;

  return (
    <>
      <div className="page-header">
        <h2>Movimientos</h2>
      </div>

      <div className="panel">
        <div className="filter-bar">
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
            <option value="">Todos los tipos</option>
            <option value="in">Entradas</option>
            <option value="out">Salidas</option>
            <option value="adjustment">Ajustes</option>
          </select>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th><th>Producto</th><th>Tipo</th>
                <th>Cantidad</th><th>Saldo</th><th>Proveedor</th><th>Compra</th><th>Nota</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan={9} className="empty">Sin movimientos registrados</td></tr>
              ) : filtrados.map((m) => {
                const producto = productos.get(m.product_id);
                const compra = isMaterialPurchase(m);
                return (
                  <tr key={m.id}>
                    <td>{formatDateOnly(m.purchased_at || m.created_at)}</td>
                    <td>
                      {producto ? (
                        <><code>{producto.sku}</code> {producto.name}</>
                      ) : (
                        <span className="text-muted">{m.product_id.slice(0, 8)}...</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${movementTypeBadge(m.movement_type)}`}>
                        {movementTypeLabel(m.movement_type)}
                      </span>
                    </td>
                    <td>{formatQuantity(m.quantity, producto?.unit)}</td>
                    <td>{formatQuantity(m.balance_after, producto?.unit)}</td>
                    <td>{compra ? (m.supplier || '—') : '—'}</td>
                    <td>{compra && m.total_purchase != null ? formatMoney(m.total_purchase) : '—'}</td>
                    <td>{m.note || '—'}</td>
                    <td className="actions">
                      {puedeEliminar(m) && (
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => eliminar(m)}>
                          Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
