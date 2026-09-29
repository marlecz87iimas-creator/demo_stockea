import { useCallback, useEffect, useMemo, useState } from 'react';
import { createMovement, createProduct, deleteProduct, listProductMovements, listProducts, updateProduct } from '../api/stockea';
import { useAuth } from '../auth/AuthContext';
import BranchSelect from '../components/BranchSelect';
import Modal from '../components/Modal';
import {
  decodeMaterialDescription,
  encodeMaterialDescription,
  formatMaterialWidth,
  isKnownMaterialColor,
  materialUnitCost,
  materialUnitCostLabel,
  MATERIAL_COLORS,
  MATERIAL_UNITS,
  normalizeMaterialUnit,
} from '../domain/materialTypes';
import { previewSku } from '../domain/sku';
import { pickDefaultBranchId, productBranchLabel } from '../domain/branches';
import { useOrgBranches } from '../hooks/useOrgBranches';
import type { Product, StockMovement } from '../types';
import { formatDateOnly, formatMoney, formatQuantity, stockBadge } from '../utils/format';
import { isMaterialPurchase, localDateToISO, todayLocalDate } from '../utils/materialPurchase';
import { useCloudRefresh } from '../hooks/useCloudRefresh';
import { useMaintenance } from '../hooks/useMaintenance';

const emptyForm = {
  name: '',
  category: '',
  tipo: '',
  color: 'Natural' as string,
  customColor: '',
  quantity: '',
  ancho: '',
  unit: 'cm' as (typeof MATERIAL_UNITS)[number],
  supplier: '',
  total_purchase: '',
  purchase_date: todayLocalDate(),
  min_quantity: '5',
  registered_unit_cost: '',
  branchId: '',
};

const emptyRestockForm = {
  quantity: '',
  total_purchase: '',
  supplier: '',
  purchase_date: todayLocalDate(),
  note: '',
  branchId: '',
};

function materialTypeLabel(category: string): string {
  return category || '—';
}

