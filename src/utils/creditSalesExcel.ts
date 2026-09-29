import { creditPeriodSummary } from '../domain/creditTypes';
import { creditStatusLabel } from '../domain/dailyReports';
import { tipoPagoLabel } from '../domain/paymentTypes';
import type { Sale } from '../types';
import { downloadExcel, excelDateTime, type ExcelSheet } from './excel';

function money(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function dash(value: string | null | undefined): string {
  const v = (value || '').trim();
  return v || '-';
}

export function downloadCreditSalesExcel(
  sales: Sale[],
  opts: { fromYMD: string; toYMD: string; orgName?: string },
): void {
  const list = sales || [];

  const sheets: ExcelSheet[] = [
    {
      name: 'Resumen',
      rows: [
        ['Ventas a credito'],
        ['Organizacion', opts.orgName || '-'],
        ['Desde', opts.fromYMD],
        ['Hasta', opts.toYMD],
        ['Total creditos', list.length],
        ['Monto total', money(list.reduce((s, v) => s + (Number(v.total) || 0), 0))],
        ['Pendientes', list.filter((v) => !v.credit_paid_at).length],
        ['Pagados', list.filter((v) => Boolean(v.credit_paid_at)).length],
      ],
    },
    {
      name: 'Creditos',
      rows: [
        [
          'Folio',
          'Fecha venta',
          'Cliente',
          'Telefono',
          'Vendedor',
          'Sucursal',
          'Tipo pago',
          'Subtotal',
          'IVA',
          'Total',
          'Recargo %',
          'Plazo',
          'Vence',
          'Pagado el',
          'Estado',
          'Lineas',
        ],
        ...(list.length
          ? list.map((v) => [
            v.folio,
            excelDateTime(v.created_at),
            dash(v.customer_name),
            dash(v.customer_phone),
            dash(v.seller_name || v.seller_email),
            dash(
              v.branch_name
                ? (v.branch_code ? `${v.branch_name} (${v.branch_code})` : v.branch_name)
                : v.branch_code,
            ),
            tipoPagoLabel(v.payment_type) || v.payment_type || '-',
            money(v.subtotal),
            money(v.tax),
            money(v.total),
            v.credit_surcharge_percent ?? 0,
            creditPeriodSummary(v.credit_period_value, v.credit_period_unit) || '-',
            v.credit_due_at ? excelDateTime(v.credit_due_at) : '-',
            v.credit_paid_at ? excelDateTime(v.credit_paid_at) : '-',
            creditStatusLabel(v),
            (v.lines || []).map((l) => `${l.sku}x${l.quantity}`).join('; ') || '-',
          ])
          : [['Sin creditos', '-', '-', '-', '-', '-', '-', 0, 0, 0, 0, '-', '-', '-', '-', '-']]),
      ],
    },
    {
      name: 'Detalle lineas',
      rows: [
        ['Folio', 'SKU', 'Producto', 'Cantidad', 'Precio unit.', 'Total linea', 'Estado credito'],
        ...(list.some((v) => (v.lines || []).length > 0)
          ? list.flatMap((v) =>
            (v.lines || []).map((l) => [
              v.folio,
              l.sku,
              l.product_name,
              l.quantity,
              money(l.unit_price),
              money(l.line_total),
              creditStatusLabel(v),
            ]),
          )
          : [['Sin lineas', '-', '-', 0, 0, 0, '-']]),
      ],
    },
  ];

  downloadExcel(`ventas-credito-${opts.fromYMD}_${opts.toYMD}`, sheets);
}
