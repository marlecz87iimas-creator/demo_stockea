import type { Product } from '../types';
import { productBranchLabel } from '../domain/branches';
import { formatMoney, formatQuantity, stockBadge } from './format';
import { downloadExcel, excelDateTime, type ExcelSheet } from './excel';

export interface InventoryExportMeta {
  orgName?: string;
  search?: string;
  statusFilter?: string;
  branchLabel?: string;
}

function money(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function dash(value: string | null | undefined): string {
  const v = (value || '').trim();
  return v || '-';
}

function itemTypeLabel(type: Product['item_type']): string {
  return type === 'material' ? 'Material' : 'Producto';
}

function buildSummary(products: Product[]) {
  const totalUnits = products.reduce((s, p) => s + p.quantity, 0);
  const inventoryValue = products.reduce((s, p) => s + p.quantity * p.unit_cost, 0);
  const low = products.filter((p) => stockBadge(p).label === 'Bajo').length;
  const out = products.filter((p) => stockBadge(p).label === 'Agotado').length;
  return { totalUnits, inventoryValue, low, out };
}

function filterLabel(meta: InventoryExportMeta): string {
  const parts: string[] = [];
  if (meta.statusFilter) parts.push(`Estado: ${meta.statusFilter}`);
  if (meta.branchLabel) parts.push(`Sucursal: ${meta.branchLabel}`);
  if (meta.search?.trim()) parts.push(`Busqueda: ${meta.search.trim()}`);
  return parts.length ? parts.join(' · ') : 'Todos los productos';
}

function detailRows(products: Product[]): ExcelCellRow[] {
  return products.map((p) => {
    const badge = stockBadge(p);
    return [
      p.sku,
      p.name,
      productBranchLabel(p),
      dash(p.category),
      itemTypeLabel(p.item_type),
      p.quantity,
      dash(p.unit),
      p.min_quantity,
      money(p.unit_cost),
      money(p.unit_price),
      money(p.quantity * p.unit_cost),
      badge.label,
      excelDateTime(p.updated_at),
    ];
  });
}

type ExcelCellRow = (string | number)[];

export function downloadInventoryExcel(products: Product[], meta: InventoryExportMeta = {}): void {
  const summary = buildSummary(products);
  const generatedAt = excelDateTime(new Date().toISOString());
  const filters = filterLabel(meta);

  const sheets: ExcelSheet[] = [
    {
      name: 'Resumen',
      rows: [
        ['Inventario'],
        ['Organizacion', meta.orgName || '-'],
        ['Generado', generatedAt],
        ['Filtros', filters],
        ['Productos', products.length],
        ['Unidades totales', money(summary.totalUnits)],
        ['Valor inventario', money(summary.inventoryValue)],
        ['Bajo stock', summary.low],
        ['Agotados', summary.out],
      ],
    },
    {
      name: 'Inventario',
      rows: [
        [
          'SKU',
          'Producto',
          'Sucursal',
          'Categoria',
          'Tipo',
          'Cantidad',
          'Unidad',
          'Minimo',
          'Costo unit.',
          'Precio venta',
          'Valor stock',
          'Estado',
          'Actualizado',
        ],
        ...(products.length
          ? detailRows(products)
          : [['Sin productos', '-', '-', '-', '-', 0, '-', 0, 0, 0, 0, '-', '-']]),
      ],
    },
  ];

  const slug = new Date().toISOString().slice(0, 10);
  downloadExcel(`inventario-${slug}`, sheets);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Opens a printable view; use Guardar como PDF in the browser print dialog. */
export function printInventoryPdf(products: Product[], meta: InventoryExportMeta = {}): void {
  const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
  if (!w) return;

  const summary = buildSummary(products);
  const generatedAt = excelDateTime(new Date().toISOString());
  const filters = filterLabel(meta);

  const rows = products.length === 0
    ? '<tr><td colspan="9">Sin productos en el inventario</td></tr>'
    : products.map((p) => {
      const badge = stockBadge(p);
      return `
        <tr>
          <td>${escapeHtml(p.sku)}</td>
          <td>${escapeHtml(p.name)}</td>
          <td>${escapeHtml(productBranchLabel(p))}</td>
          <td>${escapeHtml(dash(p.category))}</td>
          <td>${escapeHtml(formatQuantity(p.quantity, p.unit))}</td>
          <td>${escapeHtml(formatQuantity(p.min_quantity, p.unit))}</td>
          <td>${escapeHtml(badge.label)}</td>
          <td>${formatMoney(p.unit_cost)}</td>
          <td>${formatMoney(p.quantity * p.unit_cost)}</td>
        </tr>
      `;
    }).join('');

  w.document.write(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Inventario</title>
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
  <h1>Inventario</h1>
  <div class="meta">
    ${meta.orgName ? `<div><strong>${escapeHtml(meta.orgName)}</strong></div>` : ''}
    <div>Generado: ${escapeHtml(generatedAt)}</div>
    <div>${escapeHtml(filters)}</div>
  </div>
  <div class="stats">
    <div class="stat">Productos<b>${products.length}</b></div>
    <div class="stat">Unidades<b>${Math.round(summary.totalUnits)}</b></div>
    <div class="stat">Valor<b>${formatMoney(summary.inventoryValue)}</b></div>
    <div class="stat">Bajo<b>${summary.low}</b></div>
    <div class="stat">Agotado<b>${summary.out}</b></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>SKU</th><th>Producto</th><th>Sucursal</th><th>Categoria</th><th>Cantidad</th>
        <th>Minimo</th><th>Estado</th><th>Costo unit.</th><th>Valor stock</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <script>window.onload=function(){setTimeout(function(){window.print()},200)}</script>
</body>
</html>`);
  w.document.close();
}
