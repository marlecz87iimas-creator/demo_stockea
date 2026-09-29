import { useCallback, useEffect, useMemo, useState } from 'react';
import { createMovement, createProduct, deleteProduct, listProducts, updateProduct } from '../api/stockea';
import { useAuth } from '../auth/AuthContext';
import BranchSelect from '../components/BranchSelect';
import Modal from '../components/Modal';
import { pickDefaultBranchId, productBranchLabel } from '../domain/branches';
import { previewSku } from '../domain/sku';
import { useOrgBranches } from '../hooks/useOrgBranches';
import type { ItemType, Product } from '../types';
import { formatMoney, formatQuantity, stockBadge } from '../utils/format';
import { buildRestockNote } from '../utils/restockNote';
import { useCloudRefresh } from '../hooks/useCloudRefresh';
import { useMaintenance } from '../hooks/useMaintenance';

const emptyForm = {
  sku: '', name: '', description: '', category: '', unit: 'pz',
  item_type: 'product' as ItemType,
  quantity: '0', min_quantity: '5', unit_cost: '0', unit_price: '0',
  branchId: '',
};

const itemTypeLabel = (t: ItemType) => (t === 'material' ? 'Material' : 'Producto');

export default function ProductosPage() {
  const { session } = useAuth();
  const sucursales = useOrgBranches();
  const { blocked, blockedMessage } = useMaintenance();
  const [productos, setProductos] = useState<Product[]>([]);
  const [filtro, setFiltro] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroSucursal, setFiltroSucursal] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [restockOpen, setRestockOpen] = useState(false);
  const [restockTarget, setRestockTarget] = useState<Product | null>(null);
  const [restockForm, setRestockForm] = useState({ quantity: '', unit_cost: '', unit_price: '', note: '', branchId: '' });
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!session?.token || !session.orgId) return;
    const result = await listProducts(session.token, session.orgId, { limit: 100 });
    setProductos(result.items);
    setLoading(false);
  }, [session]);

  const systemSlug = useMemo(() => {
    const org = session?.organizations.find((o) => o.id === session.orgId);
    return org?.slug || org?.name || 'sistema';
  }, [session]);

  useEffect(() => { cargar().catch(console.error); }, [cargar]);
  useCloudRefresh(cargar, Boolean(session?.token && session.orgId));

  useEffect(() => {
    if (!modalOpen || editId || form.branchId) return;
    const branchId = pickDefaultBranchId(sucursales);
    if (!branchId) return;
    setForm((prev) => (prev.branchId ? prev : { ...prev, branchId }));
  }, [modalOpen, editId, form.branchId, sucursales]);

  useEffect(() => {
    if (!modalOpen || editId) return;
    const sku = previewSku(form.item_type, systemSlug, form.name, productos);
    setForm((prev) => (prev.sku === sku ? prev : { ...prev, sku }));
  }, [modalOpen, editId, form.item_type, form.name, systemSlug, productos]);

  const categorias = [...new Set(productos.map((p) => p.category).filter(Boolean))].sort();
  const isMaterial = form.item_type === 'material';

  const filtrados = productos.filter((p) => {
    const q = filtro.toLowerCase();
    const matchQ = !q || p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
    const matchC = !filtroCategoria || p.category === filtroCategoria;
    const matchT = !filtroTipo || p.item_type === filtroTipo;
    const matchB = !filtroSucursal || p.branch_id === filtroSucursal;
    return matchQ && matchC && matchT && matchB;
  });

  const abrirModal = () => {
    setForm({ ...emptyForm, branchId: pickDefaultBranchId(sucursales) });
    setEditId(null);
    setError('');
    setRestockOpen(false);
    setModalOpen(true);
  };

  const abrirEditar = (p: Product) => {
    setForm({
      sku: p.sku, name: p.name, description: p.description ?? '',
      category: p.category || '', unit: p.unit || 'pz',
      item_type: p.item_type ?? 'product',
      quantity: String(p.quantity), min_quantity: String(p.min_quantity),
      unit_cost: String(p.unit_cost), unit_price: String(p.unit_price),
      branchId: p.branch_id || pickDefaultBranchId(sucursales),
    });
    setEditId(p.id);
    setError('');
    setRestockOpen(false);
    setModalOpen(true);
  };

  const abrirRestock = (p: Product) => {
    setRestockTarget(p);
    setRestockForm({
      quantity: '',
      unit_cost: '',
      unit_price: '',
      note: '',
      branchId: p.branch_id || pickDefaultBranchId(sucursales),
    });
    setError('');
    setModalOpen(false);
    setRestockOpen(true);
  };

  const guardarRestock = async () => {
    if (!session?.token || !session.orgId || !restockTarget) return;
    setError('');
    if (blocked) {
      setError(blockedMessage);
      return;
    }
    const qty = +restockForm.quantity;
    if (!restockForm.quantity.trim() || Number.isNaN(qty) || qty <= 0) {
      setError('Ingresa una cantidad válida');
      return;
    }
    if (sucursales.length > 0 && !restockForm.branchId) {
      setError('Selecciona la sucursal');
      return;
    }
    const note = buildRestockNote(restockForm.note, {
      unitCost: +restockForm.unit_cost || undefined,
      unitPrice: +restockForm.unit_price || undefined,
      unit: restockTarget.unit,
    });
    try {
      await createMovement(session.token, session.orgId, restockTarget.id, {
        movement_type: 'in',
        quantity: qty,
        note,
        ...(restockForm.branchId ? { branch_id: restockForm.branchId } : {}),
      });
      setRestockOpen(false);
      setRestockTarget(null);
      cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al agregar stock');
    }
  };

  const guardar = async () => {
    if (!session?.token || !session.orgId) return;
    setError('');
    if (blocked) {
      setError(blockedMessage);
      return;
    }
    if (!form.name.trim()) {
      setError('Ingresa el nombre');
      return;
    }
    if (!editId && form.sku.endsWith('-...')) {
      setError('Ingresa el nombre para completar el SKU');
      return;
    }
    if (sucursales.length > 0 && !form.branchId) {
      setError('Selecciona la sucursal');
      return;
    }
    try {
      if (editId) {
        await updateProduct(session.token, session.orgId, editId, {
          ...(form.item_type === 'product' ? { sku: form.sku.trim() } : {}),
          name: form.name.trim(),
          description: form.description,
          category: form.category,
          unit: form.unit,
          min_quantity: +form.min_quantity,
          unit_cost: +form.unit_cost,
          unit_price: +form.unit_price,
          ...(form.branchId ? { branch_id: form.branchId } : {}),
        });
      } else {
        const payload = {
          name: form.name.trim(),
          description: form.description,
          category: form.category,
          unit: form.unit,
          item_type: form.item_type,
          quantity: +form.quantity || 0,
          min_quantity: +form.min_quantity,
          unit_cost: +form.unit_cost,
          unit_price: +form.unit_price,
          ...(form.branchId ? { branch_id: form.branchId } : {}),
        };
        await createProduct(session.token, session.orgId, payload);
      }
      setModalOpen(false);
      setEditId(null);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    }
  };

  const eliminar = async (id: string) => {
    if (!session?.token || !session.orgId) return;
    if (blocked) {
      alert(blockedMessage);
      return;
    }
    if (!confirm('¿Eliminar este producto?')) return;
    try {
      await deleteProduct(session.token, session.orgId, id);
      cargar();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al eliminar');
    }
  };

  if (loading) return <div className="empty">Cargando productos...</div>;

  return (
    <>
      <div className="page-header">
        <h2>Productos y materiales</h2>
        <button
          className="btn btn-primary"
          onClick={abrirModal}
          disabled={blocked}
          title={blocked ? blockedMessage : undefined}
        >
          + Nuevo ítem
        </button>
      </div>

      {blocked && <div className="alert alert-error">{blockedMessage}</div>}

      <div className="panel">
        <div className="filter-bar">
          <input
            placeholder="Buscar SKU o nombre..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            style={{ flex: 1, minWidth: 200 }}
          />
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
            <option value="">Productos y materiales</option>
            <option value="product">Solo productos</option>
            <option value="material">Solo materiales</option>
          </select>
          {sucursales.length > 0 && (
            <select value={filtroSucursal} onChange={(e) => setFiltroSucursal(e.target.value)}>
              <option value="">Todas las sucursales</option>
              {sucursales.map((b) => (
                <option key={b.id} value={b.id}>{productBranchLabel({ branch_name: b.name, branch_code: b.code })}</option>
              ))}
            </select>
          )}
          <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
            <option value="">Todas las categorías</option>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU</th><th>Nombre</th><th>Sucursal</th><th>Tipo</th><th>Categoría</th>
                <th>Stock</th><th>Mínimo</th><th>Costo</th><th>Precio</th>
                <th>Estado</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan={11} className="empty">Sin productos</td></tr>
              ) : filtrados.map((p) => {
                const badge = stockBadge(p);
                return (
                  <tr key={p.id}>
                    <td><code>{p.sku}</code></td>
                    <td>{p.name}</td>
                    <td>{productBranchLabel(p)}</td>
                    <td>
                      <span className={`badge ${p.item_type === 'material' ? 'badge-bajo' : 'badge-ok'}`}>
                        {itemTypeLabel(p.item_type ?? 'product')}
                      </span>
                    </td>
                    <td>{p.category}</td>
                    <td>{formatQuantity(p.quantity, p.unit)}</td>
                    <td>{formatQuantity(p.min_quantity, p.unit)}</td>
                    <td>{formatMoney(p.unit_cost)}</td>
                    <td>{formatMoney(p.unit_price)}</td>
                    <td><span className={`badge ${badge.className}`}>{badge.label}</span></td>
                    <td className="actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => abrirRestock(p)}>Agregar stock</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => abrirEditar(p)}>Editar</button>
                      <button className="btn btn-danger btn-sm" onClick={() => eliminar(p.id)}>Eliminar</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={modalOpen}
        title={editId ? 'Editar ítem' : 'Nuevo ítem'}
        onClose={() => { setModalOpen(false); setEditId(null); }}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => { setModalOpen(false); setEditId(null); }}>Cancelar</button>
            <button type="submit" form="producto-form" className="btn btn-primary">Guardar</button>
          </>
        }
      >
        {error && <div className="alert alert-error">{error}</div>}
        <form
          id="producto-form"
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            void guardar();
          }}
        >
          <BranchSelect
            id="producto-sucursal"
            branches={sucursales}
            value={form.branchId}
            onChange={(branchId) => setForm({ ...form, branchId })}
          />
          {!editId && (
            <div className="form-field full">
              <label htmlFor="item-type">Tipo de ítem</label>
              <select
                id="item-type"
                value={form.item_type}
                onChange={(e) => setForm({ ...form, item_type: e.target.value as ItemType, sku: '' })}
              >
                <option value="product">Producto</option>
                <option value="material">Material</option>
              </select>
            </div>
          )}
          {(!editId || form.item_type === 'product') && (
            <div className="form-field full">
              <label>SKU{!editId ? '' : ' *'}</label>
              <input
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                required={Boolean(editId && form.item_type === 'product')}
                readOnly={!editId}
                disabled={!editId}
              />
              {!editId && (
                <span className="form-hint">
                  Formato: stk-nomSistema-prod|mat-numConsecutivo-nombreItem
                  (usa el slug de la organización como nomSistema).
                </span>
              )}
            </div>
          )}
          {editId && isMaterial && (
            <div className="form-field full">
              <label>SKU</label>
              <input value={form.sku} readOnly disabled />
            </div>
          )}
          <div className="form-field">
            <label>Nombre *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="form-field full">
            <label>Descripción</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
          </div>
          <div className="form-field">
            <label>Categoría{isMaterial ? ' *' : ''}</label>
            <input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder={isMaterial ? 'Ej. tela, hilo, pegamento' : 'general'}
              required={isMaterial && !editId}
            />
          </div>
          <div className="form-field">
            <label>Unidad</label>
            <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="pz, kg, lt..." />
          </div>
          {!editId && (
            <div className="form-field">
              <label>Stock inicial</label>
              <input type="number" min="0" step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
          )}
          <div className="form-field">
            <label>Stock mínimo</label>
            <input type="number" min="0" step="any" value={form.min_quantity} onChange={(e) => setForm({ ...form, min_quantity: e.target.value })} />
          </div>
          <div className="form-field">
            <label>Costo unitario</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.unit_cost}
              onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
            />
            {editId && (
              <span className="form-hint">Al agregar stock, el precio de la nueva compra no cambia este valor.</span>
            )}
          </div>
          <div className="form-field">
            <label>Precio de venta</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.unit_price}
              onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
            />
          </div>
          {editId && (
            <div className="form-field full">
              <label>Stock actual</label>
              <input value={formatQuantity(+form.quantity, form.unit)} readOnly disabled />
              <span className="form-hint">Usa &quot;Agregar stock&quot; para registrar nuevas entradas con precio de compra.</span>
            </div>
          )}
        </form>
      </Modal>

      <Modal
        open={restockOpen}
        title={restockTarget ? `Agregar stock — ${restockTarget.name}` : 'Agregar stock'}
        onClose={() => setRestockOpen(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setRestockOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardarRestock}>Agregar</button>
          </>
        }
      >
        {error && <div className="alert alert-error">{error}</div>}
        {restockTarget && (
          <div className="form-grid">
            <BranchSelect
              id="restock-sucursal"
              branches={sucursales}
              value={restockForm.branchId}
              onChange={(branchId) => setRestockForm({ ...restockForm, branchId })}
            />
            <div className="form-field">
              <label>Costo unitario actual</label>
              <input value={formatMoney(restockTarget.unit_cost)} readOnly disabled />
            </div>
            <div className="form-field">
              <label>Precio venta actual</label>
              <input value={formatMoney(restockTarget.unit_price)} readOnly disabled />
            </div>
            <div className="form-field">
              <label>Cantidad a agregar *</label>
              <input
                type="number"
                min="0"
                step="any"
                value={restockForm.quantity}
                onChange={(e) => setRestockForm({ ...restockForm, quantity: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label>Costo de esta compra</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={restockForm.unit_cost}
                onChange={(e) => setRestockForm({ ...restockForm, unit_cost: e.target.value })}
                placeholder="Costo unitario de la compra"
              />
            </div>
            <div className="form-field">
              <label>Precio venta (opcional)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={restockForm.unit_price}
                onChange={(e) => setRestockForm({ ...restockForm, unit_price: e.target.value })}
                placeholder="Solo referencia en la nota"
              />
            </div>
            <div className="form-field full">
              <label>Nota</label>
              <input
                value={restockForm.note}
                onChange={(e) => setRestockForm({ ...restockForm, note: e.target.value })}
                placeholder="Proveedor, factura..."
              />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
