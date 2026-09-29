import type { SalesPeriodReport } from '../domain/dailyReports';
import { tipoPagoLabel } from '../domain/paymentTypes';
import { downloadExcel, excelDateTime, type ExcelSheet } from './excel';

function money(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function dash(value: string | null | undefined): string {
  const v = (value || '').trim();
  return v || '-';
}

export function downloadSalesPeriodExcel(report: SalesPeriodReport): void {
  const ventas = report.ventas || [];
  const porTipo = report.por_tipo || [];
  const porSucursal = report.por_sucursal || [];
  const porVendedor = report.por_vendedor || [];

  const sheets: ExcelSheet[] = [
    {
      name: 'Resumen',
      rows: [
        ['Reporte de ventas'],
        ['Periodo', report.label],
        ['Desde', report.fromYMD],
        ['Hasta', report.toYMD],
        ['Vendedor', report.seller_label || 'Todos'],
        ['Total ventas', report.total_ventas],
        ['Monto total', money(report.monto_total)],
        [''],
        ['Desglose por tipo de pago'],
        ['Tipo', 'Cantidad', 'Monto'],
        ...(porTipo.length
          ? porTipo.map((r) => [r.label, r.cantidad, money(r.monto)])
          : [['Sin datos', 0, 0]]),
        [''],
        ['Desglose por sucursal'],
        ['Sucursal', 'Cantidad', 'Monto'],
        ...(porSucursal.length
          ? porSucursal.map((r) => [r.label, r.cantidad, money(r.monto)])
          : [['Sin datos', 0, 0]]),
        [''],
        ['Desglose por vendedor'],
        ['Vendedor', 'Cantidad', 'Monto'],
        ...(porVendedor.length
          ? porVendedor.map((r) => [r.label, r.cantidad, money(r.monto)])
          : [['Sin datos', 0, 0]]),
      ],
    },
    {
      name: 'Por tipo',
      rows: [
        ['Tipo de pago', 'Cantidad', 'Monto'],
        ...(porTipo.length
          ? porTipo.map((r) => [r.label, r.cantidad, money(r.monto)])
          : [['Sin datos', 0, 0]]),
      ],
    },
    {
      name: 'Por sucursal',
      rows: [
        ['Sucursal', 'Cantidad', 'Monto'],
        ...(porSucursal.length
          ? porSucursal.map((r) => [r.label, r.cantidad, money(r.monto)])
          : [['Sin datos', 0, 0]]),
      ],
    },
    {
      name: 'Por vendedor',
      rows: [
        ['Vendedor', 'Cantidad', 'Monto'],
        ...(porVendedor.length
          ? porVendedor.map((r) => [r.label, r.cantidad, money(r.monto)])
          : [['Sin datos', 0, 0]]),
      ],
    },
    {
      name: 'Detalle ventas',
      rows: [
        ['Folio', 'Fecha', 'Cliente', 'Telefono', 'Sucursal', 'Tipo de pago', 'Vendedor', 'Subtotal', 'IVA', 'Total', 'Credito'],
        ...(ventas.length
          ? ventas.map((v) => [
            v.folio,
            excelDateTime(v.created_at),
            dash(v.customer_name),
            dash(v.customer_phone),
            dash(
              v.branch_name
                ? (v.branch_code ? `${v.branch_name} (${v.branch_code})` : v.branch_name)
                : v.branch_code,
            ),
            tipoPagoLabel(v.payment_type) || v.payment_type || '-',
            dash(v.seller_name || v.seller_email),
            money(v.subtotal),
            money(v.tax),
            money(v.total),
            v.is_credit ? 'Si' : 'No',
          ])
          : [['Sin ventas', '-', '-', '-', '-', '-', '-', 0, 0, 0, '-']]),
      ],
    },
  ];

  const slug = `${report.fromYMD}_${report.toYMD}${report.seller_id ? `_${report.seller_id.slice(0, 8)}` : ''}`;
  downloadExcel(`reporte-ventas-${slug}`, sheets);
}

/** @deprecated Use downloadSalesPeriodExcel */
export function downloadDailySalesExcel(report: SalesPeriodReport): void {
  downloadSalesPeriodExcel(report);
}
