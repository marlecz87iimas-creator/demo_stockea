import { apiUpload } from './client';
import { API_PATHS } from './config';

export interface UploadedFile {
  id: string;
  organization_id?: string;
  name: string;
  content_type: string;
  size_bytes: number;
  url?: string;
  created_at: string;
}

export async function uploadFile(
  token: string,
  file: File,
  organizationId?: string,
): Promise<UploadedFile> {
  const form = new FormData();
  form.append('file', file);
  if (organizationId) form.append('organization_id', organizationId);
  return apiUpload<UploadedFile>(API_PATHS.files, form, { token });
}
