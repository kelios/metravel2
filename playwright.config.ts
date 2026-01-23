import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

function applyEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!key) continue;
    if (process.env[key] == null || String(process.env[key]).length === 0) {
      process.env[key] = value;
    }
  }
}

// Ensure E2E env vars are loaded for global-setup (auth) and test runtime.
// We intentionally support env files that may contain spaces around '='.
const rootDir = process.cwd();
applyEnvFile(path.join(rootDir, '.env.e2e'));
applyEnvFile(path.join(rootDir, '.env.dev'));
applyEnvFile(path.join(rootDir, '.env'));

// Используем отдельный порт для e2e, чтобы не конфликтовать с локальной разработкой.
// NOTE: prefer 127.0.0.1 over localhost to avoid IPv6 (::1) vs IPv4 binding mismatches on some systems.
const E2E_WEB_PORT = Number(process.env.E2E_WEB_PORT || '8085');
const baseURL = process.env.BASE_URL || `http://127.0.0.1:${E2E_WEB_PORT}`;
const USE_EXISTING_SERVER = process.env.E2E_NO_WEBSERVER === '1' && !!process.env.BASE_URL;

 const E2E_API_URL = process.env.E2E_API_URL;

export default defineConfig({
  globalTimeout: 720_000,
  testDir: './e2e',
  timeout: 360_000,
  workers: 1,
  globalSetup: './e2e/global-setup.ts',
  webServer: USE_EXISTING_SERVER
    ? undefined
    : {
        command: 'npm run build:web && node scripts/serve-web-build.js',
        url: baseURL,
        reuseExistingServer: false,
        timeout: 600_000,
        env: {
          ...process.env,
          E2E_WEB_PORT: String(E2E_WEB_PORT),
          E2E_API_PROXY_INSECURE: process.env.E2E_API_PROXY_INSECURE || 'true',
          EXPO_PUBLIC_IS_LOCAL_API: 'false',
          ...(E2E_API_URL
            ? {
                EXPO_PUBLIC_API_URL: E2E_API_URL,
                EXPO_PUBLIC_IS_LOCAL_API: 'false',
              }
            : null),
          NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=8192',
        },
      },
  expect: {
    timeout: 15_000,
  },
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    storageState: 'e2e/.auth/storageState.json',
    navigationTimeout: 120_000,
    actionTimeout: 30_000,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
