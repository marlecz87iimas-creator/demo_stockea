import type { Sale } from '../types';
import { tipoPagoLabel } from './paymentTypes';

export type SalesReportPeriod = 'diario' | 'semanal' | 'mensual' | 'personalizado';

export interface SalesReportBucket {
  key: string;
  label: string;
  cantidad: number;
  monto: number;
}

export interface SalesPeriodReport {
  period: SalesReportPeriod;
  label: string;
  fromYMD: string;
  toYMD: string;
  seller_id: string | null;
  seller_label: string | null;
  total_ventas: number;
  monto_total: number;
  por_tipo: SalesReportBucket[];
  por_sucursal: SalesReportBucket[];
  por_vendedor: SalesReportBucket[];
  ventas: Sale[];
}

/** @deprecated Use SalesPeriodReport */
export type DailySalesReport = SalesPeriodReport;
/** @deprecated Use SalesReportBucket */
export type DailyReportBucket = SalesReportBucket;

function startOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function parseYMD(dateYMD: string): Date {
  const [y, m, d] = dateYMD.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function localDateInputValue(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dayRangeISO(dateYMD: string): { from: string; to: string } {
  const from = parseYMD(dateYMD);
  const to = addDays(from, 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

/** Semana lunes–domingo que contiene `dateYMD`. */
export function weekRangeContaining(dateYMD: string): { fromYMD: string; toYMD: string; from: string; to: string } {
  const day = parseYMD(dateYMD);
  const dow = day.getDay();
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = addDays(day, diffToMonday);
  const nextMonday = addDays(monday, 7);
  return {
    fromYMD: localDateInputValue(monday),
    toYMD: localDateInputValue(addDays(nextMonday, -1)),
    from: monday.toISOString(),
    to: nextMonday.toISOString(),
  };
}

/** Mes calendario de `dateYMD`. */
export function monthRangeContaining(dateYMD: string): { fromYMD: string; toYMD: string; from: string; to: string } {
  const day = parseYMD(dateYMD);
  const from = new Date(day.getFullYear(), day.getMonth(), 1, 0, 0, 0, 0);
  const to = new Date(day.getFullYear(), day.getMonth() + 1, 1, 0, 0, 0, 0);
  return {
    fromYMD: localDateInputValue(from),
    toYMD: localDateInputValue(addDays(to, -1)),
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

export function customRangeISO(fromYMD: string, toYMD: string): { from: string; to: string } {
  const from = parseYMD(fromYMD);
  const toExclusive = addDays(parseYMD(toYMD), 1);
  return { from: from.toISOString(), to: toExclusive.toISOString() };
}

export function resolvePeriodRange(
  period: SalesReportPeriod,
  anchorYMD: string,
  customFromYMD?: string,
  customToYMD?: string,
): { fromYMD: string; toYMD: string; from: string; to: string; label: string } {
  if (period === 'diario') {
    const { from, to } = dayRangeISO(anchorYMD);
    return { fromYMD: anchorYMD, toYMD: anchorYMD, from, to, label: `Diario · ${anchorYMD}` };
  }
  if (period === 'semanal') {
    const w = weekRangeContaining(anchorYMD);
    return { ...w, label: `Semanal · ${w.fromYMD} → ${w.toYMD}` };
  }
  if (period === 'mensual') {
    const m = monthRangeContaining(anchorYMD);
    return { ...m, label: `Mensual · ${m.fromYMD} → ${m.toYMD}` };
  }
  const fromYMD = customFromYMD || anchorYMD;
  const toYMD = customToYMD || anchorYMD;
  const range = customRangeISO(fromYMD, toYMD);
  return { fromYMD, toYMD, ...range, label: `Personalizado · ${fromYMD} → ${toYMD}` };
}

function branchLabel(sale: Sale): string {
  if (sale.branch_name) {
    return sale.branch_code ? `${sale.branch_name} (${sale.branch_code})` : sale.branch_name;
  }
  if (sale.branch_code) return sale.branch_code;
  return 'Sin sucursal';
}

function branchKey(sale: Sale): string {
  return sale.branch_id || 'sin-sucursal';
}

function sellerLabel(sale: Sale): string {
  return sale.seller_name || sale.seller_email || 'Sin vendedor';
}

function sellerKey(sale: Sale): string {
  return sale.seller_id || 'sin-vendedor';
}

function accumulate(
  map: Map<string, SalesReportBucket>,
  key: string,
  label: string,
  amount: number,
) {
  const row = map.get(key) ?? { key, label, cantidad: 0, monto: 0 };
  row.cantidad += 1;
  row.monto += amount;
  map.set(key, row);
}

export function uniqueSellers(sales: Sale[]): { id: string; label: string }[] {
  const map = new Map<string, string>();
  for (const sale of sales) {
    map.set(sellerKey(sale), sellerLabel(sale));
  }
  return [...map.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'));
}

export function buildSalesPeriodReport(input: {
  period: SalesReportPeriod;
  label: string;
  fromYMD: string;
  toYMD: string;
  sales: Sale[];
  sellerId?: string | null;
}): SalesPeriodReport {
  const sellerId = input.sellerId || null;
  let filtered = [...input.sales];
  if (sellerId) {
    filtered = filtered.filter((s) => sellerKey(s) === sellerId);
  }

  const byType = new Map<string, SalesReportBucket>();
  const byBranch = new Map<string, SalesReportBucket>();
  const bySeller = new Map<string, SalesReportBucket>();
  let monto = 0;

  const sorted = filtered.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  for (const sale of sorted) {
    monto += sale.total;
    accumulate(byType, sale.payment_type, tipoPagoLabel(sale.payment_type) || sale.payment_type, sale.total);
    accumulate(byBranch, branchKey(sale), branchLabel(sale), sale.total);
    accumulate(bySeller, sellerKey(sale), sellerLabel(sale), sale.total);
  }

  const sortBuckets = (a: SalesReportBucket, b: SalesReportBucket) => b.monto - a.monto;
  const sellerLabelSelected = sellerId
    ? (bySeller.get(sellerId)?.label || (sorted[0] ? sellerLabel(sorted[0]) : sellerId))
    : null;

  return {
    period: input.period,
    label: sellerLabelSelected ? `${input.label} · ${sellerLabelSelected}` : input.label,
    fromYMD: input.fromYMD,
    toYMD: input.toYMD,
    seller_id: sellerId,
    seller_label: sellerLabelSelected,
    total_ventas: sorted.length,
    monto_total: Math.round(monto * 100) / 100,
    por_tipo: [...byType.values()].sort(sortBuckets),
    por_sucursal: [...byBranch.values()].sort(sortBuckets),
    por_vendedor: [...bySeller.values()].sort(sortBuckets),
    ventas: sorted,
  };
}

export function buildDailySalesReport(dateYMD: string, sales: Sale[]): SalesPeriodReport {
  return buildSalesPeriodReport({
    period: 'diario',
    label: `Diario · ${dateYMD}`,
    fromYMD: dateYMD,
    toYMD: dateYMD,
    sales,
  });
}

export function filterCreditSales(sales: Sale[]): Sale[] {
  return sales.filter((s) => s.is_credit || s.payment_type === 'CREDITO');
}

export function creditStatusLabel(sale: Sale): string {
  if (!sale.is_credit && sale.payment_type !== 'CREDITO') return '—';
  if (sale.credit_paid_at) return 'Pagado';
  if (sale.credit_due_at) {
    const due = startOfLocalDay(new Date(sale.credit_due_at));
    const today = startOfLocalDay(new Date());
    if (due.getTime() < today.getTime()) return 'Vencido';
    if (due.getTime() === today.getTime()) return 'Vence hoy';
  }
  return 'Pendiente';
}
