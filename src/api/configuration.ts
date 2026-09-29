import { apiRequest } from './client';
import { API_PATHS } from './config';

export interface OrgConfiguration {
  organization_id: string;
  language: string;
  currency: string;
  timezone: string;
  theme: string;
  tax_rate?: string;
  logo_url?: string;
  fiscal_data?: string;
  updated_at: string;
}

export async function getOrgConfiguration(token: string, orgId: string): Promise<OrgConfiguration> {
  return apiRequest<OrgConfiguration>(API_PATHS.orgConfiguration(orgId), { token });
}

export async function updateOrgConfiguration(
  token: string,
  orgId: string,
  input: { logo_url?: string | null },
): Promise<OrgConfiguration> {
  return apiRequest<OrgConfiguration>(API_PATHS.orgConfiguration(orgId), {
    method: 'PUT',
    token,
    body: input,
  });
}

export async function setOrgConfigValue(
  token: string,
  orgId: string,
  key: string,
  value: string,
): Promise<void> {
  await apiRequest(API_PATHS.orgConfigurationValue(orgId, key), {
    method: 'PUT',
    token,
    body: { value },
  });
}
