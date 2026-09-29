import type { Sale } from '../types';
import { formatMoney } from '../utils/format';
import { rolLabel } from '../auth/auth';
import { creditPeriodSummary } from './creditTypes';
import { tipoPagoLabel } from './paymentTypes';

const NL_UNIDADES = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
const NL_DIECES = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
const NL_VEINTES = ['VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
const NL_DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const NL_CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

function nlDecenas(n: number): string {
  if (n < 10) return NL_UNIDADES[n];
  if (n < 20) return NL_DIECES[n - 10];
  if (n < 30) return NL_VEINTES[n - 20];
  const d = Math.floor(n / 10);
  const u = n % 10;
  return NL_DECENAS[d] + (u ? ` Y ${NL_UNIDADES[u]}` : '');
}

function nlCentenas(n: number): string {
  if (n === 100) return 'CIEN';
  const c = Math.floor(n / 100);
  const r = n % 100;
  return (c ? NL_CENTENAS[c] : '') + (c && r ? ' ' : '') + (r ? nlDecenas(r) : '');
}

function nlEntero(n: number): string {
  if (n === 0) return 'CERO';
  const millones = Math.floor(n / 1000000);
  const miles = Math.floor((n % 1000000) / 1000);
  const resto = n % 1000;
  let out = '';
  if (millones) out += millones === 1 ? 'UN MILLÓN' : `${nlCentenas(millones)} MILLONES`;
  if (miles) out += (out ? ' ' : '') + (miles === 1 ? 'MIL' : `${nlCentenas(miles)} MIL`);
  if (resto) out += (out ? ' ' : '') + nlCentenas(resto);
  return out;
}

export function numeroALetras(monto: number): string {
  const cents = Math.round(monto * 100);
  const enteros = Math.floor(cents / 100);
  const cc = cents % 100;
  let letras = nlEntero(enteros);
  if (letras.endsWith('UNO')) letras = letras.slice(0, -1);
  const pesos = enteros === 1 ? 'PESO' : 'PESOS';
  return `SON: ${letras} ${pesos} ${String(cc).padStart(2, '0')}/100 M.N.`;
}

function escaparHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

export function ticketRecibidoCambio(v: Sale): { recibido: number; cambio: number } {
  const recibido = v.amount_received ?? (v.is_credit && !v.credit_paid_at ? 0 : v.total);
  const cambio = v.change ?? Math.max(0, recibido - v.total);
  return { recibido, cambio };
}

export function ticketStaffLine(v: Sale): string {
  const name = v.seller_name || v.seller_email || '—';
  const role = v.seller_role ? rolLabel(v.seller_role) : '';
  return role ? `${name} (${role})` : name;
}

export function imprimirTicketVenta(v: Sale, logoUrl?: string | null): void {
  const w = window.open('', '_blank', 'width=380,height=640');
  if (!w) return;
  const { recibido, cambio } = ticketRecibidoCambio(v);
  const creditLines = v.is_credit ? `
      <div>Crédito: ${escaparHtml(creditPeriodSummary(v.credit_period_value, v.credit_period_unit))}</div>
      ${v.credit_surcharge_percent != null && v.credit_surcharge_percent > 0
        ? `<div>Aumento: ${v.credit_surcharge_percent}%</div>` : ''}
      ${v.credit_due_at
        ? `<div>Vence: ${new Date(v.credit_due_at).toLocaleDateString('es-MX')}</div>` : ''}
      <div>${!v.credit_paid_at ? 'Estado: Pendiente de pago' : 'Estado: Pagado'}</div>
    ` : '';
  const commissionLine = v.payment_type === 'TARJETA'
    && v.card_commission_percent != null
    && v.card_commission_percent > 0
    ? `<div>Comisión: ${v.card_commission_percent}%</div>`
    : '';
  const commissionAmount = v.payment_type === 'TARJETA'
    && v.card_commission_percent != null
    && v.card_commission_percent > 0
    ? v.total - v.subtotal - (v.iva_enabled ? v.tax : 0)
    : 0;
  const items = (v.lines ?? []).map((d) => `
    <div class="item">
      <div>${d.quantity} ${escaparHtml(d.product_name)}</div>
      <div class="precio">${formatMoney(d.line_total)}</div>
    </div>`).join('');
  const logoBlock = logoUrl
    ? `<div class="center logo"><img src="${logoUrl.replace(/"/g, '&quot;')}" alt="" /></div>`
    : '';
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Ticket ${escaparHtml(v.folio)}</title>
    <style>
      *{box-sizing:border-box}
      body{font-family:'Courier New',monospace;color:#111;padding:12px;font-size:13px;width:300px;margin:0 auto}
      .center{text-align:center}.title{font-weight:bold;font-size:15px}.muted{color:#555}
      .logo{margin-bottom:8px}.logo img{max-width:160px;max-height:72px;object-fit:contain}
      hr{border:none;border-top:1px dashed #333;margin:8px 0}
      .item{margin-bottom:4px}.item .precio{text-align:right}
      .row{display:flex;justify-content:space-between}.row.total{font-weight:bold;font-size:15px}
      .letra{margin-top:8px;font-size:12px}
    </style></head><body>
    ${logoBlock}
    <div class="center title">${escaparHtml(v.org_name ?? 'Ticket de venta')}</div>
    <div style="margin-top:8px">
      <div>Fecha: ${new Date(v.created_at).toLocaleString('es-MX')}</div>
      <div>Folio: ${escaparHtml(v.folio)}</div>
      <div># Tran: ${escaparHtml(v.id.slice(0, 8))}</div>
      ${v.customer_name ? `<div>Cliente: ${escaparHtml(v.customer_name)}</div>` : ''}
      ${v.customer_phone ? `<div>Teléfono: ${escaparHtml(v.customer_phone)}</div>` : ''}
      <div>Atendió: ${escaparHtml(ticketStaffLine(v))}</div>
      <div>Pago: ${escaparHtml(tipoPagoLabel(v.payment_type))}</div>
      ${commissionLine}
      ${creditLines}
    </div>
    <hr>${items}<hr>
    ${v.iva_enabled ? `<div class="row"><span>Subtotal</span><span>${formatMoney(v.subtotal)}</span></div>
    <div class="row"><span>IVA (16%)</span><span>${formatMoney(v.tax)}</span></div>` : ''}
    ${commissionAmount > 0
      ? `<div class="row"><span>Comisión (${v.card_commission_percent}%)</span><span>${formatMoney(commissionAmount)}</span></div>`
      : ''}
    <div class="row total"><span>Total</span><span>${formatMoney(v.total)}</span></div>
    <div class="row"><span>Importe recibido</span><span>${formatMoney(recibido)}</span></div>
    <div class="row"><span>Cambio entregado</span><span>${formatMoney(cambio)}</span></div>
    <div class="letra">${numeroALetras(v.total)}</div>
    </body></html>`);
  w.document.close();
  w.focus();
  w.print();
}
