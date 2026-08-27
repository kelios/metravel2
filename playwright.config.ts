import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

import { PERF_BUDGET_TEST_MATCH, PERF_DESKTOP_VIEWPORTS } from './e2e/helpers/perfProjects';

const { resolveE2ETargets } = require('./scripts/e2e-target-safety');
const { getE2ESuiteSelection } = require('./scripts/e2e-suite-classification');

function clearColorEnv() {
  if (Object.prototype.hasOwnProperty.call(process.env, 'NO_COLOR')) {
    delete process.env.NO_COLOR;
  }
  if (Object.prototype.hasOwnProperty.call(process.env, 'FORCE_COLOR')) {
    delete process.env.FORCE_COLOR;
  }
}

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
clearColorEnv();

// Используем отдельный порт для e2e, чтобы не конфликтовать с локальной разработкой.
// NOTE: prefer 127.0.0.1 over localhost to avoid IPv6 (::1) vs IPv4 binding mismatches on some systems.
const E2E_WEB_PORT = Number(process.env.E2E_WEB_PORT || '8085');
const baseURL = process.env.BASE_URL || `http://127.0.0.1:${E2E_WEB_PORT}`;
const USE_EXISTING_SERVER = process.env.E2E_NO_WEBSERVER === '1' && !!process.env.BASE_URL;
const webServerEnv = { ...process.env } as Record<string, string | undefined>;

// Regression E2E is fail-closed: an omitted target means the local backend, never production.
// Production checks are a separate, read-only suite with an explicit opt-in.
const resolvedTargets = resolveE2ETargets({ ...process.env, BASE_URL: baseURL });
const E2E_API_URL = resolvedTargets.apiUrl;

// ---------------------------------------------------------------------------
// Test strategy (controlled via E2E_SUITE env var or --grep):
//   smoke      – critical-path tests only (~2 min)
//   perf       – performance / CLS / budget audits
//   regression – full suite (default)
// ---------------------------------------------------------------------------
const E2E_SUITE = (process.env.E2E_SUITE || '').toLowerCase();
const grepForSuite: Record<string, RegExp | undefined> = {
  smoke: /@smoke/,
  perf: /@perf/,
};
const suiteSelection = getE2ESuiteSelection(E2E_SUITE);

const hasPlaywrightCore = (() => {
  try {
    require.resolve('playwright-core');
    return true;
  } catch {
    return false;
  }
})();

const reporter: Array<['list'] | ['html', { open: 'never' }] | ['json', { outputFile: string }]> = process.env.CI
  ? [
      ['list'],
      ...(hasPlaywrightCore ? [['html', { open: 'never' }] as ['html', { open: 'never' }]] : []),
      ['json', { outputFile: 'test-results/e2e-results.json' }],
    ]
  : [
      ['list'],
      ...(hasPlaywrightCore ? [['html', { open: 'never' }] as ['html', { open: 'never' }]] : []),
    ];

export default defineConfig({
  globalTimeout: 3_600_000,
  testDir: './e2e',
  forbidOnly: true,
  fullyParallel: true,
  timeout: 120_000,
  workers: process.env.CI ? 2 : '50%',
  ...(grepForSuite[E2E_SUITE] ? { grep: grepForSuite[E2E_SUITE] } : {}),
  ...suiteSelection,
  globalSetup: './e2e/global-setup.ts',
  webServer: USE_EXISTING_SERVER
    ? undefined
    : {
        command: 'node scripts/e2e-webserver.js',
        url: baseURL,
        // Local runs can leave the dev server running if Playwright is interrupted.
        // Reuse it instead of failing with EADDRINUSE.
        reuseExistingServer: process.env.CI ? false : true,
        timeout: 600_000,
        env: {
          ...webServerEnv,
          E2E_WEB_PORT: String(E2E_WEB_PORT),
          E2E_API_PROXY_INSECURE: process.env.E2E_API_PROXY_INSECURE || 'true',
          E2E_API_PROXY_TARGET: E2E_API_URL,
          EXPO_PUBLIC_E2E: 'true',
          EXPO_PUBLIC_IS_LOCAL_API: 'false',
          EXPO_PUBLIC_API_URL: E2E_API_URL,
          NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=8192',
        },
      },
  expect: {
    timeout: 15_000,
  },
  retries: process.env.CI ? 2 : 1,
  reporter,
  use: {
    baseURL,
    storageState: 'e2e/.auth/storageState.json',
    navigationTimeout: 60_000,
    actionTimeout: 30_000,
    trace: process.env.CI ? 'retain-on-failure' : 'off',
    video: process.env.CI ? 'retain-on-failure' : 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: PERF_DESKTOP_VIEWPORTS.chromium,
      },
    },
    // #1564: 1280 px is an application breakpoint, so the default desktop
    // descriptor observes only the wide side of it. Keep a second real desktop
    // profile inside the narrow band where responsive CLS regressions occur.
    // `testMatch` is load-bearing: without it every default E2E command would
    // execute the complete suite once more under this project.
    {
      name: 'chromium-narrow',
      testMatch: [...PERF_BUDGET_TEST_MATCH],
      use: {
        ...devices['Desktop Chrome'],
        viewport: PERF_DESKTOP_VIEWPORTS['chromium-narrow'],
      },
    },
    // #1287: мобильный профиль — это device descriptor (touch, coarse pointer,
    // DPR>1, мобильный UA), а не `setViewportSize` на desktop-браузере. Узкий
    // бокс с desktop-характеристиками мерит не ту страницу: DPR выбирает другие
    // ступени `?w=` у картинок, а часть верстки ветвится по pointer/touch.
    //
    // `testMatch` обязателен: без него проект подхватил бы ВЕСЬ каталог `e2e/`
    // и команды без `--project` (`npm run e2e`, `check:e2e:changed`,
    // `e2e:production-smoke`) прогоняли бы весь набор дважды, гоняя
    // desktop-спеки под Pixel 7.
    {
      name: 'chromium-mobile',
      testMatch: [...PERF_BUDGET_TEST_MATCH],
      use: {
        ...devices['Pixel 7'],
        browserName: 'chromium',
      },
    },
  ],
});
