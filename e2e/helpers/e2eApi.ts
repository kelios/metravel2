import { expect, request } from '@playwright/test';
import fs from 'node:fs';

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

function simpleDecrypt(base64: string, key: string): string {
  const raw = Buffer.from(String(base64 || ''), 'base64').toString('binary');
  let result = '';
  for (let i = 0; i < raw.length; i++) {
    result += String.fromCharCode(raw.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

function tokenFromStorageState(): string {
  try {
    const raw = fs.readFileSync('e2e/.auth/storageState.json', 'utf8');
    const json = JSON.parse(raw) as any;
    const origins = Array.isArray(json?.origins) ? json.origins : [];
    for (const origin of origins) {
      const ls = Array.isArray(origin?.localStorage) ? origin.localStorage : [];
      const tokenEntry = ls.find((x: any) => x?.name === 'secure_userToken');
      const encrypted = String(tokenEntry?.value ?? '').trim();
      if (!encrypted) continue;
      const token = simpleDecrypt(encrypted, 'metravel_encryption_key_v1').trim();
      if (token) return normalizeToken(token);
    }
  } catch {
    // ignore
  }
  return '';
}

function normalizeToken(raw: string): string {
  const v = String(raw || '').trim();
  if (!v) return '';
  return v.toLowerCase().startsWith('token ') ? v.slice('token '.length).trim() : v;
}

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

export async function apiContextFromEnv(): Promise<E2EApiContext | null> {
  const apiBaseRaw = (process.env.E2E_API_URL || process.env.EXPO_PUBLIC_API_URL || '').trim();
  if (!apiBaseRaw) return null;

  const tokenFromEnv = normalizeToken(process.env.E2E_API_TOKEN || '');
  if (tokenFromEnv) {
    return { apiBase: apiBaseRaw.replace(/\/+$/, ''), token: tokenFromEnv };
  }

  const email = String(process.env.E2E_EMAIL || '').trim();
  const password = String(process.env.E2E_PASSWORD || '').trim();
  if (email && password) {
    return apiLogin(email, password);
  }

  return null;
}

export function apiContextFromTracker(opts: { apiBase?: string | null } = {}): E2EApiContext | null {
  const apiBase = String(opts.apiBase ?? '').trim().replace(/\/+$/, '');
  if (!apiBase) return null;
  const token = tokenFromStorageState();
  if (!token) return null;
  return { apiBase, token };
}

export function installCreatedTravelsTracker(page: any) {
  const ids = new Set<string | number>();
  let apiBase: string | null = null;

  const handler = async (resp: any) => {
    try {
      const url = String(resp?.url?.() ?? '');
      if (!url.includes('/travels/upsert/')) return;

      if (!apiBase) {
        try {
          apiBase = new URL(url).origin;
        } catch {
          // ignore
        }
      }

      const req = resp.request?.();
      const method = String(req?.method?.() ?? '').toUpperCase();
      if (method !== 'PUT' && method !== 'POST') return;
      if (!resp.ok?.()) return;

      const json = await resp.json().catch(() => null);
      const id = json?.id ?? json?.data?.id;
      if (id != null && id !== '') ids.add(id);
    } catch {
      // ignore
    }
  };

  page.on('response', handler);

  return {
    ids,
    getApiBase: () => apiBase,
    dispose: () => {
      try {
        page.off('response', handler);
      } catch {
        // ignore
      }
    },
  };
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
