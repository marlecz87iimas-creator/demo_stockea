import { getRefreshToken, getToken, setRefreshToken, setToken } from '../auth/auth';
import { handleDemoRequest, handleDemoUpload } from '../demo/api';
import { DEMO_MODE } from '../demo/config';
import { API_BASE_URL } from './config';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function asApiError(err: unknown): never {
  if (err instanceof ApiError) throw err;
  throw new ApiError(err instanceof Error ? err.message : 'Error en la demo', 400);
}

function unwrapPayload<T>(data: unknown): T {
  if (!data || typeof data !== 'object') return data as T;
  const envelope = data as { success?: boolean; data?: T; error?: { message?: string } };
  if (envelope.success === false) {
    throw new ApiError(envelope.error?.message || 'Error del servidor', 0);
  }
  if (envelope.success === true && 'data' in envelope) {
    return envelope.data as T;
  }
  return data as T;
}

function isAuthPath(path: string): boolean {
  return path.startsWith('/identity/auth/login')
    || path.startsWith('/identity/auth/register')
    || path.startsWith('/identity/auth/refresh')
    || path.startsWith('/identity/auth/forgot')
    || path.startsWith('/identity/auth/reset');
}

function humanizeError(message: string, status: number, path: string): string {
  const lower = message.toLowerCase();
  if (status === 401 || lower.includes('invalid credentials')) {
    if (isAuthPath(path) || lower.includes('invalid credentials')) {
      return 'Usuario o contraseña incorrectos';
    }
    return 'Sesión expirada. Vuelve a iniciar sesión.';
  }
  if (lower.includes('invalid or expired token') || lower.includes('token expired')) {
    return 'Sesión expirada. Vuelve a iniciar sesión.';
  }
  return message;
}

async function send(
  path: string,
  { method = 'GET', token, body }: { method?: string; token?: string; body?: unknown } = {},
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('No se pudo conectar con Hildra Core. Verifica que el API esté encendido.', 0);
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  return { ok: response.ok, status: response.status, data };
}

let refreshInFlight: Promise<string | null> | null = null;

export async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const tokens = await apiRequest<{ access_token?: string; refresh_token?: string }>(
    '/identity/auth/refresh',
    { method: 'POST', body: { refresh_token: refreshToken } },
  );
  return tokens?.access_token || null;
}

async function rotateAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  const refresh = getRefreshToken();
  if (!refresh) return null;

  refreshInFlight = (async () => {
    try {
      const { ok, data } = await send(
        '/identity/auth/refresh',
        { method: 'POST', body: { refresh_token: refresh } },
      );
      if (!ok) return null;
      const tokens = unwrapPayload<{ access_token?: string; refresh_token?: string }>(data);
      if (!tokens?.access_token) return null;
      setToken(tokens.access_token);
      if (tokens.refresh_token) setRefreshToken(tokens.refresh_token);
      return tokens.access_token;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function apiRequest<T>(
  path: string,
  { method = 'GET', token, body }: { method?: string; token?: string; body?: unknown } = {},
): Promise<T> {
  if (DEMO_MODE) {
    try {
      return await handleDemoRequest<T>(path, { method, body });
    } catch (err) {
      asApiError(err);
    }
  }

  const activeToken = isAuthPath(path) ? token : (token ?? getToken() ?? undefined);
  const first = await send(path, { method, token: activeToken, body });

  if (!first.ok && first.status === 401 && activeToken && !isAuthPath(path)) {
    const nextToken = await rotateAccessToken();
    if (nextToken) {
      const retry = await send(path, { method, token: nextToken, body });
      if (retry.ok) return unwrapPayload<T>(retry.data);
      const err = retry.data as { error?: { message?: string }; message?: string } | null;
      const message = err?.error?.message || err?.message || `Error del servidor (${retry.status})`;
      throw new ApiError(humanizeError(message, retry.status, path), retry.status);
    }
  }

  if (!first.ok) {
    const err = first.data as { error?: { message?: string }; message?: string } | null;
    const message = err?.error?.message || err?.message || `Error del servidor (${first.status})`;
    throw new ApiError(humanizeError(message, first.status, path), first.status);
  }

  return unwrapPayload<T>(first.data);
}

async function sendForm(
  path: string,
  form: FormData,
  { method = 'POST', token }: { method?: string; token?: string } = {},
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: form,
    });
  } catch {
    throw new ApiError('No se pudo conectar con Hildra Core. Verifica que el API esté encendido.', 0);
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  return { ok: response.ok, status: response.status, data };
}

/** Multipart upload — no fija Content-Type para que el browser agregue el boundary. */
export async function apiUpload<T>(
  path: string,
  form: FormData,
  { method = 'POST', token }: { method?: string; token?: string } = {},
): Promise<T> {
  if (DEMO_MODE) {
    try {
      return await handleDemoUpload<T>(form);
    } catch (err) {
      asApiError(err);
    }
  }

  const activeToken = token ?? getToken() ?? undefined;
  const first = await sendForm(path, form, { method, token: activeToken });

  if (!first.ok && first.status === 401 && activeToken) {
    const nextToken = await rotateAccessToken();
    if (nextToken) {
      const retry = await sendForm(path, form, { method, token: nextToken });
      if (retry.ok) return unwrapPayload<T>(retry.data);
      const err = retry.data as { error?: { message?: string }; message?: string } | null;
      const message = err?.error?.message || err?.message || `Error del servidor (${retry.status})`;
      throw new ApiError(humanizeError(message, retry.status, path), retry.status);
    }
  }

  if (!first.ok) {
    const err = first.data as { error?: { message?: string }; message?: string } | null;
    const message = err?.error?.message || err?.message || `Error del servidor (${first.status})`;
    throw new ApiError(humanizeError(message, first.status, path), first.status);
  }

  return unwrapPayload<T>(first.data);
}
