import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { listInstalledApps } from '../api/applications';
import { fetchCurrentUser, loginUser, logoutUser } from '../api/auth';
import { refreshAccessToken } from '../api/client';
import { getOrgConfiguration } from '../api/configuration';
import { getOrganization, listOrganizations } from '../api/organizations';
import {
  DEMO_MODE,
  DEMO_ORG_ID,
  DEMO_REFRESH,
  DEMO_TOKEN,
} from '../demo/config';
import { resetDemoStore } from '../demo/store';
import { applySystemTheme } from '../theme/systemTheme';
import type { AuthSession, InstalledApp, MaintenanceWindow, UserOrganization } from '../types';
import { isDisplayableLogoUrl } from '../utils/logoImage';
import {
  buildStockeaAccess,
  canAccessInventory,
  canManageOrgUsers,
  canManageOrganizations,
  canManageSystemConfig,
  isPlatformAdmin,
  parseJwtPermissions,
  parseJwtRoles,
} from './access';
import {
  clearAuth,
  getOrgId,
  getRefreshToken,
  getToken,
  setOrgId,
  setRefreshToken,
  setToken,
} from './auth';

interface AuthContextValue {
  session: AuthSession | null;
  loading: boolean;
  login: (usuario: string, password: string) => Promise<void>;
  logout: () => void;
  cambiarOrganizacion: (orgId: string) => Promise<void>;
  refreshAccess: () => Promise<void>;
  refreshOrganizations: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function resolveOrganizations(
  token: string,
  fromUser: UserOrganization[] | undefined,
): Promise<UserOrganization[]> {
  if (fromUser && fromUser.length > 0) {
    return fromUser.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      role: o.role,
    }));
  }
  const roles = parseJwtRoles(token);
  if (!isPlatformAdmin(roles)) {
    return [];
  }
  const orgs = await listOrganizations(token);
  return orgs.map((o) => ({ id: o.id, name: o.name, slug: o.slug, role: 'member' }));
}

async function resolveInstalledApps(token: string, orgId: string | null): Promise<InstalledApp[]> {
  if (!orgId) return [];
  try {
    return await listInstalledApps(token, orgId);
  } catch {
    return [];
  }
}

async function resolveLogoUrl(token: string, orgId: string | null): Promise<string | null> {
  if (!orgId) return null;
  try {
    const cfg = await getOrgConfiguration(token, orgId);
    const url = cfg.logo_url?.trim();
    return url && isDisplayableLogoUrl(url) ? url : null;
  } catch {
    return null;
  }
}

async function resolveOrgContext(token: string, orgId: string | null) {
  if (!orgId) {
    return { installedApps: [] as InstalledApp[], systemTipo: null as string | null, logoUrl: null as string | null, maintenance: null as MaintenanceWindow | null };
  }
  const [installedApps, orgResult, logoUrl] = await Promise.all([
    resolveInstalledApps(token, orgId),
    getOrganization(token, orgId).catch(() => null),
    resolveLogoUrl(token, orgId),
  ]);
  const maintenance = orgResult?.maintenance?.starts_at && orgResult.maintenance?.ends_at
    ? { starts_at: orgResult.maintenance.starts_at, ends_at: orgResult.maintenance.ends_at }
    : null;
  return {
    installedApps,
    systemTipo: orgResult?.stockea?.tipo ?? null,
    logoUrl,
    maintenance,
  };
}

function pickOrgId(orgs: UserOrganization[]): string | null {
  const stored = getOrgId();
  if (stored && orgs.some((o) => o.id === stored)) return stored;
  return orgs[0]?.id ?? null;
}

async function pickSessionOrgId(
  token: string,
  organizations: UserOrganization[],
  platformAdmin: boolean,
): Promise<string | null> {
  const stored = getOrgId();
  const storedOk = stored && organizations.some((org) => org.id === stored) ? stored : null;
  if (platformAdmin || organizations.length <= 1) return storedOk ?? organizations[0]?.id ?? null;
  if (storedOk) {
    const current = await getOrganization(token, storedOk).catch(() => null);
    if (current?.stockea?.tipo) return storedOk;
  }
  for (const org of organizations) {
    const detail = await getOrganization(token, org.id).catch(() => null);
    if (detail?.stockea?.tipo) return org.id;
  }
  return storedOk ?? organizations[0]?.id ?? null;
}

