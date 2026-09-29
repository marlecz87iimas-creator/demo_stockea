import type { User } from '../types';
import { API_PATHS } from './config';
import { apiRequest } from './client';

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface AuthResult {
  token: string;
  refreshToken: string;
  user: User;
}

export async function registerUser(input: {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}): Promise<AuthResult> {
  await apiRequest(API_PATHS.register, { method: 'POST', body: input });
  return loginUser({ email: input.email, password: input.password });
}

export async function loginUser(input: { email: string; password: string }): Promise<AuthResult> {
  const tokens = await apiRequest<AuthTokens>(API_PATHS.login, {
    method: 'POST',
    body: input,
  });
  const user = await apiRequest<User>(API_PATHS.me, { token: tokens.access_token });
  return {
    token: tokens.access_token,
    refreshToken: tokens.refresh_token,
    user,
  };
}

export async function fetchCurrentUser(token: string): Promise<User> {
  return apiRequest<User>(API_PATHS.me, { token });
}

export async function logoutUser(refreshToken: string): Promise<void> {
  await apiRequest(API_PATHS.logout, {
    method: 'POST',
    body: { refresh_token: refreshToken },
  });
}
