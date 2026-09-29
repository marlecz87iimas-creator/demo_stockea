import { useCallback, useEffect, useMemo, useState } from 'react';
import { createSale, deleteSale, listProducts, listSales, paySale } from '../api/stockea';
import { getOrganization, listBranches } from '../api/organizations';
import { useAuth } from '../auth/AuthContext';
import Modal from '../components/Modal';
import {
  applyCreditSurcharge,
  CREDIT_PERIOD_UNITS,
  creditPeriodSummary,
  creditPeriodUnitLabel,
  type CreditPeriodUnit,
} from '../domain/creditTypes';
import { branchLabel, productBranchLabel } from '../domain/branches';
import { TIPOS_PAGO, isCreditUnpaid, tipoPagoLabel, type TipoPago } from '../domain/paymentTypes';
import { imprimirTicketVenta, numeroALetras, ticketRecibidoCambio, ticketStaffLine } from '../domain/ticket';
import type { Branch, Product, Sale } from '../types';
import { formatDate, formatMoney, formatQuantity } from '../utils/format';
import { isDisplayableLogoUrl } from '../utils/logoImage';
import { useCloudRefresh } from '../hooks/useCloudRefresh';
import { useMaintenance } from '../hooks/useMaintenance';

const IVA_RATE = 0.16;

const FORM_INICIAL = {
  notas: '',
  clienteNombre: '',
  clienteTelefono: '',
  branchId: '',
  ventaCredito: false,
  plazoValor: '1',
  plazoUnidad: 'dias' as CreditPeriodUnit,
  porcentajeAumento: '0',
};

const PAY_FORM_INICIAL = {
  tipoPago: 'EFECTIVO' as Exclude<TipoPago, 'CREDITO'>,
  montoRecibido: '',
  comisionTarjeta: '',
};

type PayModalMode = 'pos' | 'credit';

function nombreSucursal(sale: Sale, sucursales: Branch[]): string {
  if (sale.branch_name || sale.branch_code) return productBranchLabel(sale);
  const branch = sucursales.find((b) => b.id === sale.branch_id);
  if (branch) return branchLabel(branch);
  return 'Sin sucursal';
}

function pickDefaultBranchId(branches: Branch[]): string {
  const matriz = branches.find((b) => b.slug === 'matriz' && b.status === 'active');
  if (matriz) return matriz.id;
  const active = branches.find((b) => b.status === 'active');
  return active?.id ?? branches[0]?.id ?? '';
}

interface CartLine {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  maxStock: number;
  cantidad: number;
  precioUnitario: number;
}

