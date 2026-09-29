export const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '');

export const API_PATHS = {
  register: '/identity/auth/register',
  login: '/identity/auth/login',
  refresh: '/identity/auth/refresh',
  logout: '/identity/auth/logout',
  me: '/identity/auth/me',
  organizations: '/organizations',
  applications: '/applications',
  files: '/files',
  orgConfiguration: (orgId: string) => `/configurations/organizations/${orgId}`,
  orgConfigurationValue: (orgId: string, key: string) =>
    `/configurations/organizations/${orgId}/${encodeURIComponent(key)}`,
  stockea: (orgId: string) => `/stockea/organizations/${orgId}`,
} as const;
