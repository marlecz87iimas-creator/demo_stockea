export interface MaintenanceWindow {
  starts_at: string;
  ends_at: string;
}

export type MaintenancePhase = 'none' | 'upcoming' | 'active';

export function getMaintenancePhase(
  maintenance: MaintenanceWindow | null | undefined,
  now = new Date(),
): MaintenancePhase {
  if (!maintenance?.starts_at || !maintenance?.ends_at) return 'none';
  const start = new Date(maintenance.starts_at);
  const end = new Date(maintenance.ends_at);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || !(end > start)) {
    return 'none';
  }
  if (now < start) return 'upcoming';
  if (now < end) return 'active';
  return 'none';
}

export function formatMaintenanceDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function maintenanceBannerMessage(maintenance: MaintenanceWindow): string {
  return `El sistema entra en mantenimiento a las ${formatMaintenanceDateTime(maintenance.starts_at)} y acaba a las ${formatMaintenanceDateTime(maintenance.ends_at)}.`;
}

export const MAINTENANCE_BLOCKED_MESSAGE =
  'El sistema está en mantenimiento. No se pueden realizar transacciones importantes.';

/** datetime-local value from ISO */
export function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** local datetime-local → ISO */
export function fromDatetimeLocalValue(local: string): string {
  const d = new Date(local);
  return d.toISOString();
}