export default function VentasPage() {
  const { session } = useAuth();
  const puedeBorrarVentas = session?.stockeaProfile === 'principal';
  const { blocked, blockedMessage } = useMaintenance();
  const [ventas, setVentas] = useState<Sale[]>([]);
  const [catalogo, setCatalogo] = useState<Product[]>([]);
  const [busquedaCatalogo, setBusquedaCatalogo] = useState('');
  const [ivaHabilitado, setIvaHabilitado] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [posOpen, setPosOpen] = useState(false);
  const [nota, setNota] = useState<Sale | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [borrandoId, setBorrandoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState(FORM_INICIAL);
  const [carrito, setCarrito] = useState<CartLine[]>([]);
  const [sucursales, setSucursales] = useState<Branch[]>([]);
  const [payOpen, setPayOpen] = useState(false);
  const [payMode, setPayMode] = useState<PayModalMode>('pos');
  const [paySaleTarget, setPaySaleTarget] = useState<Sale | null>(null);
  const [payForm, setPayForm] = useState(PAY_FORM_INICIAL);
  const [payError, setPayError] = useState('');

  const cargarVentas = useCallback(async () => {
    if (!session?.token || !session.orgId) return;
    const [salesResult, orgResult, branchesResult] = await Promise.allSettled([
      listSales(session.token, session.orgId, { limit: 100 }),
      getOrganization(session.token, session.orgId),
      listBranches(session.token, session.orgId),
    ]);
    if (salesResult.status === 'fulfilled') {
      setVentas(salesResult.value.items ?? []);
    }
    if (orgResult.status === 'fulfilled') {
      setIvaHabilitado(orgResult.value.stockea?.iva_habilitado ?? false);
      setOrgName(orgResult.value.name);
    }
    if (branchesResult.status === 'fulfilled') {
      setSucursales(branchesResult.value.filter((b) => b.status === 'active'));
    }
    const failed = [salesResult, orgResult].find((result) => result.status === 'rejected');
    if (failed?.status === 'rejected') {
      const reason = failed.reason;
      setError(reason instanceof Error ? reason.message : 'No se pudieron cargar las ventas');
      return;
    }
    setError('');
  }, [session]);

  const cargarCatalogo = useCallback(async () => {
    if (!session?.token || !session.orgId) return [];
    const params = {
      limit: 100,
      status: 'active' as const,
      item_type: 'product' as const,
      search: busquedaCatalogo.trim() || undefined,
    };
    const first = await listProducts(session.token, session.orgId, { ...params, page: 1 });
    const items = [...(first.items ?? [])];
    const pages = first.total_pages ?? 1;
    for (let page = 2; page <= pages; page += 1) {
      const next = await listProducts(session.token, session.orgId, { ...params, page });
      items.push(...(next.items ?? []));
    }
    setCatalogo(items);
    return items;
  }, [session, busquedaCatalogo]);

  useEffect(() => {
    cargarVentas().finally(() => setLoading(false));
  }, [cargarVentas]);

  useCloudRefresh(cargarVentas, Boolean(session?.token && session.orgId));

  useEffect(() => {
    if (!posOpen) return;
    const t = setTimeout(() => {
      cargarCatalogo().catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar el catálogo'));
    }, busquedaCatalogo ? 300 : 0);
    return () => clearTimeout(t);
  }, [posOpen, busquedaCatalogo, cargarCatalogo]);

  const catalogoFiltrado = useMemo(() => {
    const q = busquedaCatalogo.trim().toLowerCase();
    if (!q) return catalogo;
    return catalogo.filter(
      (p) => p.sku.toLowerCase().includes(q)
        || p.name.toLowerCase().includes(q)
        || (p.category ?? '').toLowerCase().includes(q),
    );
  }, [catalogo, busquedaCatalogo]);

  const abrirPos = async () => {
    if (!session?.token || !session.orgId) return;
    setBusquedaCatalogo('');
    const branches = sucursales.length
      ? sucursales
      : await listBranches(session.token, session.orgId).catch(() => [] as Branch[]);
    if (!sucursales.length && branches.length) {
      setSucursales(branches.filter((b) => b.status === 'active'));
    }
    setForm({ ...FORM_INICIAL, branchId: pickDefaultBranchId(branches) });
    setCarrito([]);
    setError('');
    setPosOpen(true);
    try {
      await cargarCatalogo();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el catálogo');
    }
  };

  const agregarAlCarrito = (product: Product) => {
    if (product.quantity <= 0) {
      setError(`Sin stock: ${product.name}`);
      return;
    }
    setError('');
    setCarrito((prev) => {
      const idx = prev.findIndex((l) => l.productId === product.id);
      if (idx >= 0) {
        const next = [...prev];
        const nuevaCant = next[idx].cantidad + 1;
        if (nuevaCant > product.quantity) {
          setError(`Stock insuficiente para ${product.name} (máx. ${product.quantity})`);
          return prev;
        }
        next[idx] = { ...next[idx], cantidad: nuevaCant, maxStock: product.quantity };
        return next;
      }
      return [...prev, {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        unit: product.unit,
        maxStock: product.quantity,
        cantidad: 1,
        precioUnitario: product.unit_price,
      }];
    });
  };

  const actualizarLinea = (productId: string, patch: Partial<Pick<CartLine, 'cantidad' | 'precioUnitario'>>) => {
    setCarrito((prev) => prev.map((l) => {
      if (l.productId !== productId) return l;
      const cantidad = patch.cantidad ?? l.cantidad;
      if (cantidad > l.maxStock) {
        setError(`Stock máximo ${l.maxStock} para ${l.name}`);
        return l;
      }
      if (cantidad <= 0) return l;
      return { ...l, ...patch, cantidad };
    }));
  };

  const quitarLinea = (productId: string) => {
    setCarrito((prev) => prev.filter((l) => l.productId !== productId));
  };

  const subtotalVenta = carrito.reduce((sum, l) => sum + l.cantidad * l.precioUnitario, 0);
  const ivaVenta = ivaHabilitado ? subtotalVenta * IVA_RATE : 0;
  const totalBase = subtotalVenta + ivaVenta;
  const porcentajeCredito = form.ventaCredito && form.porcentajeAumento ? +form.porcentajeAumento : 0;
  const aumentoCredito = form.ventaCredito && porcentajeCredito > 0
    ? applyCreditSurcharge(totalBase, porcentajeCredito) - totalBase
    : 0;
  const totalVenta = form.ventaCredito
    ? applyCreditSurcharge(totalBase, porcentajeCredito)
    : totalBase;

  const payBaseTotal = payMode === 'credit' && paySaleTarget
    ? paySaleTarget.total
    : totalBase;
  const payEsTarjeta = payForm.tipoPago === 'TARJETA';
  const payComisionPct = payEsTarjeta && payForm.comisionTarjeta ? +payForm.comisionTarjeta : 0;
  const payTotal = payEsTarjeta && payComisionPct > 0
    ? applyCreditSurcharge(payBaseTotal, payComisionPct)
    : payBaseTotal;
  const payComisionMonto = payTotal - payBaseTotal;
  const payEsEfectivo = payForm.tipoPago === 'EFECTIVO';
  const payRecibido = payForm.montoRecibido ? +payForm.montoRecibido : payTotal;
  const payCambio = payRecibido > payTotal ? payRecibido - payTotal : 0;

  const abrirPagarPos = () => {
    setError('');
    if (blocked) {
      setError(blockedMessage);
      return;
    }
    if (carrito.length === 0) {
      setError('Agrega al menos un producto del catálogo');
      return;
    }
    setPayMode('pos');
    setPaySaleTarget(null);
    setPayForm(PAY_FORM_INICIAL);
    setPayError('');
    setPayOpen(true);
  };

  const abrirPagarCredito = (sale: Sale) => {
    if (blocked) {
      setError(blockedMessage);
      return;
    }
    setPayMode('credit');
    setPaySaleTarget(sale);
    setPayForm(PAY_FORM_INICIAL);
    setPayError('');
    setPayOpen(true);
  };

  const cerrarPayModal = () => {
    setPayOpen(false);
    setPaySaleTarget(null);
    setPayError('');
  };

  const imagenTicket = (sale: Sale): string | null => {
    if (sale.branch_id) {
      const branch = sucursales.find((b) => b.id === sale.branch_id);
      return isDisplayableLogoUrl(branch?.image_url) ? branch?.image_url ?? null : null;
    }
    return isDisplayableLogoUrl(session?.logoUrl) ? session?.logoUrl ?? null : null;
  };

  const datosCliente = () => ({
    customer_name: form.clienteNombre.trim() || undefined,
    customer_phone: form.clienteTelefono.trim() || undefined,
  });

  const handleRegistrarCredito = async () => {
    if (!session?.token || !session.orgId) return;
    setError('');
    if (blocked) {
      setError(blockedMessage);
      return;
    }
    if (carrito.length === 0) {
      setError('Agrega al menos un producto del catálogo');
      return;
    }
    const plazo = +form.plazoValor;
    if (!plazo || plazo <= 0) {
      setError('Indica el plazo de la venta a crédito');
      return;
    }
    if (porcentajeCredito < 0) {
      setError('El porcentaje a aumentar no puede ser negativo');
      return;
    }
    const detalles = carrito.map((l) => ({
      product_id: l.productId,
      quantity: l.cantidad,
      unit_price: l.precioUnitario,
    }));
    setGuardando(true);
    try {
      const creada = await createSale(session.token, session.orgId, {
        payment_type: 'CREDITO',
        amount_received: 0,
        notes: form.notas || undefined,
        ...datosCliente(),
        branch_id: form.branchId || undefined,
        is_credit: true,
        credit_period_value: plazo,
        credit_period_unit: form.plazoUnidad,
        credit_surcharge_percent: porcentajeCredito,
        lines: detalles,
      });
      setPosOpen(false);
      setSuccess('Venta a crédito registrada. El inventario fue actualizado.');
      setNota(creada);
      await cargarVentas();
      setTimeout(() => imprimirTicketVenta(creada, imagenTicket(creada)), 300);
      setTimeout(() => setSuccess(''), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al registrar la venta');
    } finally {
      setGuardando(false);
    }
  };

  const handleConfirmarPago = async () => {
    if (!session?.token || !session.orgId) return;
    setPayError('');
    if (blocked) {
      setPayError(blockedMessage);
      return;
    }
    if (payComisionPct < 0) {
      setPayError('La comisión no puede ser negativa');
      return;
    }
    if (payForm.tipoPago === 'EFECTIVO' && payForm.montoRecibido !== '' && payRecibido + 0.001 < payTotal) {
      setPayError('La cantidad recibida no cubre el total');
      return;
    }
    if (payForm.montoRecibido !== '' && payRecibido < 0) {
      setPayError('La cantidad recibida no puede ser negativa');
      return;
    }
    setGuardando(true);
    try {
      let pagada: Sale;
      if (payMode === 'credit') {
        if (!paySaleTarget) return;
        pagada = await paySale(session.token, session.orgId, paySaleTarget.id, {
          payment_type: payForm.tipoPago,
          amount_received: payForm.montoRecibido ? payRecibido : payTotal,
          card_commission_percent: payEsTarjeta && payComisionPct > 0 ? payComisionPct : undefined,
        });
        setSuccess('Crédito pagado.');
      } else {
        if (carrito.length === 0) {
          setPayError('Agrega al menos un producto del catálogo');
          return;
        }
        const detalles = carrito.map((l) => ({
          product_id: l.productId,
          quantity: l.cantidad,
          unit_price: l.precioUnitario,
        }));
        pagada = await createSale(session.token, session.orgId, {
          payment_type: payForm.tipoPago,
          amount_received: payForm.montoRecibido ? payRecibido : payTotal,
          notes: form.notas || undefined,
          ...datosCliente(),
          branch_id: form.branchId || undefined,
          card_commission_percent: payEsTarjeta && payComisionPct > 0 ? payComisionPct : undefined,
          lines: detalles,
        });
        setPosOpen(false);
        setSuccess('Venta pagada. El inventario fue actualizado.');
      }
      cerrarPayModal();
      setNota(pagada);
      await cargarVentas();
      setTimeout(() => imprimirTicketVenta(pagada, imagenTicket(pagada)), 300);
      setTimeout(() => setSuccess(''), 4000);
    } catch (e) {
      setPayError(e instanceof Error ? e.message : 'Error al registrar el pago');
    } finally {
      setGuardando(false);
    }
  };

  const borrarVenta = async (sale: Sale) => {
    if (!session?.token || !session.orgId || !puedeBorrarVentas) return;
    if (blocked) {
      setError(blockedMessage);
      return;
    }
    const ok = window.confirm(
      `¿Borrar la venta ${sale.folio}? Las piezas vuelven al inventario.`,
    );
    if (!ok) return;
    setError('');
    setBorrandoId(sale.id);
    try {
      await deleteSale(session.token, session.orgId, sale.id);
      if (nota?.id === sale.id) setNota(null);
      setSuccess('Venta borrada. El inventario fue actualizado.');
      await cargarVentas();
      setTimeout(() => setSuccess(''), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo borrar la venta');
    } finally {
      setBorrandoId(null);
    }
  };

  if (loading) return <div className="empty">Cargando ventas...</div>;

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Ventas</h2>
          <p className="page-subtitle">Catálogo del sistema · ticket de venta · descuento automático de inventario</p>
        </div>
        {!posOpen && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={abrirPos}
            disabled={blocked}
            title={blocked ? blockedMessage : undefined}
          >
            + Nueva venta
          </button>
        )}
      </div>

      {blocked && <div className="alert alert-error">{blockedMessage}</div>}
      {error && !posOpen && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {posOpen && (
        <div className="panel pos-panel">
          <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Punto de venta</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPosOpen(false)}>Cerrar</button>
          </div>
          {error && <div className="alert alert-error" style={{ margin: '1rem' }}>{error}</div>}
          <div className="pos-layout">
            <div className="pos-catalog">
              <div className="filter-bar" style={{ margin: 0, padding: '0 0 0.75rem' }}>
                <input
                  placeholder="Buscar en catálogo: SKU, nombre o categoría..."
                  value={busquedaCatalogo}
                  onChange={(e) => setBusquedaCatalogo(e.target.value)}
                  style={{ flex: 1 }}
                  autoFocus
                />
              </div>
              <div className="pos-catalog-list">
                {catalogoFiltrado.length === 0 ? (
                  <div className="empty">No hay productos en el catálogo</div>
                ) : catalogoFiltrado.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`pos-product-card${p.quantity <= 0 ? ' pos-product-agotado' : ''}`}
                    onClick={() => agregarAlCarrito(p)}
                    disabled={p.quantity <= 0}
                  >
                    <div className="pos-product-sku"><code>{p.sku}</code></div>
                    <div className="pos-product-name">{p.name}</div>
                    <div className="pos-product-meta">
                      <span>{formatMoney(p.unit_price)}</span>
                      <span className={p.quantity <= p.min_quantity ? 'text-warn' : ''}>
                        Stock: {formatQuantity(p.quantity, p.unit)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="pos-cart">
              <strong>Carrito ({carrito.length})</strong>
              {carrito.length === 0 ? (
                <p className="page-subtitle" style={{ marginTop: '0.75rem' }}>
                  Selecciona productos del catálogo para armar la venta.
                </p>
              ) : (
                <div className="pos-cart-lines">
                  {carrito.map((l) => (
                    <div key={l.productId} className="pos-cart-line">
                      <div>
                        <code>{l.sku}</code> {l.name}
                        <div className="page-subtitle">Máx. {formatQuantity(l.maxStock, l.unit)}</div>
                      </div>
                      <div className="pos-cart-controls">
                        <input
                          type="number"
                          min={1}
                          max={l.maxStock}
                          step="any"
                          value={l.cantidad}
                          onChange={(e) => actualizarLinea(l.productId, { cantidad: +e.target.value })}
                          aria-label="Cantidad"
                        />
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={l.precioUnitario}
                          onChange={(e) => actualizarLinea(l.productId, { precioUnitario: +e.target.value })}
                          aria-label="Precio"
                        />
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => quitarLinea(l.productId)}>×</button>
                      </div>
                      <div className="pos-line-total">{formatMoney(l.cantidad * l.precioUnitario)}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="form-grid" style={{ marginTop: '1rem' }}>
                <p className="form-section-label full">Cliente</p>
                <div className="form-field">
                  <label htmlFor="venta-cliente-nombre">Nombre</label>
                  <input
                    id="venta-cliente-nombre"
                    value={form.clienteNombre}
                    onChange={(e) => setForm({ ...form, clienteNombre: e.target.value })}
                    placeholder="Nombre del cliente"
                    autoComplete="name"
                    maxLength={200}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="venta-cliente-telefono">Teléfono</label>
                  <input
                    id="venta-cliente-telefono"
                    type="tel"
                    value={form.clienteTelefono}
                    onChange={(e) => setForm({ ...form, clienteTelefono: e.target.value })}
                    placeholder="Número de teléfono"
                    autoComplete="tel"
                    maxLength={50}
                  />
                </div>
                {sucursales.length > 0 && (
                  <div className="form-field full">
                    <label>Sucursal</label>
                    <select
                      value={form.branchId}
                      onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                    >
                      {sucursales.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.code ? `${b.name} (${b.code})` : b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="form-field full">
                  <label className="check-line">
                    <input
                      type="checkbox"
                      checked={form.ventaCredito}
                      onChange={(e) => setForm({ ...form, ventaCredito: e.target.checked })}
                    />
                    Venta a crédito
                  </label>
                  <span className="form-hint">
                    Define el plazo y el porcentaje de aumento. Podrás cobrarla después con Pagar.
                  </span>
                </div>
                {form.ventaCredito && (
                  <>
                    <p className="form-section-label full">Condiciones de crédito</p>
                    <div className="form-field">
                      <label>Plazo</label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={form.plazoValor}
                        onChange={(e) => setForm({ ...form, plazoValor: e.target.value })}
                      />
                    </div>
                    <div className="form-field">
                      <label>Unidad</label>
                      <select
                        value={form.plazoUnidad}
                        onChange={(e) => setForm({ ...form, plazoUnidad: e.target.value as CreditPeriodUnit })}
                      >
                        {CREDIT_PERIOD_UNITS.map((u) => (
                          <option key={u} value={u}>{creditPeriodUnitLabel(u)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field full">
                      <label>Porcentaje a aumentar (%)</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={form.porcentajeAumento}
                        onChange={(e) => setForm({ ...form, porcentajeAumento: e.target.value })}
                        placeholder="Ej. 10"
                      />
                    </div>
                  </>
                )}
                <div className="form-field full">
                  <label>Notas</label>
                  <input
                    value={form.notas}
                    onChange={(e) => setForm({ ...form, notas: e.target.value })}
                    placeholder="Opcional"
                  />
                </div>
              </div>

              <div className="pos-totals">
                <div>Subtotal: {formatMoney(subtotalVenta)}</div>
                {ivaHabilitado && <div>IVA (16%): {formatMoney(ivaVenta)}</div>}
                {form.ventaCredito && aumentoCredito > 0 && (
                  <div>Aumento crédito ({porcentajeCredito}%): {formatMoney(aumentoCredito)}</div>
                )}
                <div className="pos-total-main">Total: {formatMoney(totalVenta)}</div>
                {form.ventaCredito && (
                  <div>
                    Plazo: {creditPeriodSummary(+form.plazoValor || 0, form.plazoUnidad) || '—'}
                  </div>
                )}
              </div>

              {form.ventaCredito ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '1rem' }}
                  onClick={handleRegistrarCredito}
                  disabled={guardando || carrito.length === 0 || blocked}
                >
                  {guardando ? 'Registrando…' : 'Registrar a crédito'}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '1rem' }}
                  onClick={abrirPagarPos}
                  disabled={guardando || carrito.length === 0 || blocked}
                >
                  Pagar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">Historial de ventas</div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Cliente</th>
                <th>Sucursal</th>
                <th>Vendedor</th>
                <th>Pago</th>
                <th>Subtotal</th>
                <th>IVA</th>
                <th>Total</th>
                <th>Fecha</th>
                <th>Productos</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ventas.length === 0 ? (
                <tr><td colSpan={11} className="empty">{error ? 'No se pudo cargar el historial de ventas' : 'No hay ventas registradas'}</td></tr>
              ) : ventas.map((v) => (
                <tr key={v.id}>
                  <td><code>{v.folio}</code></td>
                  <td>
                    {v.customer_name || '—'}
                    {v.customer_phone ? (
                      <div className="page-subtitle">{v.customer_phone}</div>
                    ) : null}
                  </td>
                  <td>{nombreSucursal(v, sucursales)}</td>
                  <td>{v.seller_name || v.seller_email || '—'}</td>
                  <td>
                    {tipoPagoLabel(v.payment_type)}
                    {v.is_credit && v.credit_period_value != null && (
                      <div className="page-subtitle">
                        {creditPeriodSummary(v.credit_period_value, v.credit_period_unit)}
                        {v.credit_surcharge_percent ? ` · +${v.credit_surcharge_percent}%` : ''}
                        {isCreditUnpaid(v) ? ' · Pendiente' : v.credit_paid_at ? ' · Pagado' : ''}
                      </div>
                    )}
                    {v.payment_type === 'TARJETA' && v.card_commission_percent != null && v.card_commission_percent > 0 && (
                      <div className="page-subtitle">Comisión +{v.card_commission_percent}%</div>
                    )}
                  </td>
                  <td>{formatMoney(v.subtotal)}</td>
                  <td>{v.iva_enabled ? formatMoney(v.tax) : '—'}</td>
                  <td><strong>{formatMoney(v.total)}</strong></td>
                  <td><small>{formatDate(v.created_at)}</small></td>
                  <td>{(v.lines ?? []).map((d) => `${d.quantity}× ${d.sku}`).join(', ')}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {isCreditUnpaid(v) && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ marginRight: 6 }}
                        onClick={() => abrirPagarCredito(v)}
                        disabled={blocked}
                        title={blocked ? blockedMessage : undefined}
                      >
                        Pagar
                      </button>
                    )}
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setNota(v)}>
                      Ticket
                    </button>
                    {puedeBorrarVentas && (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        style={{ marginLeft: 6 }}
                        onClick={() => borrarVenta(v)}
                        disabled={blocked || borrandoId === v.id}
                        title={blocked ? blockedMessage : 'Borrar venta y devolver el inventario'}
                      >
                        {borrandoId === v.id ? 'Borrando…' : 'Borrar'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={payOpen}
        title={payMode === 'credit' ? `Pagar crédito ${paySaleTarget?.folio ?? ''}` : 'Pagar venta'}
        onClose={cerrarPayModal}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={cerrarPayModal} disabled={guardando}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={handleConfirmarPago} disabled={guardando}>
              {guardando ? 'Procesando…' : 'Confirmar pago e imprimir'}
            </button>
          </>
        }
      >
        {payError && <div className="alert alert-error">{payError}</div>}
        <div className="form-grid">
          <div className="form-field">
            <label>Tipo de pago</label>
            <select
              value={payForm.tipoPago}
              onChange={(e) => {
                const tipoPago = e.target.value as Exclude<TipoPago, 'CREDITO'>;
                setPayForm({
                  ...payForm,
                  tipoPago,
                  comisionTarjeta: tipoPago === 'TARJETA' ? payForm.comisionTarjeta : '',
                });
              }}
            >
              {TIPOS_PAGO.map((t) => (
                <option key={t} value={t}>{tipoPagoLabel(t)}</option>
              ))}
            </select>
          </div>
          {payEsTarjeta && (
            <div className="form-field">
              <label>Agregar comisión (%)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={payForm.comisionTarjeta}
                onChange={(e) => setPayForm({ ...payForm, comisionTarjeta: e.target.value })}
                placeholder="Ej. 3.5"
              />
            </div>
          )}
          {payEsEfectivo && (
            <div className="form-field full">
              <label htmlFor="cantidad-recibida">Cantidad recibida</label>
              <input
                id="cantidad-recibida"
                type="number"
                step="0.01"
                min={0}
                inputMode="decimal"
                value={payForm.montoRecibido}
                placeholder={payTotal.toFixed(2)}
                onChange={(e) => setPayForm({ ...payForm, montoRecibido: e.target.value })}
              />
              <span className="form-hint">Efectivo que entrega el cliente. Si lo dejas vacío, se toma el total.</span>
            </div>
          )}
        </div>
        <div className="pos-totals" style={{ marginTop: '1rem' }}>
          <div>Importe: {formatMoney(payBaseTotal)}</div>
          {payComisionMonto > 0 && (
            <div>Comisión ({payComisionPct}%): {formatMoney(payComisionMonto)}</div>
          )}
          <div className="pos-total-main">Total a pagar: {formatMoney(payTotal)}</div>
          {payEsEfectivo && (
            <>
              <div>Cantidad recibida: {formatMoney(payRecibido)}</div>
              <div>Cambio: {formatMoney(payCambio)}</div>
            </>
          )}
        </div>
      </Modal>

      <Modal
        open={!!nota}
        title="Ticket de venta"
        onClose={() => setNota(null)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setNota(null)}>Cerrar</button>
            {nota && (
              <button type="button" className="btn btn-primary" onClick={() => imprimirTicketVenta(nota, imagenTicket(nota))}>
                Imprimir
              </button>
            )}
          </>
        }
      >
        {nota && (() => {
          const { recibido, cambio } = ticketRecibidoCambio(nota);
          const fotoTicket = imagenTicket(nota);
          const sep = { borderTop: '1px dashed var(--border, #333)', margin: '10px 0' } as const;
          const fila = { display: 'flex', justifyContent: 'space-between' } as const;
          return (
            <div style={{ fontFamily: 'ui-monospace, "Courier New", Menlo, monospace', maxWidth: 300, margin: '0 auto', fontSize: 13, lineHeight: 1.6 }}>
              {fotoTicket && (
                <div style={{ textAlign: 'center', marginBottom: 8 }}>
                  <img
                    src={fotoTicket}
                    alt=""
                    style={{ maxWidth: 160, maxHeight: 72, objectFit: 'contain' }}
                  />
                </div>
              )}
              <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 15 }}>{nota.org_name ?? orgName}</div>
              <div style={{ marginTop: 8 }}>
                <div>Fecha: {new Date(nota.created_at).toLocaleString('es-MX')}</div>
                <div>Folio: {nota.folio}</div>
                <div># Tran: {nota.id.slice(0, 8)}</div>
                {(nota.customer_name || nota.customer_phone) && (
                  <>
                    {nota.customer_name && <div>Cliente: {nota.customer_name}</div>}
                    {nota.customer_phone && <div>Teléfono: {nota.customer_phone}</div>}
                  </>
                )}
                <div>Atendió: {ticketStaffLine(nota)}</div>
                <div>Pago: {tipoPagoLabel(nota.payment_type)}</div>
                {nota.payment_type === 'TARJETA' && nota.card_commission_percent != null && nota.card_commission_percent > 0 && (
                  <div>Comisión: {nota.card_commission_percent}%</div>
                )}
                {nota.is_credit && (
                  <>
                    <div>Crédito: {creditPeriodSummary(nota.credit_period_value, nota.credit_period_unit)}</div>
                    {nota.credit_surcharge_percent != null && nota.credit_surcharge_percent > 0 && (
                      <div>Aumento: {nota.credit_surcharge_percent}%</div>
                    )}
                    {nota.credit_due_at && (
                      <div>Vence: {new Date(nota.credit_due_at).toLocaleDateString('es-MX')}</div>
                    )}
                    <div>{isCreditUnpaid(nota) ? 'Estado: Pendiente de pago' : 'Estado: Pagado'}</div>
                  </>
                )}
              </div>
              <div style={sep} />
              {(nota.lines ?? []).map((d) => (
                <div key={d.id} style={{ marginBottom: 6 }}>
                  <div>{d.quantity} {d.product_name}</div>
                  <div style={{ textAlign: 'right' }}>{formatMoney(d.line_total)}</div>
                </div>
              ))}
              <div style={sep} />
              {nota.iva_enabled && (
                <>
                  <div style={fila}><span>Subtotal</span><span>{formatMoney(nota.subtotal)}</span></div>
                  <div style={fila}><span>IVA (16%)</span><span>{formatMoney(nota.tax)}</span></div>
                </>
              )}
              {nota.payment_type === 'TARJETA' && nota.card_commission_percent != null && nota.card_commission_percent > 0 && (
                <div style={fila}>
                  <span>Comisión ({nota.card_commission_percent}%)</span>
                  <span>{formatMoney(nota.total - nota.subtotal - (nota.iva_enabled ? nota.tax : 0))}</span>
                </div>
              )}
              <div style={{ ...fila, fontWeight: 700, fontSize: 15 }}><span>Total</span><span>{formatMoney(nota.total)}</span></div>
              <div style={fila}><span>Importe recibido</span><span>{formatMoney(recibido)}</span></div>
              <div style={fila}><span>Cambio entregado</span><span>{formatMoney(cambio)}</span></div>
              <div style={{ marginTop: 8, fontSize: 12 }}>{numeroALetras(nota.total)}</div>
            </div>
          );
        })()}
      </Modal>
    </>
  );
}
