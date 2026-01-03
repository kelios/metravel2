import { expect, request } from '@playwright/test';

type LoginResponse = {
  token?: string;
  id?: string | number;
  name?: string;
  email?: string;
  is_superuser?: boolean;
};

export type E2EApiContext = {
  apiBase: string;
  token: string;
};

export function getApiBaseFromEnv(): string {
  const raw = (process.env.E2E_API_URL || process.env.EXPO_PUBLIC_API_URL || '').trim();
  expect(raw, 'E2E_API_URL or EXPO_PUBLIC_API_URL must be set for full-flow e2e').toBeTruthy();
  return raw.replace(/\/+$/, '');
}

export async function apiLogin(email: string, password: string): Promise<E2EApiContext> {
  const apiBase = getApiBaseFromEnv();

  const api = await request.newContext({
    baseURL: apiBase,
    extraHTTPHeaders: { 'Content-Type': 'application/json' },
  });

  const resp = await api.post('/api/user/login/', { data: { email, password } });
  expect(resp.ok(), `API login failed: ${resp.status()} ${resp.statusText()}`).toBeTruthy();

  const json = (await resp.json().catch(() => null)) as LoginResponse | null;
  const token = String(json?.token ?? '').trim();
  expect(token, 'API login did not return token').toBeTruthy();

  await api.dispose();
  return { apiBase, token };
}

export async function apiRequestContext(ctx: E2EApiContext) {
  return request.newContext({
    baseURL: ctx.apiBase,
    extraHTTPHeaders: {
      Authorization: `Token ${ctx.token}`,
      'Content-Type': 'application/json',
    },
  });
}

export async function createOrUpdateTravel(ctx: E2EApiContext, payload: any): Promise<any> {
  const api = await apiRequestContext(ctx);
  const resp = await api.put('/api/travels/upsert/', { data: payload });
  expect(resp.ok(), `Upsert failed: ${resp.status()} ${resp.statusText()}`).toBeTruthy();
  const json = await resp.json().catch(() => null);
  await api.dispose();
  expect(json, 'Upsert returned no JSON').toBeTruthy();
  return json;
}

export async function readTravel(ctx: E2EApiContext, travelId: string | number): Promise<any> {
  const api = await apiRequestContext(ctx);
  const resp = await api.get(`/api/travels/${travelId}/`);
  expect(resp.ok(), `Read failed: ${resp.status()} ${resp.statusText()}`).toBeTruthy();
  const json = await resp.json().catch(() => null);
  await api.dispose();
  expect(json, 'Read returned no JSON').toBeTruthy();
  return json;
}

export async function deleteTravel(ctx: E2EApiContext, travelId: string | number): Promise<void> {
  const api = await apiRequestContext(ctx);
  const resp = await api.delete(`/api/travels/${travelId}/`);
  expect(resp.ok() || resp.status() === 404).toBeTruthy();
  await api.dispose();
}

export async function markAsFavorite(ctx: E2EApiContext, travelId: string | number): Promise<void> {
  const api = await apiRequestContext(ctx);
  const resp = await api.patch(`/api/travels/${travelId}/mark-as-favorite/`);
  expect(resp.ok(), `Mark favorite failed: ${resp.status()} ${resp.statusText()}`).toBeTruthy();
  await api.dispose();
}

export async function unmarkAsFavorite(ctx: E2EApiContext, travelId: string | number): Promise<void> {
  const api = await apiRequestContext(ctx);
  const resp = await api.patch(`/api/travels/${travelId}/unmark-as-favorite/`);
  expect(resp.ok() || resp.status() === 404).toBeTruthy();
  await api.dispose();
}
