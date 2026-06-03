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
import os from 'node:os';
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

const { apiContextFromEnv } = require('@/e2e/helpers/e2eApi') as typeof import('@/e2e/helpers/e2eApi');

const STORAGE_TOKEN = 'storage-state-token-abc';

function writeStorageState(token: string, userId?: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-storage-'));
  const file = path.join(dir, 'storageState.json');
  const localStorage: Array<{ name: string; value: string }> = [
    { name: 'secure_userToken', value: token },
  ];
  if (userId) localStorage.push({ name: 'userId', value: userId });
  const json = { origins: [{ origin: 'http://localhost', localStorage }] };
  fs.writeFileSync(file, JSON.stringify(json), 'utf8');
  return file;
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

  it('(d) returns null when no token source and no credentials are available', async () => {
    process.env.E2E_STORAGE_STATE_PATH = path.join(os.tmpdir(), 'does-not-exist-storage.json');

    const ctx = await apiContextFromEnv();

    expect(ctx).toBeNull();
    expect(mockNewContext).not.toHaveBeenCalled();
  });
});
