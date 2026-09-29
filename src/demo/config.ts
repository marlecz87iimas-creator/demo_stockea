/** Demo visual: sin API, sin auth real, sin lógica de negocio. */
export const DEMO_LIMIT = 2;

export type DemoEntity =
  | 'productos'
  | 'materiales'
  | 'ventas'
  | 'sucursales'
  | 'usuarios'
  | 'sistemas';

export const DEMO_ENTITY_LABEL: Record<DemoEntity, string> = {
  productos: 'productos',
  materiales: 'materiales',
  ventas: 'ventas',
  sucursales: 'sucursales',
  usuarios: 'usuarios',
  sistemas: 'sistemas',
};

export function demoLimitMessage(entity: DemoEntity): string {
  return `Demo: máximo ${DEMO_LIMIT} ${DEMO_ENTITY_LABEL[entity]}. Los datos se pierden al cerrar la página.`;
}

export function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function money(value: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
