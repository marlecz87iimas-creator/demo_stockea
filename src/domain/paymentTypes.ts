export const TIPOS_PAGO = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'] as const;
export type TipoPago = (typeof TIPOS_PAGO)[number];

export function tipoPagoLabel(tipo: string | null | undefined): string {
  if (!tipo) return '';
  const labels: Record<string, string> = {
    EFECTIVO: 'Efectivo',
    TARJETA: 'Tarjeta',
    TRANSFERENCIA: 'Transferencia',
    CREDITO: 'Crédito',
  };
  return labels[tipo] || tipo;
}

export function isCreditUnpaid(sale: { is_credit?: boolean; credit_paid_at?: string | null }): boolean {
  return Boolean(sale.is_credit) && !sale.credit_paid_at;
}
