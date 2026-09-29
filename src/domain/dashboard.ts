import type { Product, Sale } from '../types';

export type AlertLevel = 'BAJO' | 'CRITICO';
export type CreditDueLevel = 'VENCIDO' | 'HOY' | 'PROXIMO';

export interface DashboardProductAlert {
  product_id: string;
  sku: string;
  producto_nombre: string;
  cantidad: number;
  stock_minimo: number;
  nivel: AlertLevel;
}

export interface DashboardSalesDay {
  cantidad_ventas: number;
  monto_total: number;
  ventas: Sale[];
}

export interface DashboardCreditAlert {
  sale_id: string;
  folio: string;
  cliente: string;
  telefono: string;
  vendedor: string;
  total: number;
  credit_due_at: string;
  dias_restantes: number;
  nivel: CreditDueLevel;
}

export interface DashboardData {
  ventas_dia: DashboardSalesDay;
  proximos_a_acabarse: DashboardProductAlert[];
  agotados: DashboardProductAlert[];
  creditos_por_vencer: DashboardCreditAlert[];
}

export function currentWeekRangeISO(now = new Date()): { from: string; to: string } {
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() + diffToMonday);
  const nextMonday = new Date(monday);
  nextMonday.setDate(nextMonday.getDate() + 7);
  return { from: monday.toISOString(), to: nextMonday.toISOString() };
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysUntilDue(dueAt: string, now = new Date()): number {
  const due = startOfDay(new Date(dueAt));
  const today = startOfDay(now);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

function creditDueLevel(dias: number): CreditDueLevel {
  if (dias < 0) return 'VENCIDO';
  if (dias === 0) return 'HOY';
  return 'PROXIMO';
}

export function buildCreditDueAlerts(sales: Sale[], now = new Date()): DashboardCreditAlert[] {
  return sales
    .filter((s) => s.is_credit && s.credit_due_at)
    .map((s) => {
      const dias = daysUntilDue(s.credit_due_at!, now);
      return {
        sale_id: s.id,
        folio: s.folio,
        cliente: s.customer_name || '—',
        telefono: s.customer_phone || '',
        vendedor: s.seller_name || s.seller_email || '—',
        total: s.total,
        credit_due_at: s.credit_due_at!,
        dias_restantes: dias,
        nivel: creditDueLevel(dias),
      };
    })
    .sort((a, b) => a.dias_restantes - b.dias_restantes || a.folio.localeCompare(b.folio, 'es'));
}

function isToday(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
}

function alertLevel(product: Product): AlertLevel {
  if (product.quantity <= product.min_quantity * 0.5) return 'CRITICO';
  return 'BAJO';
}

function toAlert(product: Product, nivel: AlertLevel): DashboardProductAlert {
  return {
    product_id: product.id,
    sku: product.sku,
    producto_nombre: product.name,
    cantidad: product.quantity,
    stock_minimo: product.min_quantity,
    nivel,
  };
}

export function buildDashboard(
  products: Product[],
  sales: Sale[],
  creditSalesDueWeek: Sale[] = [],
): DashboardData {
  const active = products.filter((p) => p.status === 'active');
  const ventasHoy = sales.filter((s) => isToday(s.created_at));

  const agotados: DashboardProductAlert[] = [];
  const proximos: DashboardProductAlert[] = [];

  for (const p of active) {
    if (p.quantity <= 0) {
      agotados.push(toAlert({ ...p, quantity: 0 }, 'CRITICO'));
    } else if (p.low_stock || p.quantity <= p.min_quantity) {
      proximos.push(toAlert(p, alertLevel(p)));
    }
  }

  proximos.sort((a, b) => a.cantidad - b.cantidad);
  agotados.sort((a, b) => a.producto_nombre.localeCompare(b.producto_nombre, 'es'));

  return {
    ventas_dia: {
      cantidad_ventas: ventasHoy.length,
      monto_total: ventasHoy.reduce((sum, s) => sum + s.total, 0),
      ventas: ventasHoy.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    },
    proximos_a_acabarse: proximos,
    agotados,
    creditos_por_vencer: buildCreditDueAlerts(creditSalesDueWeek),
  };
}
