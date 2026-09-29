import { API_PATHS } from './config';
import { apiRequest } from './client';

export interface Application {
  id: string;
  name: string;
  slug: string;
  description?: string;
  status: string;
}

export interface InstalledApp {
  organization_id: string;
  application_id: string;
  name: string;
  slug: string;
  description?: string;
  status: string;
  application_status: string;
  installed_at: string;
}

export async function listInstalledApps(token: string, orgId: string): Promise<InstalledApp[]> {
  const result = await apiRequest<InstalledApp[] | { installations: InstalledApp[] }>(
    `${API_PATHS.applications}/organizations/${orgId}/installed`,
    { token },
  );
  if (Array.isArray(result)) return result;
  return result.installations ?? [];
}

export async function listCatalog(token: string): Promise<Application[]> {
  const result = await apiRequest<{ applications: Application[] } | Application[]>(
    `${API_PATHS.applications}/catalog`,
    { token },
  );
  if (Array.isArray(result)) return result;
  return result.applications ?? [];
}

export async function installApp(
  token: string,
  appId: string,
  organizationId: string,
): Promise<void> {
  await apiRequest(`${API_PATHS.applications}/${appId}/install`, {
    method: 'POST',
    token,
    body: { organization_id: organizationId },
  });
}
