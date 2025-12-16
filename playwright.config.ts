import { defineConfig, devices } from '@playwright/test';

const E2E_WEB_PORT = Number(process.env.E2E_WEB_PORT || '8081');
const baseURL = process.env.BASE_URL || `http://localhost:${E2E_WEB_PORT}`;
const USE_EXISTING_SERVER = process.env.E2E_NO_WEBSERVER === '1';

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  globalSetup: './e2e/global-setup.ts',
  webServer: USE_EXISTING_SERVER
    ? undefined
    : {
        command: `npx expo start --web --port ${E2E_WEB_PORT} --non-interactive`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
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
