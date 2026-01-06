import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';

// Используем отдельный порт для e2e, чтобы не конфликтовать с локальной разработкой.
const E2E_WEB_PORT = Number(process.env.E2E_WEB_PORT || '8085');
const baseURL = process.env.BASE_URL || `http://localhost:${E2E_WEB_PORT}`;
const USE_EXISTING_SERVER = process.env.E2E_NO_WEBSERVER === '1' && !!process.env.BASE_URL;

 const E2E_API_URL = process.env.E2E_API_URL;

export default defineConfig({
  testDir: './e2e',
  timeout: 240_000,
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
