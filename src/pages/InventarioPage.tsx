import { useCallback, useEffect, useState } from 'react';
import { createMovement, listProducts } from '../api/stockea';
import { useAuth } from '../auth/AuthContext';
import BranchSelect from '../components/BranchSelect';
import Modal from '../components/Modal';
import { pickDefaultBranchId, productBranchLabel } from '../domain/branches';
import { useOrgBranches } from '../hooks/useOrgBranches';
import type { Product } from '../types';
import { formatMoney, formatQuantity, stockBadge } from '../utils/format';
import { buildRestockNote } from '../utils/restockNote';
import { downloadInventoryExcel, printInventoryPdf } from '../utils/inventoryExport';
import { localDateToISO, todayLocalDate } from '../utils/materialPurchase';
import { useCloudRefresh } from '../hooks/useCloudRefresh';
import { useMaintenance } from '../hooks/useMaintenance';

export default function InventarioPage() {
  const { session } = useAuth();
  const { blocked, blockedMessage } = useMaintenance();
  const [productos, setProductos] = useState<Product[]>([]);
  const sucursales = useOrgBranches();
  const [filtro, setFiltro] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroSucursal, setFiltroSucursal] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    product_id: '', movement_type: 'in' as 'in' | 'out' | 'adjustment',
    quantity: '1', note: '', branch_id: '',
    total_purchase: '', unit_cost: '', unit_price: '',
    supplier: '', purchase_date: todayLocalDate(),
  });

  const selectedProduct = productos.find((p) => p.id === form.product_id);

  const cargar = useCallback(async () => {
    if (!session?.token || !session.orgId) return;
    const all: Product[] = [];
    for (let page = 1; page <= 20; page += 1) {
      const result = await listProducts(session.token, session.orgId, { limit: 1000, page });
      all.push(...result.items);
      if (result.items.length < 1000 || all.length >= (result.total || 0)) break;
    }
    setProductos(all);
    setLoading(false);
  }, [session]);

  useEffect(() => { cargar().catch(console.error); }, [cargar]);
  useCloudRefresh(cargar, Boolean(session?.token && session.orgId));

  useEffect(() => {
    if (!modalOpen || form.branch_id) return;
    const branchId = pickDefaultBranchId(sucursales);
    if (!branchId) return;
    setForm((prev) => (prev.branch_id ? prev : { ...prev, branch_id: branchId }));
  }, [modalOpen, form.branch_id, sucursales]);

  const filtrados = productos.filter((p) => {
    const q = filtro.toLowerCase();
    const matchQ = !q || p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
    const badge = stockBadge(p);
    const matchE = !filtroEstado || badge.label === filtroEstado;
    const matchB = !filtroSucursal || p.branch_id === filtroSucursal;
    return matchQ && matchE && matchB;
  });

  const handleMovimiento = async () => {
    if (!session?.token || !session.orgId || !form.product_id) return;
    setError('');
    if (blocked) {
      setError(blockedMessage);
      return;
    }
    const isMaterialIn = form.movement_type === 'in' && selectedProduct?.item_type === 'material';
    if (sucursales.length > 0 && !form.branch_id) {
      setError('Selecciona la sucursal');
      return;
    }
    if (isMaterialIn) {
      if (!form.supplier.trim()) {
        setError('Ingresa el proveedor');
        return;
      }
      if (!form.total_purchase.trim() || +form.total_purchase <= 0) {
        setError('Ingresa el precio total de la compra');
        return;
      }
    }
    try {
      let note = form.note || undefined;
      if (form.movement_type === 'in' && selectedProduct && selectedProduct.item_type !== 'material') {
        const restockNote = buildRestockNote(form.note, {
          unitCost: form.unit_cost ? +form.unit_cost : undefined,
          unitPrice: form.unit_price ? +form.unit_price : undefined,
          unit: selectedProduct.unit,
        });
        if (restockNote) note = restockNote;
      }
      await createMovement(session.token, session.orgId, form.product_id, {
        movement_type: form.movement_type,
        quantity: +form.quantity,
        note,
        ...(form.branch_id ? { branch_id: form.branch_id } : {}),
        ...(isMaterialIn ? {
          purchased_at: localDateToISO(form.purchase_date),
          supplier: form.supplier.trim(),
          total_purchase: +form.total_purchase,
        } : {}),
      });
      setSuccess('Movimiento registrado');
      setModalOpen(false);
      setForm({
        product_id: '', movement_type: 'in', quantity: '1', note: '', branch_id: '',
        total_purchase: '', unit_cost: '', unit_price: '',
        supplier: '', purchase_date: todayLocalDate(),
      });
      cargar();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  };

  if (loading) return <div className="empty">Cargando inventario...</div>;

  const orgName = session?.organizations.find((o) => o.id === session.orgId)?.name;
  const sucursalFiltro = sucursales.find((b) => b.id === filtroSucursal);
  const exportMeta = {
    orgName,
    search: filtro,
    statusFilter: filtroEstado,
    branchLabel: sucursalFiltro ? productBranchLabel({ branch_name: sucursalFiltro.name, branch_code: sucursalFiltro.code }) : '',
  };
  const exportError = (e: unknown) => {
    setError(e instanceof Error ? e.message : 'No se pudo exportar el inventario');
  };

  return (
    <>
      <div className="page-header">
        <h2>Inventario</h2>
        <div className="report-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              try {
                printInventoryPdf(filtrados, exportMeta);
              } catch (e) {
                exportError(e);
              }
            }}
            disabled={filtrados.length === 0}
          >
            Imprimir PDF
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              try {
                downloadInventoryExcel(filtrados, exportMeta);
              } catch (e) {
                exportError(e);
              }
            }}
            disabled={filtrados.length === 0}
          >
            Descargar Excel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              setError('');
              setForm((prev) => ({ ...prev, branch_id: pickDefaultBranchId(sucursales) }));
              setModalOpen(true);
            }}
            disabled={blocked}
            title={blocked ? blockedMessage : undefined}
          >
            + Registrar movimiento
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {blocked && <div className="alert alert-error">{blockedMessage}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="panel">
        <div className="filter-bar">
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="OK">OK</option>
            <option value="Bajo">Bajo</option>
            <option value="Agotado">Agotado</option>
          </select>
          {sucursales.length > 0 && (
            <select value={filtroSucursal} onChange={(e) => setFiltroSucursal(e.target.value)}>
              <option value="">Todas las sucursales</option>
              {sucursales.map((b) => (
                <option key={b.id} value={b.id}>{productBranchLabel({ branch_name: b.name, branch_code: b.code })}</option>
              ))}
            </select>
          )}
          <input
            placeholder="Buscar SKU o producto..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            style={{ flex: 1, minWidth: 200 }}
          />
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU</th><th>Producto</th><th>Sucursal</th><th>Categoría</th>
                <th>Cantidad</th><th>Mínimo</th><th>Estado</th><th>Actualizado</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan={8} className="empty">Sin resultados</td></tr>
              ) : filtrados.map((p) => {
                const badge = stockBadge(p);
                return (
                  <tr key={p.id}>
                    <td><code>{p.sku}</code></td>
                    <td>{p.name}</td>
                    <td>{productBranchLabel(p)}</td>
                    <td>{p.category}</td>
                    <td>{formatQuantity(p.quantity, p.unit)}</td>
                    <td>{formatQuantity(p.min_quantity, p.unit)}</td>
                    <td><span className={`badge ${badge.className}`}>{badge.label}</span></td>
                    <td>{new Date(p.updated_at).toLocaleDateString('es-MX')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={modalOpen}
        title="Registrar movimiento"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleMovimiento}>Registrar</button>
          </>
        }
      >
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-grid">
          <div className="form-field full">
            <label>Producto *</label>
            <select
              value={form.product_id}
              onChange={(e) => {
                const product = productos.find((p) => p.id === e.target.value);
                setForm({
                  ...form,
                  product_id: e.target.value,
                  branch_id: product?.branch_id || pickDefaultBranchId(sucursales),
                });
              }}
              required
            >
              <option value="">Seleccionar producto...</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name} ({formatQuantity(p.quantity, p.unit)})
                </option>
              ))}
            </select>
          </div>
          <BranchSelect
            id="movimiento-sucursal"
            branches={sucursales}
            value={form.branch_id}
            onChange={(branchId) => setForm({ ...form, branch_id: branchId })}
          />
          <div className="form-field">
            <label>Tipo de movimiento</label>
            <select
              value={form.movement_type}
              onChange={(e) => setForm({ ...form, movement_type: e.target.value as 'in' | 'out' | 'adjustment' })}
            >
              <option value="in">Entrada</option>
              <option value="out">Salida</option>
              <option value="adjustment">Ajuste (cantidad final)</option>
            </select>
          </div>
          <div className="form-field">
            <label>Cantidad</label>
            <input
              type="number"
              min="0"
              step="any"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </div>
          <div className="form-field full">
            <label>Nota</label>
            <textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              rows={2}
              placeholder="Motivo del movimiento..."
            />
          </div>
          {form.movement_type === 'in' && selectedProduct && (
            <>
              <p className="form-section-label full">Precio de esta entrada (no modifica el producto)</p>
              <div className="form-field">
                <label>Costo unitario actual</label>
                <input value={formatMoney(selectedProduct.unit_cost)} readOnly disabled />
              </div>
              {selectedProduct.item_type === 'material' ? (
                <>
                  <div className="form-field">
                    <label>Fecha de compra</label>
                    <input
                      type="date"
                      value={form.purchase_date}
                      onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
                    />
                  </div>
                  <div className="form-field">
                    <label>Proveedor</label>
                    <input
                      value={form.supplier}
                      onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                      placeholder="Proveedor de esta compra"
                    />
                  </div>
                  <div className="form-field">
                    <label>Precio total de esta compra</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.total_purchase}
                      onChange={(e) => setForm({ ...form, total_purchase: e.target.value })}
                      placeholder="Total pagado"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="form-field">
                    <label>Costo de esta compra</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.unit_cost}
                      onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
                      placeholder="Costo unitario de la compra"
                    />
                  </div>
                  <div className="form-field">
                    <label>Precio venta (referencia)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.unit_price}
                      onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                      placeholder="Opcional"
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>
        {form.movement_type === 'adjustment' && (
          <p className="form-hint">En ajuste, la cantidad indica el stock final deseado.</p>
        )}
      </Modal>
    </>
  );
}
