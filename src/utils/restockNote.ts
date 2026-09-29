import { formatMoney } from './format';

/** Builds a movement note documenting a restock purchase without changing product prices. */
export function buildRestockNote(
  baseNote: string,
  opts: { totalPurchase?: number; unitCost?: number; unitPrice?: number; unit?: string },
): string | undefined {
  const parts: string[] = [];
  if (opts.totalPurchase != null && opts.totalPurchase > 0) {
    parts.push(`Compra: ${formatMoney(opts.totalPurchase)}`);
  }
  if (opts.unitCost != null && opts.unitCost > 0) {
    const suffix = opts.unit ? ` / ${opts.unit}` : '';
    parts.push(`Costo unitario: ${formatMoney(opts.unitCost)}${suffix}`);
  }
  if (opts.unitPrice != null && opts.unitPrice > 0) {
    parts.push(`Precio venta: ${formatMoney(opts.unitPrice)}`);
  }
  const purchase = parts.length > 0 ? parts.join(' · ') : '';
  const note = baseNote.trim();
  if (purchase && note) return `${purchase} — ${note}`;
  if (purchase) return purchase;
  if (note) return note;
  return undefined;
}
