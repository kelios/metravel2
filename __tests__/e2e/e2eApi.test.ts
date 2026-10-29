/**
 * TD-028: token isolation for the shared e2e account.
 *
 * apiContextFromEnv() must prefer an already-issued session over a fresh login,
 * so that auto-cleanup / API helpers never trigger a backend token rotation that
 * would invalidate the live UI session sharing the same storageState token.
 *
 * Priority contract under test:
 *   (a) E2E_API_TOKEN env override
 *   (b) token from storageState (no login)
 *   (c) memoized login (only when no storageState token)
 *   (d) null
 */
import fs from 'node:fs';
import path from 'node:path';

// Mock @playwright/test so importing the helper does not require a browser, and
// so we can observe whether a network login was attempted.
// Variable is prefixed with `mock` so jest allows it in the hoisted factory.
const mockNewContext = jest.fn();
jest.mock('@playwright/test', () => ({
  request: {
    newContext: (...args: unknown[]) => mockNewContext(...args),
  },
  expect: (value: unknown) => ({
    toBeTruthy: () => {
      if (!value) throw new Error('expected truthy value');
    },
  }),
}));

const { apiContextFromEnv, apiContextFromTracker, installCreatedTravelsTracker } = require('@/e2e/helpers/e2eApi') as typeof import('@/e2e/helpers/e2eApi');

const STORAGE_TOKEN = 'storage-state-token-abc';

const storageDirectories: string[] = [];

function writeState(json: Record<string, unknown>): string {
  const parent = path.join(process.cwd(), '.codex-temp', 'e2e-api-unit');
  fs.mkdirSync(parent, { recursive: true });
  const dir = fs.mkdtempSync(path.join(parent, 'storage-'));
  storageDirectories.push(dir);
  const file = path.join(dir, 'storageState.json');
  fs.writeFileSync(file, JSON.stringify(json), 'utf8');
  return file;
}

function writeStorageState(token: string, userId?: string): string {
  const localStorage: Array<{ name: string; value: string }> = [
    { name: 'secure_userToken', value: token },
  ];
  if (userId) localStorage.push({ name: 'userId', value: userId });
  const json = { origins: [{ origin: 'http://localhost', localStorage }] };
  return writeState(json);
}

function sessionCookie(domain: string, value = 'cookie-session-token') {
  return { name: 'authToken', value, domain, path: '/', httpOnly: true, secure: true, sameSite: 'Lax' };
}