export default function MaterialesPage() {
  const { session } = useAuth();
  const sucursales = useOrgBranches();
  const { blocked, blockedMessage } = useMaintenance();
  const [materiales, setMateriales] = useState<Product[]>([]);
  const [filtro, setFiltro] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroSucursal, setFiltroSucursal] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [restockOpen, setRestockOpen] = useState(false);
  const [restockTarget, setRestockTarget] = useState<Product | null>(null);
  const [restockForm, setRestockForm] = useState(emptyRestockForm);
  const [historialOpen, setHistorialOpen] = useState(false);
  const [historialTarget, setHistorialTarget] = useState<Product | null>(null);
  const [historialCompras, setHistorialCompras] = useState<StockMovement[]>([]);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!session?.token || !session.orgId) return;
    const result = await listProducts(session.token, session.orgId, {
      limit: 200,
      item_type: 'material',
    });
    setMateriales(result.items);
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

  const tiposEnUso = useMemo(
    () => [...new Set(materiales.map((m) => m.category).filter(Boolean))].sort(),
    [materiales],
  );

  const filtrados = materiales.filter((m) => {
    const q = filtro.toLowerCase();
    const extra = decodeMaterialDescription(m.description);
    const matchQ = !q
      || m.sku.toLowerCase().includes(q)
      || m.name.toLowerCase().includes(q)
      || m.category.toLowerCase().includes(q)
      || extra.supplier.toLowerCase().includes(q)
      || extra.color.toLowerCase().includes(q)
      || extra.tipo.toLowerCase().includes(q)
      || extra.ancho.toLowerCase().includes(q);
    const matchT = !filtroTipo || m.category === filtroTipo;
    const matchB = !filtroSucursal || m.branch_id === filtroSucursal;
    return matchQ && matchT && matchB;
  });

  const resolvedColor = form.color === 'Otro'
    ? form.customColor.trim()
    : form.color;

  const computedUnitCost = useMemo(() => {
    const total = Number(form.total_purchase);
    const qty = Number(form.quantity);
    return materialUnitCost(total, qty);
  }, [form.total_purchase, form.quantity]);

  const abrirModal = () => {
    setForm({ ...emptyForm, purchase_date: todayLocalDate(), branchId: pickDefaultBranchId(sucursales) });
    setEditId(null);
    setError('');
    setRestockOpen(false);
    setHistorialOpen(false);
    setModalOpen(true);
  };

  const abrirEditar = (m: Product) => {
    const extra = decodeMaterialDescription(m.description);
    const color = extra.color || MATERIAL_COLORS[0];
    setForm({
      name: m.name,
      category: m.category || '',
      tipo: extra.tipo || '',
      color: isKnownMaterialColor(color) ? color : 'Otro',
      customColor: isKnownMaterialColor(color) ? '' : color,
      quantity: String(m.quantity),
      ancho: extra.ancho,
      unit: normalizeMaterialUnit(m.unit),
      supplier: '',
      total_purchase: '',
      purchase_date: todayLocalDate(),
      min_quantity: String(m.min_quantity),
      registered_unit_cost: String(m.unit_cost),
      branchId: m.branch_id || pickDefaultBranchId(sucursales),
    });
    setEditId(m.id);
    setError('');
    setRestockOpen(false);
    setModalOpen(true);
  };

  const abrirRestock = (m: Product) => {
    setRestockTarget(m);
    setRestockForm({
      ...emptyRestockForm,
      purchase_date: todayLocalDate(),
      branchId: m.branch_id || pickDefaultBranchId(sucursales),
    });
    setError('');
    setModalOpen(false);
    setHistorialOpen(false);
    setRestockOpen(true);
  };

  const abrirHistorial = async (m: Product) => {
    if (!session?.token || !session.orgId) return;
    setHistorialTarget(m);
    setHistorialCompras([]);
    setHistorialLoading(true);
    setHistorialOpen(true);
    setModalOpen(false);
    setRestockOpen(false);
    setError('');
    try {
      const result = await listProductMovements(session.token, session.orgId, m.id, { limit: 100 });
      setHistorialCompras(result.items.filter(isMaterialPurchase));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar compras');
    } finally {
      setHistorialLoading(false);
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
      setError('Ingresa el nombre del material');
      return;
    }
    if (sucursales.length > 0 && !form.branchId) {
      setError('Selecciona la sucursal');
      return;
    }
    if (!form.category.trim()) {
      setError('Ingresa el tipo de material');
      return;
    }
    if (!form.tipo.trim()) {
      setError('Ingresa el tipo');
      return;
    }
    if (!resolvedColor) {
      setError('Selecciona o escribe el color');
      return;
    }
    if (!editId) {
      if (form.quantity.trim() === '' || Number.isNaN(Number(form.quantity))) {
        setError('Ingresa la cantidad');
        return;
      }
      if (+form.quantity <= 0) {
        setError('La cantidad debe ser mayor a cero para calcular el precio unitario');
        return;
      }
      if (!form.supplier.trim()) {
        setError('Ingresa el proveedor de esta compra');
        return;
      }
      if (!form.total_purchase.trim() || +form.total_purchase <= 0) {
        setError('Ingresa el precio total de la compra');
        return;
      }
    }

    const unitCost = editId
      ? undefined
      : materialUnitCost(+form.total_purchase || 0, +form.quantity);

    const payload = {
      name: form.name.trim(),
      category: form.category.trim(),
      unit: form.unit,
      description: encodeMaterialDescription({
        supplier: '',
        color: resolvedColor,
        tipo: form.tipo.trim(),
        ancho: form.ancho.trim(),
      }),
      item_type: 'material' as const,
      quantity: editId ? undefined : +form.quantity,
      min_quantity: +form.min_quantity || 0,
      unit_cost: unitCost,
      unit_price: 0,
    };

    try {
      if (editId) {
        await updateProduct(session.token, session.orgId, editId, {
          name: payload.name,
          category: payload.category,
          unit: payload.unit,
          description: payload.description,
          min_quantity: payload.min_quantity,
          unit_cost: +form.registered_unit_cost || 0,
          unit_price: 0,
          ...(form.branchId ? { branch_id: form.branchId } : {}),
        });
      } else {
        await createProduct(session.token, session.orgId, {
          ...payload,
          quantity: +form.quantity,
          unit_cost: unitCost ?? 0,
          unit_price: 0,
          ...(form.branchId ? { branch_id: form.branchId } : {}),
          initial_purchase: {
            purchased_at: localDateToISO(form.purchase_date),
            supplier: form.supplier.trim(),
            total_purchase: +form.total_purchase,
          },
        });
      }
      setModalOpen(false);
      setEditId(null);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    }
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
    if (!restockForm.supplier.trim()) {
      setError('Ingresa el proveedor');
      return;
    }
    const totalPurchase = +restockForm.total_purchase;
    if (!restockForm.total_purchase.trim() || Number.isNaN(totalPurchase) || totalPurchase <= 0) {
      setError('Ingresa el precio total de la compra');
      return;
    }
    try {
      await createMovement(session.token, session.orgId, restockTarget.id, {
        movement_type: 'in',
        quantity: qty,
        purchased_at: localDateToISO(restockForm.purchase_date),
        supplier: restockForm.supplier.trim(),
        total_purchase: totalPurchase,
        note: restockForm.note.trim() || undefined,
        ...(restockForm.branchId ? { branch_id: restockForm.branchId } : {}),
      });
      setRestockOpen(false);
      setRestockTarget(null);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al registrar compra');
    }
  };

  const eliminar = async (id: string) => {
    if (!session?.token || !session.orgId) return;
    if (blocked) {
      alert(blockedMessage);
      return;
    }
    if (!confirm('¿Eliminar este material?')) return;
    try {
      await deleteProduct(session.token, session.orgId, id);
      cargar();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al eliminar');
    }
  };

  const skuPreview = editId
    ? null
    : previewSku('material', systemSlug, form.name, materiales);

  if (loading) return <div className="empty">Cargando materiales...</div>;

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Materiales</h2>
          <p className="page-subtitle">Inventario de insumos para flores eternas</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={abrirModal}
          disabled={blocked}
          title={blocked ? blockedMessage : undefined}
        >
          + Nuevo material
        </button>
      </div>

      {blocked && <div className="alert alert-error">{blockedMessage}</div>}

      <div className="panel">
        <div className="filter-bar">
          <input
            placeholder="Buscar nombre, proveedor o SKU..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            style={{ flex: 1, minWidth: 200 }}
          />
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
            <option value="">Todos los tipos</option>
            {tiposEnUso.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {sucursales.length > 0 && (
            <select value={filtroSucursal} onChange={(e) => setFiltroSucursal(e.target.value)}>
              <option value="">Todas las sucursales</option>
              {sucursales.map((b) => (
                <option key={b.id} value={b.id}>{productBranchLabel({ branch_name: b.name, branch_code: b.code })}</option>
              ))}
            </select>
          )}
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Nombre</th>
                <th>Sucursal</th>
                <th>Tipo material</th>
                <th>Tipo</th>
                <th>Color</th>
                <th>Cantidad</th>
                <th>Medida</th>
                <th>Ancho (cm)</th>
                <th>Precio unitario ref.</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan={12} className="empty">Sin materiales registrados</td></tr>
              ) : filtrados.map((m) => {
                const badge = stockBadge(m);
                const extra = decodeMaterialDescription(m.description);
                return (
                  <tr key={m.id}>
                    <td><code>{m.sku}</code></td>
                    <td>{m.name}</td>
                    <td>{productBranchLabel(m)}</td>
                    <td>{materialTypeLabel(m.category)}</td>
                    <td>{extra.tipo || '—'}</td>
                    <td>{extra.color || '—'}</td>
                    <td>{formatQuantity(m.quantity, m.unit)}</td>
                    <td>{normalizeMaterialUnit(m.unit)}</td>
                    <td>{formatMaterialWidth(extra.ancho)}</td>
                    <td>{formatMoney(m.unit_cost)}<span className="text-muted"> / {normalizeMaterialUnit(m.unit)}</span></td>
                    <td><span className={`badge ${badge.className}`}>{badge.label}</span></td>
                    <td className="actions">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => abrirHistorial(m)}>Compras</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => abrirRestock(m)}>Registrar compra</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => abrirEditar(m)}>Editar</button>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => eliminar(m.id)}>Eliminar</button>
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
        title={editId ? 'Editar material' : 'Nuevo material'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => { setModalOpen(false); setEditId(null); }}>Cancelar</button>
            <button type="submit" form="material-form" className="btn btn-primary">Guardar</button>
          </>
        }
      >
        {error && <div className="alert alert-error">{error}</div>}
        <form
          id="material-form"
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            void guardar();
          }}
        >
          <BranchSelect
            id="material-sucursal"
            branches={sucursales}
            value={form.branchId}
            onChange={(branchId) => setForm({ ...form, branchId })}
          />
          <p className="form-section-label full">Tipo de material</p>
          <div className="form-field full">
            <label htmlFor="mat-category">Tipo de material *</label>
            <input
              id="mat-category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="Ej. Cinta, Tela, Flores preservadas..."
            />
          </div>

          <p className="form-section-label full">Tipo</p>
          <div className="form-field full">
            <label htmlFor="mat-tipo">Tipo *</label>
            <input
              id="mat-tipo"
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              placeholder="Ej. Encaje, Satín, Rosa..."
            />
          </div>

          <p className="form-section-label full">Color</p>
          <div className="form-field">
            <label htmlFor="mat-color">Color *</label>
            <select
              id="mat-color"
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
            >
              {MATERIAL_COLORS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          {form.color === 'Otro' && (
            <div className="form-field">
              <label htmlFor="mat-custom-color">Especificar color *</label>
              <input
                id="mat-custom-color"
                value={form.customColor}
                onChange={(e) => setForm({ ...form, customColor: e.target.value })}
                placeholder="Ej. Coral"
              />
            </div>
          )}

          <p className="form-section-label full">Detalle</p>
          <div className="form-field">
            <label htmlFor="mat-name">Nombre *</label>
            <input
              id="mat-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ej. Rosa roja preservada"
              required
            />
          </div>
          {!editId && skuPreview && (
            <div className="form-field">
              <label>SKU (auto)</label>
              <input value={skuPreview} readOnly disabled />
            </div>
          )}
          <p className="form-section-label full">Cantidad</p>
          {!editId ? (
            <>
              <div className="form-field">
                <label htmlFor="mat-qty">Cantidad *</label>
                <input
                  id="mat-qty"
                  type="number"
                  min="0"
                  step="any"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  placeholder="Ej. 10 metros, 5 piezas..."
                />
              </div>
              <div className="form-field">
                <label htmlFor="mat-unit">Medida de la cantidad *</label>
                <select
                  id="mat-unit"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value as typeof form.unit })}
                >
                  {MATERIAL_UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="form-field">
                <label>Stock actual</label>
                <input
                  value={formatQuantity(+form.quantity, form.unit)}
                  readOnly
                  disabled
                />
              </div>
              <div className="form-field">
                <label htmlFor="mat-unit-edit">Medida</label>
                <select
                  id="mat-unit-edit"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value as typeof form.unit })}
                >
                  {MATERIAL_UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
              <p className="form-hint full">
                Para agregar más stock usa &quot;Agregar stock&quot; en la tabla.
              </p>
            </>
          )}

          <p className="form-section-label full">Ancho</p>
          <div className="form-field full">
            <label htmlFor="mat-ancho">Ancho de la cinta / material (cm)</label>
            <input
              id="mat-ancho"
              type="number"
              min="0"
              step="any"
              value={form.ancho}
              onChange={(e) => setForm({ ...form, ancho: e.target.value })}
              placeholder="Ej. 2.5 — independiente de la medida de cantidad"
            />
          </div>
          <p className="form-section-label full">{editId ? 'Precio registrado' : 'Primera compra'}</p>
          {!editId ? (
            <>
              <div className="form-field">
                <label htmlFor="mat-purchase-date">Fecha de compra *</label>
                <input
                  id="mat-purchase-date"
                  type="date"
                  value={form.purchase_date}
                  onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="mat-supplier">Proveedor *</label>
                <input
                  id="mat-supplier"
                  value={form.supplier}
                  onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                  placeholder="Nombre del proveedor"
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="mat-total">Precio total de compra *</label>
                <input
                  id="mat-total"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.total_purchase}
                  onChange={(e) => setForm({ ...form, total_purchase: e.target.value })}
                  placeholder="Lo que pagaste en total"
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="mat-unit-cost">{materialUnitCostLabel(form.unit)}</label>
                <input
                  id="mat-unit-cost"
                  value={computedUnitCost > 0 ? formatMoney(computedUnitCost) : '—'}
                  readOnly
                  disabled
                />
                <span className="form-hint" style={{ marginTop: '0.35rem' }}>
                  Calculado: precio total ÷ cantidad. Queda como referencia del material.
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="form-field">
                <label htmlFor="mat-registered-cost">{materialUnitCostLabel(form.unit)} registrado</label>
                <input
                  id="mat-registered-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.registered_unit_cost}
                  onChange={(e) => setForm({ ...form, registered_unit_cost: e.target.value })}
                />
              </div>
              <p className="form-hint full">
                Cada compra se registra con fecha y proveedor desde &quot;Registrar compra&quot; o en Compras.
              </p>
            </>
          )}
          <div className="form-field">
            <label htmlFor="mat-min">Stock mínimo</label>
            <input
              id="mat-min"
              type="number"
              min="0"
              step="any"
              value={form.min_quantity}
              onChange={(e) => setForm({ ...form, min_quantity: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      <Modal
        open={restockOpen}
        title={restockTarget ? `Registrar compra — ${restockTarget.name}` : 'Registrar compra'}
        onClose={() => setRestockOpen(false)}
        large
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setRestockOpen(false)}>Cancelar</button>
            <button type="button" className="btn btn-primary" onClick={guardarRestock}>Registrar</button>
          </>
        }
      >
        {error && <div className="alert alert-error">{error}</div>}
        {restockTarget && (
          <div className="form-grid">
            <BranchSelect
              id="material-restock-sucursal"
              branches={sucursales}
              value={restockForm.branchId}
              onChange={(branchId) => setRestockForm({ ...restockForm, branchId })}
            />
            <div className="form-field">
              <label>Precio unitario ref. (no cambia)</label>
              <input value={formatMoney(restockTarget.unit_cost)} readOnly disabled />
            </div>
            <div className="form-field">
              <label htmlFor="restock-date">Fecha de compra *</label>
              <input
                id="restock-date"
                type="date"
                value={restockForm.purchase_date}
                onChange={(e) => setRestockForm({ ...restockForm, purchase_date: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="restock-supplier">Proveedor *</label>
              <input
                id="restock-supplier"
                value={restockForm.supplier}
                onChange={(e) => setRestockForm({ ...restockForm, supplier: e.target.value })}
                placeholder="Proveedor de esta compra"
              />
            </div>
            <div className="form-field">
              <label htmlFor="restock-qty">Cantidad *</label>
              <input
                id="restock-qty"
                type="number"
                min="0"
                step="any"
                value={restockForm.quantity}
                onChange={(e) => setRestockForm({ ...restockForm, quantity: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="restock-total">Precio total *</label>
              <input
                id="restock-total"
                type="number"
                min="0"
                step="0.01"
                value={restockForm.total_purchase}
                onChange={(e) => setRestockForm({ ...restockForm, total_purchase: e.target.value })}
                placeholder="Total pagado"
              />
            </div>
            <div className="form-field full">
              <label htmlFor="restock-note">Nota</label>
              <input
                id="restock-note"
                value={restockForm.note}
                onChange={(e) => setRestockForm({ ...restockForm, note: e.target.value })}
                placeholder="Factura, folio, etc."
              />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={historialOpen}
        title={historialTarget ? `Compras — ${historialTarget.name}` : 'Historial de compras'}
        onClose={() => setHistorialOpen(false)}
        large
        footer={
          <button type="button" className="btn btn-secondary" onClick={() => setHistorialOpen(false)}>Cerrar</button>
        }
      >
        {error && historialOpen && <div className="alert alert-error">{error}</div>}
        {historialLoading ? (
          <div className="empty">Cargando compras...</div>
        ) : historialCompras.length === 0 ? (
          <div className="empty">Sin compras registradas</div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Proveedor</th>
                  <th>Cantidad</th>
                  <th>Total</th>
                  <th>Precio/u</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {historialCompras.map((c) => (
                  <tr key={c.id}>
                    <td>{formatDateOnly(c.purchased_at || c.created_at)}</td>
                    <td>{c.supplier || '—'}</td>
                    <td>{formatQuantity(c.quantity, historialTarget?.unit)}</td>
                    <td>{c.total_purchase != null ? formatMoney(c.total_purchase) : '—'}</td>
                    <td>{c.purchase_unit_cost != null ? formatMoney(c.purchase_unit_cost) : '—'}</td>
                    <td>{c.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </>
  );
}
