import { creditPeriodSummary } from '../domain/creditTypes';
import { creditStatusLabel } from '../domain/dailyReports';
import type { Sale } from '../types';
import { formatDate, formatMoney } from './format';

export type CreditPrintFilter = 'todos' | 'pendientes' | 'pagados';

export interface CreditPrintOptions {
  fromYMD: string;
  toYMD: string;
  orgName?: string;
  filter: CreditPrintFilter;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function filterLabel(filter: CreditPrintFilter): string {
  if (filter === 'pendientes') return 'Pendientes';
  if (filter === 'pagados') return 'Pagados';
  return 'Todos';
}

export function filterCreditSalesForPrint(sales: Sale[], filter: CreditPrintFilter): Sale[] {
  if (filter === 'pendientes') return sales.filter((s) => !s.credit_paid_at);
  if (filter === 'pagados') return sales.filter((s) => Boolean(s.credit_paid_at));
  return sales;
}

export function printCreditSalesReport(sales: Sale[], opts: CreditPrintOptions): void {
  const list = filterCreditSalesForPrint(sales, opts.filter);
  const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
  if (!w) return;

  const monto = list.reduce((s, v) => s + v.total, 0);
  const pendientes = list.filter((v) => !v.credit_paid_at).length;
  const pagados = list.filter((v) => Boolean(v.credit_paid_at)).length;
  const title = `Ventas a crédito — ${filterLabel(opts.filter)}`;

  const detailRows = list.length === 0
    ? '<tr><td colspan="8">Sin ventas a crédito en este filtro</td></tr>'
    : list.map((v) => `
        <tr>
          <td>${escapeHtml(v.folio)}</td>
          <td>${escapeHtml(formatDate(v.created_at))}</td>
          <td>${escapeHtml(v.customer_name || '—')}${v.customer_phone ? `<br/>${escapeHtml(v.customer_phone)}` : ''}</td>
          <td>${escapeHtml(v.seller_name || v.seller_email || '—')}</td>
          <td>${formatMoney(v.total)}</td>
          <td>${escapeHtml(creditPeriodSummary(v.credit_period_value, v.credit_period_unit) || '—')}</td>
          <td>${v.credit_due_at ? escapeHtml(formatDate(v.credit_due_at)) : '—'}</td>
          <td>${escapeHtml(creditStatusLabel(v))}</td>
        </tr>
      `).join('');

  w.document.write(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body{font-family:Georgia,serif;color:#111;margin:24px;font-size:12px}
    h1{font-size:20px;margin:0 0 4px}
    .meta{color:#555;margin-bottom:16px;line-height:1.5}
    .stats{display:flex;gap:12px;flex-wrap:wrap;margin:12px 0 18px}
    .stat{border:1px solid #ddd;padding:8px 12px;min-width:100px}
    .stat b{display:block;font-size:15px;margin-top:4px}
    table{width:100%;border-collapse:collapse;margin-bottom:8px}
    th,td{border:1px solid #ccc;padding:5px 7px;text-align:left}
    th{background:#f4f4f4;font-size:11px}
    @media print{body{margin:12px} .no-print{display:none}}
  </style>
</head>
<body>
  <button class="no-print" onclick="window.print()">Imprimir / Guardar PDF</button>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">
    ${opts.orgName ? `<div><strong>${escapeHtml(opts.orgName)}</strong></div>` : ''}
    <div>Periodo: ${escapeHtml(opts.fromYMD)} → ${escapeHtml(opts.toYMD)}</div>
    <div>Filtro: ${escapeHtml(filterLabel(opts.filter))}</div>
  </div>
  <div class="stats">
    <div class="stat">Créditos<b>${list.length}</b></div>
    <div class="stat">Pendientes<b>${pendientes}</b></div>
    <div class="stat">Pagados<b>${pagados}</b></div>
    <div class="stat">Monto total<b>${formatMoney(monto)}</b></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Folio</th><th>Fecha</th><th>Cliente</th><th>Vendedor</th><th>Total</th>
        <th>Plazo</th><th>Vence</th><th>Estado</th>
      </tr>
    </thead>
    <tbody>${detailRows}</tbody>
  </table>
  <script>window.onload=function(){setTimeout(function(){window.print()},200)}</script>
</body>
</html>`);
  w.document.close();
}
