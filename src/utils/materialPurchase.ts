/** Fecha local YYYY-MM-DD para inputs type="date". */
export function todayLocalDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Convierte YYYY-MM-DD a ISO para el API (medianoche UTC). */
export function localDateToISO(date: string): string | undefined {
  if (!date.trim()) return undefined;
  return new Date(`${date}T12:00:00`).toISOString();
}

export function isMaterialPurchase(m: {
  movement_type: string;
  supplier?: string;
  total_purchase?: number | null;
}): boolean {
  return m.movement_type === 'in' && Boolean(m.supplier?.trim() || (m.total_purchase != null && m.total_purchase > 0));
}
