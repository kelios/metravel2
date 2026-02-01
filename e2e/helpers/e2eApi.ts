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

export function apiContextFromTracker(opts: { apiBase?: string | null; token?: string | null } = {}): E2EApiContext | null {
  const apiBase = String(opts.apiBase ?? '').trim().replace(/\/+$/, '');
  if (!apiBase) return null;
  const token = normalizeToken(opts.token || '') || tokenFromStorageState();
  if (!token) return null;
  return { apiBase, token };
}

export function installCreatedTravelsTracker(page: any) {
  const ids = new Set<string | number>();
  let apiBase: string | null = null;
  let token: string | null = null;

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
      if (!token) {
        const headers = (req?.headers?.() ?? {}) as Record<string, string>;
        const auth = headers.authorization || headers.Authorization || '';
        const normalized = normalizeToken(auth);
        if (normalized) token = normalized;
      }

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
    getToken: () => token,
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

export async function createUserPoint(ctx: E2EApiContext, payload: any): Promise<any> {
  const api = await apiRequestContext(ctx);
  const resp = await api.post('/api/user-points/', { data: payload });
  if (!resp.ok()) {
    const details = await resp
      .json()
      .catch(async () => {
        const t = await resp.text().catch(() => '');
        return t ? { raw: t } : null;
      })
      .catch(() => null);
    await api.dispose();
    expect(
      resp.ok(),
      `Create user point failed: ${resp.status()} ${resp.statusText()}\nPayload: ${JSON.stringify(payload)}\nResponse: ${JSON.stringify(details)}`
    ).toBeTruthy();
  }
  const json = await resp.json().catch(() => null);
  await api.dispose();
  expect(json, 'Create user point returned no JSON').toBeTruthy();
  return json;
}

export async function deleteUserPoint(ctx: E2EApiContext, pointId: string | number): Promise<void> {
  const api = await apiRequestContext(ctx);
  const resp = await api.delete(`/api/user-points/${pointId}/`);
  expect(resp.ok() || resp.status() === 404).toBeTruthy();
  await api.dispose();
}

export async function listUserPoints(ctx: E2EApiContext): Promise<any[]> {
  const api = await apiRequestContext(ctx);
  const resp = await api.get('/api/user-points/');
  expect(resp.ok(), `List user points failed: ${resp.status()} ${resp.statusText()}`).toBeTruthy();
  const json = await resp.json().catch(() => null);
  await api.dispose();
  if (Array.isArray(json)) return json;
  if (Array.isArray((json as any)?.results)) return (json as any).results;
  if (Array.isArray((json as any)?.data)) return (json as any).data;
  return [];
}

export async function loginAsUser(page: any): Promise<void> {
  const email = process.env.E2E_EMAIL || '';
  const password = process.env.E2E_PASSWORD || '';
  
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
}

export async function loginAsAdmin(page: any): Promise<void> {
  const email = process.env.E2E_ADMIN_EMAIL || process.env.E2E_EMAIL || '';
  const password = process.env.E2E_ADMIN_PASSWORD || process.env.E2E_PASSWORD || '';
  
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
}

export async function createTestTravel(): Promise<any> {
  const ctx = await apiContextFromEnv();
  if (!ctx) {
    throw new Error('Cannot create test travel: API context not available');
  }

  // Keep payload in sync with the backend expectations for /api/travels/upsert/.
  // See e2e/travel-crud.spec.ts for the minimal shape that the API accepts.
  const payload = {
    id: null,
    name: `Test Travel ${Date.now()}`,
    description: 'Test travel for e2e tests',
    countries: [],
    cities: [],
    over_nights_stay: [],
    complexity: [],
    companions: [],
    recommendation: null,
    plus: null,
    minus: null,
    youtube_link: null,
    gallery: [],
    categories: [],
    countryIds: [],
    travelAddressIds: [],
    travelAddressCity: [],
    travelAddressCountry: [],
    travelAddressAdress: [],
    travelAddressCategory: [],
    coordsMeTravel: [],
    thumbs200ForCollectionArr: [],
    travelImageThumbUrlArr: [],
    travelImageAddress: [],
    categoriesIds: [],
    transports: [],
    month: [],
    year: String(new Date().getFullYear()),
    budget: '',
    number_peoples: '2',
    number_days: '3',
    visa: false,
    publish: false,
    moderation: false,
  };

  return createOrUpdateTravel(ctx, payload);
}

export async function cleanupTestData(options: { travelId?: number; pointIds?: (string | number)[] } = {}): Promise<void> {
  const ctx = await apiContextFromEnv();
  if (!ctx) {
    return;
  }
  
  if (options.travelId) {
    await deleteTravel(ctx, options.travelId).catch(() => {});
  }
  
  if (options.pointIds && options.pointIds.length > 0) {
    for (const pointId of options.pointIds) {
      await deleteUserPoint(ctx, pointId).catch(() => {});
    }
  }
}
