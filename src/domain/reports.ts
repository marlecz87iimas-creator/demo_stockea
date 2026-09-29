import type { InventorySummary, Product, Reporte, Sale, StockMovement } from '../types';
import { movementTypeLabel } from '../auth/auth';

function alertLevel(product: Product): 'OK' | 'BAJO' | 'CRITICO' {
  if (product.status !== 'active') return 'OK';
  if (product.quantity <= 0) return 'CRITICO';
  if (product.low_stock || product.quantity <= product.min_quantity) return 'BAJO';
  return 'OK';
}

function suggestedQty(product: Product): number {
  const deficit = product.min_quantity - product.quantity;
  return deficit > 0 ? Math.ceil(deficit) : Math.ceil(product.min_quantity || 1);
}

export function buildReport(
  products: Product[],
  movements: StockMovement[],
  sales: Sale[],
  summary: InventorySummary,
): Reporte {
  const active = products.filter((p) => p.status === 'active');
  let alertasCriticas = 0;
  let alertasBajas = 0;
  const alertas: Reporte['alertas'] = [];
  const porCategoriaMap = new Map<string, { productos: number; unidades: number; alertas: number }>();

  for (const p of active) {
    const cat = p.category?.trim() || 'Sin categoría';
    const acc = porCategoriaMap.get(cat) ?? { productos: 0, unidades: 0, alertas: 0 };
    acc.productos += 1;
    acc.unidades += p.quantity;

    const nivel = alertLevel(p);
    if (nivel === 'CRITICO') {
      alertasCriticas += 1;
      acc.alertas += 1;
      alertas.push({
        product_id: p.id,
        sku: p.sku,
        producto_nombre: p.name,
        cantidad_actual: p.quantity,
        stock_minimo: p.min_quantity,
        cantidad_sugerida: suggestedQty(p),
        nivel,
      });
    } else if (nivel === 'BAJO') {
      alertasBajas += 1;
      acc.alertas += 1;
      alertas.push({
        product_id: p.id,
        sku: p.sku,
        producto_nombre: p.name,
        cantidad_actual: p.quantity,
        stock_minimo: p.min_quantity,
        cantidad_sugerida: suggestedQty(p),
        nivel,
      });
    }

    porCategoriaMap.set(cat, acc);
  }

  const productMap = new Map(products.map((p) => [p.id, p]));
  const hoy = new Date().toDateString();
  const ventasHoy = sales.filter((s) => new Date(s.created_at).toDateString() === hoy).length;

  return {
    inventario: {
      total_productos: summary.active_products,
      total_unidades: summary.total_quantity,
      alertas_criticas: alertasCriticas,
      alertas_bajas: alertasBajas,
    },
    ventas: {
      total_ventas: sales.length,
      monto_total: sales.reduce((sum, s) => sum + s.total, 0),
      ventas_hoy: ventasHoy,
    },
    por_categoria: [...porCategoriaMap.entries()]
      .map(([categoria, row]) => ({ categoria, ...row }))
      .sort((a, b) => a.categoria.localeCompare(b.categoria, 'es')),
    alertas: alertas.sort((a, b) => {
      if (a.nivel === b.nivel) return a.producto_nombre.localeCompare(b.producto_nombre, 'es');
      return a.nivel === 'CRITICO' ? -1 : 1;
    }),
    movimientos_recientes: movements.slice(0, 15).map((m) => {
      const product = productMap.get(m.product_id);
      return {
        id: m.id,
        fecha: m.created_at,
        tipo: movementTypeLabel(m.movement_type),
        sku: product?.sku ?? '—',
        producto_nombre: product?.name ?? m.product_id.slice(0, 8),
        cantidad: m.quantity,
      };
    }),
  };
}

export async function fetchReportData(
  token: string,
  orgId: string,
  loaders: {
    getSummary: (token: string, orgId: string) => Promise<InventorySummary>;
    listProducts: (token: string, orgId: string, params?: { limit?: number; status?: string }) => Promise<{ items: Product[] }>;
    listMovements: (token: string, orgId: string, params?: { limit?: number }) => Promise<{ items: StockMovement[] }>;
    listSales: (token: string, orgId: string, params?: { limit?: number }) => Promise<{ items: Sale[] }>;
  },
): Promise<Reporte> {
  const [summary, productsResult, movementsResult, salesResult] = await Promise.all([
    loaders.getSummary(token, orgId),
    loaders.listProducts(token, orgId, { limit: 500, status: 'active' }),
    loaders.listMovements(token, orgId, { limit: 15 }),
    loaders.listSales(token, orgId, { limit: 100 }),
  ]);

  return buildReport(
    productsResult.items,
    movementsResult.items,
    salesResult.items,
    summary,
  );
}
