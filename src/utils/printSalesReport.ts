import type { SalesPeriodReport } from '../domain/dailyReports';
import { tipoPagoLabel } from '../domain/paymentTypes';
import { formatDate, formatMoney } from './format';

function bucketRows(title: string, rows: { label: string; cantidad: number; monto: number }[]): string {
  if (!rows.length) {
    return `<h3>${title}</h3><p>Sin datos</p>`;
  }
  return `
    <h3>${title}</h3>
    <table>
      <thead><tr><th>Concepto</th><th>Cantidad</th><th>Monto</th></tr></thead>
      <tbody>
        ${rows.map((r) => `
          <tr>
            <td>${escapeHtml(r.label)}</td>
            <td>${r.cantidad}</td>
            <td>${formatMoney(r.monto)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function printSalesPeriodReport(report: SalesPeriodReport, orgName?: string | null): void {
  const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
  if (!w) return;

  const detailRows = report.ventas.length === 0
    ? '<tr><td colspan="7">Sin ventas en el periodo</td></tr>'
    : report.ventas.map((v) => `
        <tr>
          <td>${escapeHtml(v.folio)}</td>
          <td>${escapeHtml(formatDate(v.created_at))}</td>
          <td>${escapeHtml(v.customer_name || '—')}${v.customer_phone ? `<br/>${escapeHtml(v.customer_phone)}` : ''}</td>
          <td>${escapeHtml(
            v.branch_name
              ? (v.branch_code ? `${v.branch_name} (${v.branch_code})` : v.branch_name)
              : (v.branch_code || 'Sin sucursal'),
          )}</td>
          <td>${escapeHtml(tipoPagoLabel(v.payment_type))}</td>
          <td>${escapeHtml(v.seller_name || v.seller_email || '—')}</td>
          <td>${formatMoney(v.total)}</td>
        </tr>
      `).join('');

  w.document.write(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Reporte de ventas</title>
  <style>
    body{font-family:Georgia,serif;color:#111;margin:24px;font-size:13px}
    h1{font-size:20px;margin:0 0 4px}
    h2,h3{font-size:14px;margin:18px 0 8px}
    .meta{color:#555;margin-bottom:16px}
    .stats{display:flex;gap:16px;flex-wrap:wrap;margin:12px 0 20px}
    .stat{border:1px solid #ddd;padding:10px 14px;min-width:120px}
    .stat b{display:block;font-size:16px;margin-top:4px}
    table{width:100%;border-collapse:collapse;margin-bottom:8px}
    th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
    th{background:#f4f4f4}
    @media print{body{margin:12px} .no-print{display:none}}
  </style>
</head>
<body>
  <button class="no-print" onclick="window.print()">Imprimir</button>
  <h1>Reporte de ventas</h1>
  <div class="meta">
    ${orgName ? `<div><strong>${escapeHtml(orgName)}</strong></div>` : ''}
    <div>${escapeHtml(report.label)}</div>
    <div>Periodo: ${escapeHtml(report.fromYMD)} → ${escapeHtml(report.toYMD)}</div>
    ${report.seller_label ? `<div>Vendedor: ${escapeHtml(report.seller_label)}</div>` : '<div>Vendedor: Todos</div>'}
  </div>
  <div class="stats">
    <div class="stat">Ventas<b>${report.total_ventas}</b></div>
    <div class="stat">Monto total<b>${formatMoney(report.monto_total)}</b></div>
    <div class="stat">Tipos de pago<b>${report.por_tipo.length}</b></div>
    <div class="stat">Vendedores<b>${report.por_vendedor.length}</b></div>
  </div>
  ${bucketRows('Por tipo de pago', report.por_tipo)}
  ${bucketRows('Por sucursal', report.por_sucursal)}
  ${bucketRows('Por vendedor', report.por_vendedor)}
  <h3>Detalle de ventas</h3>
  <table>
    <thead>
      <tr><th>Folio</th><th>Fecha</th><th>Cliente</th><th>Sucursal</th><th>Pago</th><th>Vendedor</th><th>Total</th></tr>
    </thead>
    <tbody>${detailRows}</tbody>
  </table>
  <script>window.onload=function(){setTimeout(function(){window.print()},200)}</script>
</body>
</html>`);
  w.document.close();
}
