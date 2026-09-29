import type { InstalledApp } from '../api/applications';
import { canAccessStockeaPath, parseJwtRoles, resolveStockeaProfile } from '../domain/stockeaRoles';

const INVENTORY_APP_SLUGS = ['costea', 'stockea'] as const;

const STOCKEA_READ_PERMS = [
  'stockea:products:read',
  'stockea:movements:read',
] as const;

export function parseJwtPermissions(token: string): string[] {
  try {
    const payload = token.split('.')[1];
    if (!payload) return [];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return Array.isArray(decoded.permissions) ? decoded.permissions : [];
  } catch {
    return [];
  }
}

export function hasStockeaPermission(permissions: string[]): boolean {
  return permissions.some((p) =>
    STOCKEA_READ_PERMS.includes(p as (typeof STOCKEA_READ_PERMS)[number]),
  );
}

export function hasInventoryEntitlement(installedApps: InstalledApp[]): boolean {
  return installedApps.some((app) =>
    INVENTORY_APP_SLUGS.includes(app.slug as (typeof INVENTORY_APP_SLUGS)[number]),
  );
}

/** Acceso al inventario: permisos Stockea explícitos o app Costea/Stockea instalada en la org. */
export function canAccessInventory(
  permissions: string[],
  installedApps: InstalledApp[],
): boolean {
  return hasStockeaPermission(permissions) || hasInventoryEntitlement(installedApps);
}

export function hasPermission(permissions: string[], slug: string): boolean {
  return permissions.includes(slug);
}

export function isPlatformAdmin(roles: string[]): boolean {
  return roles.includes('admin');
}

export function isOrgPrincipal(roles: string[]): boolean {
  return roles.includes('manager');
}

/** Solo administradores de plataforma ven y gestionan todos los sistemas. */
export function canManageOrganizations(roles: string[]): boolean {
  return isPlatformAdmin(roles);
}

/** Admin y principal pueden administrar usuarios de su organización. */
export function canManageOrgUsers(roles: string[], permissions: string[]): boolean {
  return isPlatformAdmin(roles) || isOrgPrincipal(roles)
    || hasPermission(permissions, 'identity:users:write');
}

/** Admin y principal pueden configurar el sistema (logo, etc.). */
export function canManageSystemConfig(roles: string[], permissions: string[]): boolean {
  return isPlatformAdmin(roles) || isOrgPrincipal(roles)
    || hasPermission(permissions, 'configuration:write');
}

export function canCreatePrincipalUsers(permissions: string[]): boolean {
  return hasPermission(permissions, 'identity:users:write');
}

export function buildStockeaAccess(roles: string[], permissions: string[]) {
  const profile = resolveStockeaProfile(roles, permissions);
  return {
    profile,
    canAccessPath: (path: string) => canAccessStockeaPath(profile, path),
  };
}

export { parseJwtRoles, resolveStockeaProfile, canAccessStockeaPath };

export function inventoryAccessLabel(installedApps: InstalledApp[]): string | null {
  const slugs = installedApps.map((a) => a.slug);
  if (slugs.includes('stockea')) return 'Stockea';
  if (slugs.includes('costea')) return 'Costea';
  return null;
}

export function pickOrgId(
  organizations: { id: string }[],
  preferredId?: string | null,
): string | null {
  if (!organizations.length) return null;
  if (preferredId && organizations.some((o) => o.id === preferredId)) return preferredId;
  return organizations[0].id;
}
