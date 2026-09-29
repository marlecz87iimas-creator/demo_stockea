import type { Branch, CreateOrganizationStockeaInput, Organization, OrgMember, ProvisionMemberInput, UpdateMemberInput, UpdateOrganizationInput } from '../types';
import { API_PATHS } from './config';
import { apiRequest } from './client';

export async function listOrganizations(
  token: string,
  { page = 1, limit = 100 }: { page?: number; limit?: number } = {},
): Promise<Organization[]> {
  const result = await apiRequest<{ organizations: Organization[] } | Organization[]>(
    `${API_PATHS.organizations}?page=${page}&limit=${limit}`,
    { token },
  );
  if (Array.isArray(result)) return result;
  return result.organizations ?? [];
}

export async function createOrganization(
  token: string,
  input: { name: string; slug?: string; stockea?: CreateOrganizationStockeaInput },
): Promise<Organization> {
  return apiRequest<Organization>(API_PATHS.organizations, {
    method: 'POST',
    token,
    body: input,
  });
}

export async function updateOrganization(
  token: string,
  orgId: string,
  input: UpdateOrganizationInput,
): Promise<Organization> {
  return apiRequest<Organization>(`${API_PATHS.organizations}/${orgId}`, {
    method: 'PATCH',
    token,
    body: input,
  });
}

export async function getOrganization(token: string, orgId: string): Promise<Organization> {
  return apiRequest<Organization>(`${API_PATHS.organizations}/${orgId}`, { token });
}

export async function listAllMembers(token: string): Promise<OrgMember[]> {
  const result = await apiRequest<{ members: OrgMember[] } | OrgMember[]>(
    `${API_PATHS.organizations}/members`,
    { token },
  );
  if (Array.isArray(result)) return result;
  return result.members ?? [];
}

export async function listMembers(token: string, orgId: string): Promise<OrgMember[]> {
  const result = await apiRequest<{ members: OrgMember[] } | OrgMember[]>(
    `${API_PATHS.organizations}/${orgId}/members`,
    { token },
  );
  if (Array.isArray(result)) return result;
  return result.members ?? [];
}

export async function provisionMember(
  token: string,
  orgId: string,
  input: ProvisionMemberInput,
): Promise<OrgMember> {
  return apiRequest<OrgMember>(`${API_PATHS.organizations}/${orgId}/members/provision`, {
    method: 'POST',
    token,
    body: input,
  });
}

export async function updateMember(
  token: string,
  orgId: string,
  userId: string,
  input: UpdateMemberInput,
): Promise<OrgMember> {
  return apiRequest<OrgMember>(`${API_PATHS.organizations}/${orgId}/members/${userId}`, {
    method: 'PATCH',
    token,
    body: input,
  });
}

export async function removeMember(token: string, orgId: string, userId: string): Promise<void> {
  await apiRequest(`${API_PATHS.organizations}/${orgId}/members/${userId}`, {
    method: 'DELETE',
    token,
  });
}

export async function createBranch(
  token: string,
  orgId: string,
  input: { name: string; slug: string; code?: string; image_url?: string },
): Promise<Branch> {
  return apiRequest<Branch>(`${API_PATHS.organizations}/${orgId}/branches`, {
    method: 'POST',
    token,
    body: input,
  });
}

export async function updateBranch(
  token: string,
  orgId: string,
  branchId: string,
  input: { name: string; slug: string; code?: string; image_url?: string },
): Promise<Branch> {
  return apiRequest<Branch>(`${API_PATHS.organizations}/${orgId}/branches/${branchId}`, {
    method: 'PATCH',
    token,
    body: input,
  });
}

export async function listBranches(token: string, orgId: string): Promise<Branch[]> {
  const result = await apiRequest<{ branches?: Branch[] } | Branch[]>(
    `${API_PATHS.organizations}/${orgId}/branches`,
    { token },
  );
  if (Array.isArray(result)) return result;
  return result.branches ?? [];
}
