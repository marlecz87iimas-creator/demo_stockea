export function formatMoney(value: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatDateOnly(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function formatQuantity(value: number, unit?: string): string {
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function stockBadge(product: { quantity: number; min_quantity: number; low_stock: boolean }): { label: string; className: string } {
  if (product.quantity <= 0) return { label: 'Agotado', className: 'badge-critico' };
  if (product.low_stock || product.quantity <= product.min_quantity) return { label: 'Bajo', className: 'badge-bajo' };
  return { label: 'OK', className: 'badge-ok' };
}

export function alertaBadge(nivel: string): string {
  const map: Record<string, string> = { OK: 'badge-ok', BAJO: 'badge-bajo', CRITICO: 'badge-critico' };
  return `badge ${map[nivel] || ''}`;
}

export function creditDueBadge(nivel: string): string {
  const map: Record<string, string> = {
    PROXIMO: 'badge-bajo',
    HOY: 'badge-critico',
    VENCIDO: 'badge-critico',
  };
  return `badge ${map[nivel] || 'badge-bajo'}`;
}

export function creditDueLabel(dias: number): string {
  if (dias < 0) return dias === -1 ? 'Venció ayer' : `Venció hace ${Math.abs(dias)} días`;
  if (dias === 0) return 'Vence hoy';
  if (dias === 1) return 'Vence mañana';
  return `Vence en ${dias} días`;
}
