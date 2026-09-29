export const STOCKEA_STAFF_ROLES = ['vendedor', 'cajero', 'supervisor'] as const;

export type StockeaStaffRole = (typeof STOCKEA_STAFF_ROLES)[number];

export type StockeaProfile = 'admin' | 'principal' | 'supervisor' | 'vendedor' | 'cajero' | 'legacy';

export function parseJwtRoles(token: string): string[] {
  try {
    const payload = token.split('.')[1];
    if (!payload) return [];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return Array.isArray(decoded.roles) ? decoded.roles : [];
  } catch {
    return [];
  }
}

export function resolveStockeaProfile(roles: string[], permissions: string[]): StockeaProfile {
  if (roles.includes('admin') || permissions.includes('identity:users:write')) {
    return 'admin';
  }
  if (roles.includes('manager') || permissions.includes('organization:write')) {
    return 'principal';
  }
  if (roles.includes('supervisor')) return 'supervisor';
  if (roles.includes('cajero')) return 'cajero';
  if (roles.includes('vendedor')) return 'vendedor';
  return 'legacy';
}

/** Rutas de primer nivel sin slash inicial: dashboard, ventas, inventario, … */
export function canAccessStockeaPath(profile: StockeaProfile, path: string): boolean {
  const segment = path.replace(/^\//, '').split('/')[0] || 'dashboard';

  if (profile === 'admin' || profile === 'principal') return true;

  if (profile === 'supervisor') {
    return ['dashboard', 'ventas', 'inventario', 'productos', 'materiales'].includes(segment);
  }

  if (profile === 'vendedor' || profile === 'cajero' || profile === 'legacy') {
    return ['dashboard', 'ventas'].includes(segment);
  }

  return false;
}

export function isStockeaStaffRole(slug: string): slug is StockeaStaffRole {
  return STOCKEA_STAFF_ROLES.includes(slug as StockeaStaffRole);
}