function buildSessionState(
  token: string,
  refreshToken: string,
  user: AuthSession['user'],
  organizations: UserOrganization[],
  orgId: string | null,
  installedApps: InstalledApp[],
  systemTipo: string | null,
  logoUrl: string | null,
  maintenance: MaintenanceWindow | null,
): AuthSession {
  const permissions = parseJwtPermissions(token);
  const roles = parseJwtRoles(token);
  const stockeaAccess = buildStockeaAccess(roles, permissions);
  return {
    token,
    refreshToken,
    user,
    orgId,
    organizations,
    permissions,
    roles,
    stockeaProfile: stockeaAccess.profile,
    canAccessPath: stockeaAccess.canAccessPath,
    installedApps,
    canAccessInventory: canAccessInventory(permissions, installedApps),
    isPlatformAdmin: isPlatformAdmin(roles),
    canManageOrganizations: canManageOrganizations(roles),
    canManageOrgUsers: canManageOrgUsers(roles, permissions),
    canManageSystemConfig: canManageSystemConfig(roles, permissions),
    systemTipo,
    logoUrl,
    maintenance,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  const buildSession = useCallback(async (token: string, refreshToken: string) => {
    const user = await fetchCurrentUser(token);
    const organizations = await resolveOrganizations(token, user.organizations);
    const orgId = await pickSessionOrgId(token, organizations, isPlatformAdmin(parseJwtRoles(token)));
    if (orgId) setOrgId(orgId);
    const { installedApps, systemTipo, logoUrl, maintenance } = await resolveOrgContext(token, orgId);
    setSession(buildSessionState(
      token, refreshToken, user, organizations, orgId, installedApps, systemTipo, logoUrl, maintenance,
    ));
  }, []);

  useEffect(() => {
    if (DEMO_MODE) {
      clearAuth();
      resetDemoStore();
      setToken(DEMO_TOKEN);
      setRefreshToken(DEMO_REFRESH);
      setOrgId(DEMO_ORG_ID);
      buildSession(DEMO_TOKEN, DEMO_REFRESH)
        .catch(() => {
          clearAuth();
          setSession(null);
        })
        .finally(() => setLoading(false));
      return;
    }

    const token = getToken();
    const refreshToken = getRefreshToken();
    if (!token || !refreshToken) {
      setLoading(false);
      return;
    }
    buildSession(token, refreshToken)
      .catch(async () => {
        try {
          const next = await refreshAccessToken(refreshToken);
          if (next) {
            setToken(next);
            await buildSession(next, refreshToken);
            return;
          }
        } catch {
          /* refresh failed */
        }
        clearAuth();
        setSession(null);
      })
      .finally(() => setLoading(false));
  }, [buildSession]);

  const login = async (usuario: string, password: string) => {
    if (DEMO_MODE) {
      setToken(DEMO_TOKEN);
      setRefreshToken(DEMO_REFRESH);
      setOrgId(DEMO_ORG_ID);
      await buildSession(DEMO_TOKEN, DEMO_REFRESH);
      return;
    }
    const result = await loginUser({ email: usuario, password });
    setToken(result.token);
    setRefreshToken(result.refreshToken);
    const organizations = await resolveOrganizations(result.token, result.user.organizations);
    const orgId = await pickSessionOrgId(result.token, organizations, isPlatformAdmin(parseJwtRoles(result.token)));
    if (orgId) setOrgId(orgId);
    const { installedApps, systemTipo, logoUrl, maintenance } = await resolveOrgContext(result.token, orgId);
    setSession(buildSessionState(
      result.token, result.refreshToken, result.user, organizations, orgId, installedApps, systemTipo, logoUrl, maintenance,
    ));
  };

  const logout = () => {
    if (DEMO_MODE) {
      resetDemoStore();
      clearAuth();
      applySystemTheme(null);
      setSession(null);
      setToken(DEMO_TOKEN);
      setRefreshToken(DEMO_REFRESH);
      setOrgId(DEMO_ORG_ID);
      buildSession(DEMO_TOKEN, DEMO_REFRESH).catch(() => setSession(null));
      return;
    }
    const refresh = getRefreshToken();
    if (refresh) logoutUser(refresh).catch(() => {});
    clearAuth();
    applySystemTheme(null);
    setSession(null);
  };

  const cambiarOrganizacion = async (orgId: string) => {
    setOrgId(orgId);
    if (!session) return;
    const { installedApps, systemTipo, logoUrl, maintenance } = await resolveOrgContext(session.token, orgId);
    setSession(buildSessionState(
      session.token, session.refreshToken, session.user, session.organizations, orgId, installedApps, systemTipo, logoUrl, maintenance,
    ));
  };

  const refreshAccess = async () => {
    if (!session) return;
    const { installedApps, systemTipo, logoUrl, maintenance } = await resolveOrgContext(session.token, session.orgId);
    setSession(buildSessionState(
      session.token, session.refreshToken, session.user, session.organizations, session.orgId, installedApps, systemTipo, logoUrl, maintenance,
    ));
  };

  const refreshOrganizations = async () => {
    if (!session) return;
    const organizations = await resolveOrganizations(session.token, session.user.organizations);
    const orgId = pickOrgId(organizations);
    if (orgId) setOrgId(orgId);
    const { installedApps, systemTipo, logoUrl, maintenance } = await resolveOrgContext(session.token, orgId);
    setSession(buildSessionState(
      session.token, session.refreshToken, session.user, organizations, orgId, installedApps, systemTipo, logoUrl, maintenance,
    ));
  };

  useEffect(() => {
    applySystemTheme(session?.systemTipo ?? null);
  }, [session?.systemTipo]);

  return (
    <AuthContext.Provider value={{
      session, loading, login, logout, cambiarOrganizacion, refreshAccess, refreshOrganizations,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