describe('apiContextFromEnv priorities (TD-028)', () => {
  const ENV_KEYS = [
    'E2E_API_TOKEN',
    'E2E_EMAIL',
    'E2E_PASSWORD',
    'E2E_API_URL',
    'EXPO_PUBLIC_API_URL',
    'BASE_URL',
    'E2E_STORAGE_STATE_PATH',
    'E2E_WEB_PORT',
  ];
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = {};
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    mockNewContext.mockReset();
    mockNewContext.mockImplementation(() => {
      throw new Error('login network call must not happen in these scenarios');
    });
    process.env.E2E_API_URL = 'https://api.example.test';
  });

  afterEach(() => {
    for (const directory of storageDirectories.splice(0)) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('(a) returns E2E_API_TOKEN override without touching login or storageState', async () => {
    process.env.E2E_API_TOKEN = 'Token explicit-override-xyz';
    process.env.E2E_EMAIL = 'shared@example.test';
    process.env.E2E_PASSWORD = 'secret';
    process.env.E2E_STORAGE_STATE_PATH = writeStorageState(STORAGE_TOKEN);

    const ctx = await apiContextFromEnv();

    expect(ctx).not.toBeNull();
    expect(ctx?.token).toBe('explicit-override-xyz');
    expect(mockNewContext).not.toHaveBeenCalled();
  });

  it('(b) reuses storageState token and does NOT log in even when email+password are set', async () => {
    process.env.E2E_EMAIL = 'shared@example.test';
    process.env.E2E_PASSWORD = 'secret';
    process.env.E2E_STORAGE_STATE_PATH = writeStorageState(STORAGE_TOKEN);

    const ctx = await apiContextFromEnv();

    expect(ctx).not.toBeNull();
    expect(ctx?.token).toBe(STORAGE_TOKEN);
    expect(ctx?.apiBase).toBe('https://api.example.test');
    // The core TD-028 assertion: no login network call happened.
    expect(mockNewContext).not.toHaveBeenCalled();
  });

  it('(b) recovers userId from storageState so owner-aware specs keep their behavior', async () => {
    process.env.E2E_EMAIL = 'shared@example.test';
    process.env.E2E_PASSWORD = 'secret';
    process.env.E2E_STORAGE_STATE_PATH = writeStorageState(STORAGE_TOKEN, '4242');

    const ctx = await apiContextFromEnv();

    expect(ctx?.token).toBe(STORAGE_TOKEN);
    expect(ctx?.userId).toBe('4242');
    expect(mockNewContext).not.toHaveBeenCalled();
  });

  it.each([
    { baseURL: undefined, port: undefined, origin: 'http://127.0.0.1:8085', domain: '127.0.0.1' },
    { baseURL: undefined, port: '8097', origin: 'http://127.0.0.1:8097', domain: '127.0.0.1' },
    { baseURL: 'http://localhost:8099', port: '8097', origin: 'http://localhost:8099', domain: 'localhost' },
  ])('(b) reuses the HttpOnly web session at $origin without logging in', async ({ baseURL, port, origin, domain }) => {
    process.env.E2E_API_URL = 'http://localhost:8000';
    if (baseURL) process.env.BASE_URL = baseURL;
    if (port) process.env.E2E_WEB_PORT = port;
    process.env.E2E_EMAIL = 'shared@example.test';
    process.env.E2E_PASSWORD = 'secret';
    process.env.E2E_STORAGE_STATE_PATH = writeState({
      cookies: [sessionCookie(domain)],
      origins: [{ origin, localStorage: [{ name: 'userId', value: '4242' }] }],
    });

    await expect(apiContextFromEnv()).resolves.toEqual({
      apiBase: 'http://localhost:8000', token: 'cookie-session-token', userId: '4242',
    });
    expect(apiContextFromTracker({ apiBase: 'http://localhost:8000' })?.token)
      .toBe('cookie-session-token');
    expect(mockNewContext).not.toHaveBeenCalled();
  });

  it('(b) prefers the current HttpOnly session over a legacy localStorage token', async () => {
    process.env.BASE_URL = 'http://127.0.0.1:8085';
    process.env.E2E_STORAGE_STATE_PATH = writeState({
      cookies: [sessionCookie('127.0.0.1')],
      origins: [{
        origin: process.env.BASE_URL,
        localStorage: [{ name: 'secure_userToken', value: 'obsolete-legacy-token' }],
      }],
    });

    expect((await apiContextFromEnv())?.token).toBe('cookie-session-token');
    expect(mockNewContext).not.toHaveBeenCalled();
  });

  it('(a) keeps the explicit env override ahead of the HttpOnly session', async () => {
    process.env.E2E_API_TOKEN = 'Token explicit-override-xyz';
    process.env.E2E_STORAGE_STATE_PATH = writeState({ cookies: [sessionCookie('127.0.0.1')] });

    expect((await apiContextFromEnv())?.token).toBe('explicit-override-xyz');
    expect(mockNewContext).not.toHaveBeenCalled();
  });

  it('(d) never reuses a cookie from an unrelated saved origin', async () => {
    process.env.BASE_URL = 'http://127.0.0.1:8085';
    process.env.E2E_STORAGE_STATE_PATH = writeState({
      cookies: [sessionCookie('unrelated.example.test')],
      origins: [{ origin: 'https://unrelated.example.test', localStorage: [] }],
    });

    await expect(apiContextFromEnv()).resolves.toBeNull();
    expect(apiContextFromTracker({ apiBase: 'http://localhost:8000' })).toBeNull();
    expect(mockNewContext).not.toHaveBeenCalled();
  });

  it('(d) returns null when no token source and no credentials are available', async () => {
    process.env.E2E_STORAGE_STATE_PATH = path.join(process.cwd(), '.codex-temp', 'does-not-exist-storage.json');

    const ctx = await apiContextFromEnv();

    expect(ctx).toBeNull();
    expect(mockNewContext).not.toHaveBeenCalled();
  });
});


