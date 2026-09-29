import type { AuthSession } from '../types';
import { DEMO_MODE } from '../demo/config';

const TOKEN_KEY = 'stockea_ext_token';
const REFRESH_KEY = 'stockea_ext_refresh';
const ORG_KEY = 'stockea_ext_org';

/** In-memory auth for demo — cleared when the tab/page closes. */
const memory: { token: string | null; refresh: string | null; orgId: string | null } = {
  token: null,
  refresh: null,
  orgId: null,
};

export function getToken(): string | null {
  if (DEMO_MODE) return memory.token;
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (DEMO_MODE) return memory.refresh;
  return localStorage.getItem(REFRESH_KEY);
}

export function getOrgId(): string | null {
  if (DEMO_MODE) return memory.orgId;
  return localStorage.getItem(ORG_KEY);
}

export function setToken(token: string): void {
  if (DEMO_MODE) {
    memory.token = token;
    return;
  }
  localStorage.setItem(TOKEN_KEY, token);
}

export function setRefreshToken(token: string): void {
  if (DEMO_MODE) {
    memory.refresh = token;
    return;
  }
  localStorage.setItem(REFRESH_KEY, token);
}

export function setOrgId(orgId: string | null): void {
  if (DEMO_MODE) {
    memory.orgId = orgId;
    return;
  }
  if (orgId) localStorage.setItem(ORG_KEY, orgId);
  else localStorage.removeItem(ORG_KEY);
}

export function clearAuth(): void {
  if (DEMO_MODE) {
    memory.token = null;
    memory.refresh = null;
    memory.orgId = null;
    return;
  }
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(ORG_KEY);
}

export function userDisplayName(session: AuthSession): string {
  const { first_name, last_name, email } = session.user;
  const name = [first_name, last_name].filter(Boolean).join(' ').trim();
  return name || email;
}

export function memberDisplayName(member: { first_name: string; last_name: string; email: string }): string {
  const name = [member.first_name, member.last_name].filter(Boolean).join(' ').trim();
  return name || member.email;
}

export function rolLabel(slug: string): string {
  switch (slug) {
    case 'admin': return 'Administrador';
    case 'manager': return 'Principal';
    case 'supervisor': return 'Supervisor';
    case 'cajero': return 'Cajero';
    case 'vendedor': return 'Vendedor';
    case 'user': return 'Usuario';
    default: return slug;
  }
}

export function primaryRoleLabel(roles: string[]): string {
  const priority = ['admin', 'manager', 'supervisor', 'cajero', 'vendedor', 'user'];
  const found = priority.find((r) => roles.includes(r));
  return found ? rolLabel(found) : '';
}

export function movementTypeLabel(type: string): string {
  switch (type) {
    case 'in': return 'Entrada';
    case 'out': return 'Salida';
    case 'adjustment': return 'Ajuste';
    default: return type;
  }
}

export function movementTypeBadge(type: string): string {
  switch (type) {
    case 'in': return 'badge-ok';
    case 'out': return 'badge-critico';
    case 'adjustment': return 'badge-bajo';
    default: return '';
  }
}
