import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:8081';

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  globalSetup: './e2e/global-setup.ts',
  webServer: {
    command: 'npm run web -- --port 8081',
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