describe('created travel tracker cleanup boundary', () => {
  function setupTracker() {
    let onResponse: (response: unknown) => Promise<void> = async () => undefined;
    const page = {
      on: jest.fn((_event: string, handler: typeof onResponse) => { onResponse = handler; }),
      off: jest.fn(),
    };
    const tracker = installCreatedTravelsTracker(page);
    return { tracker, emitResponse: (response: unknown) => onResponse(response), page };
  }

  function upsertResponse({
    serverAddr,
    url = 'http://127.0.0.1:8085/api/travels/upsert/',
    method = 'POST',
    ok = true,
    body = { id: 4242 } as unknown,
  }: {
    serverAddr: { ipAddress: string; port: number } | null;
    url?: string;
    method?: string;
    ok?: boolean;
    body?: unknown;
  }) {
    return {
      url: () => url,
      request: () => ({ method: () => method, headers: () => ({ authorization: 'Token request-session' }) }),
      ok: () => ok,
      serverAddr: jest.fn().mockResolvedValue(serverAddr),
      json: jest.fn().mockResolvedValue(body),
    };
  }

  it('ignores route.fulfill fixture ids and exposes no live cleanup context', async () => {
    const { tracker, emitResponse } = setupTracker();
    const mocked = upsertResponse({ serverAddr: null });

    await emitResponse(mocked);

    expect([...tracker.ids]).toEqual([]);
    expect(tracker.getApiBase()).toBeNull();
    expect(tracker.getToken()).toBeNull();
    expect(mocked.json).not.toHaveBeenCalled();
  });

  it.each([
    { url: 'http://127.0.0.1:8085/api/travels/upsert/', port: 8085, method: 'POST', body: { id: 4242 } },
    { url: 'http://localhost:8000/api/travels/upsert/', port: 8000, method: 'PUT', body: { data: { id: 4242 } } },
  ])('retains cleanup for real $method upserts via $url', async ({ url, port, method, body }) => {
    const { tracker, emitResponse } = setupTracker();
    await emitResponse(upsertResponse({ url, method, body, serverAddr: { ipAddress: '127.0.0.1', port } }));

    expect([...tracker.ids]).toEqual([4242]);
    expect(tracker.getApiBase()).toBe(new URL(url).origin);
    expect(tracker.getToken()).toBe('request-session');
  });

  it('keeps mock fixture ids separate from real records in the same page', async () => {
    const { tracker, emitResponse, page } = setupTracker();
    await emitResponse(upsertResponse({ serverAddr: null, body: { id: 999999 } }));
    await emitResponse(upsertResponse({ serverAddr: { ipAddress: '127.0.0.1', port: 8085 } }));

    expect([...tracker.ids]).toEqual([4242]);
    tracker.dispose();
    expect(page.off).toHaveBeenCalledWith('response', expect.any(Function));
  });

  it.each([
    { method: 'GET', ok: true },
    { method: 'POST', ok: false },
  ])('does not track $method responses with ok=$ok', async ({ method, ok }) => {
    const { tracker, emitResponse } = setupTracker();
    await emitResponse(upsertResponse({ method, ok, serverAddr: { ipAddress: '127.0.0.1', port: 8085 } }));

    expect([...tracker.ids]).toEqual([]);
    expect(tracker.getApiBase()).toBeNull();
  });
});
