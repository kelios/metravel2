import fs from 'node:fs';
import path from 'node:path';
import { chromium, request, type FullConfig } from '@playwright/test';
import { getTravelsListPath } from './helpers/routes';

const { resolveE2EAuthMode } = require('../scripts/e2e-target-safety');

const STORAGE_STATE_PATH = 'e2e/.auth/storageState.json';
const STORAGE_STATE_B_PATH = 'e2e/.auth/storageState.b.json';

function ensureEnv(name: string): string | null {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : null;
}

function readStorageStateValue(filePath: string, originUrl: string, key: string): string {
  try {
    if (!fs.existsSync(filePath)) return '';
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8')) as any;
    const origins: any[] = Array.isArray(json?.origins) ? json.origins : [];
    const expectedOrigin = new URL(originUrl).origin;
    for (const origin of origins) {
      if (origin?.origin !== expectedOrigin) continue;
      const ls: any[] = Array.isArray(origin?.localStorage) ? origin.localStorage : [];
      const entry = ls.find((item) => item?.name === key);
      const value = String(entry?.value ?? '').trim();
      if (value) return value;
    }
  } catch {
    // ignore
  }
  return '';
}

async function storageStateHasValidSession(filePath: string, baseURL: string): Promise<boolean> {
  if (!fs.existsSync(filePath)) return false;
  const userId = readStorageStateValue(filePath, baseURL, 'userId');
  if (!userId) return false;

  const api = await request.newContext({
    baseURL,
    storageState: filePath,
  });
  try {
    const resp = await api.get('/api/user/me/verifications/');
    return resp.ok();
  } catch {
    return false;
  } finally {
    await api.dispose();
  }
}

async function waitForBaseURL(baseURL: string, timeoutMs: number) {
  const startedAt = Date.now();
  let lastErr: any = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 4000).unref();
      try {
        const resp = await fetch(baseURL, { method: 'GET', signal: controller.signal } as any);
        if (resp) return;
      } finally {
        clearTimeout(t);
      }
    } catch (e: any) {
      lastErr = e;
    }

    await new Promise((r) => setTimeout(r, 750));
  }

  const msg = lastErr?.message ? String(lastErr.message) : String(lastErr || 'unknown error');
  throw new Error(`[global-setup] Timed out waiting for baseURL to be reachable: ${baseURL}. Last error: ${msg}`);
}

async function maybeAcceptCookies(page: any) {
  const acceptAll = page.getByText('Принять всё', { exact: true });
  const necessaryOnly = page.getByText('Только необходимые', { exact: true });
  const bannerTitle = page.getByTestId('consent-banner');

  await Promise.race([
    bannerTitle.waitFor({ state: 'visible', timeout: 1500 }).catch(() => null),
    acceptAll.waitFor({ state: 'visible', timeout: 1500 }).catch(() => null),
    necessaryOnly.waitFor({ state: 'visible', timeout: 1500 }).catch(() => null),
  ]);

  if (await acceptAll.isVisible().catch(() => false)) {
    await acceptAll.click({ force: true });
  } else if (await necessaryOnly.isVisible().catch(() => false)) {
    await necessaryOnly.click({ force: true });
  }

  if (await bannerTitle.isVisible().catch(() => false)) {
    await bannerTitle.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => null);
  }
}

async function fillLoginForm(page: any, email: string, password: string) {
  await maybeAcceptCookies(page);

  // Иногда RN-web/Expo рендерит доступные атрибуты нестабильно, поэтому пробуем несколько вариантов.
  const emailCandidates = [
    page.locator('input[type="email"]'),
    page.locator('input[name*="email" i]'),
    page.locator('input[autocomplete="email"]'),
    page.locator('input[placeholder="Email"]'),
    page.getByPlaceholder('Email'),
    page.getByLabel('Email'),
    page.getByRole('textbox', { name: /^email$/i }),
  ];

  const passwordCandidates = [
    page.locator('input[type="password"]'),
    page.locator('input[name*="pass" i]'),
    page.locator('input[autocomplete="current-password"]'),
    page.locator('input[placeholder="Пароль"]'),
    page.locator('input[placeholder="Password"]'),
    page.getByPlaceholder('Пароль'),
    page.getByPlaceholder('Password'),
    page.getByLabel(/пароль|password/i),
  ];

  const pickVisible = async (candidates: any[], timeoutMs: number) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      for (const c of candidates) {
        const loc = c.first();
        if (await loc.isVisible().catch(() => false)) return loc;
      }
      await page.waitForTimeout(250);
    }
    // last attempt: wait for any of them
    await Promise.race(candidates.map((c) => c.first().waitFor({ state: 'visible', timeout: 1000 }).catch(() => null)));
    for (const c of candidates) {
      const loc = c.first();
      if (await loc.isVisible().catch(() => false)) return loc;
    }
    return null;
  };

  const emailBox = await pickVisible(emailCandidates, 30_000);
  if (!emailBox) return false;
  await emailBox.fill(email);

  const passwordBox = await pickVisible(passwordCandidates, 30_000);
  if (!passwordBox) return false;
  await passwordBox.fill(password);

  return true;
}

/**
 * Logs one account in through the local web proxy and stores the HttpOnly
 * session cookie plus non-secret display metadata in Playwright storageState.
 */
async function writeStorageStateForAccount(opts: {
  email: string;
  password: string;
  baseURL: string;
  outputPath: string;
}): Promise<void> {
  const { email, password, baseURL, outputPath } = opts;

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const done = async () => {
    await context.storageState({ path: outputPath });
    await browser.close();
  };

  try {
    await page.goto(`${baseURL}${getTravelsListPath()}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  } catch {
    await done();
    return;
  }

  // BrowserContext.request shares its cookie jar with pages. Logging in through
  // the local proxy therefore preserves the backend Set-Cookie as HttpOnly web
  // session state without exposing the returned token to JavaScript storage.
  try {
    let response: Awaited<ReturnType<typeof context.request.post>> | null = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      response = await context.request.post(`${baseURL}/api/user/login/`, {
        data: { email, password },
      });
      if (response.ok() || response.status() !== 429 || attempt === 3) break;
      await new Promise((resolve) => setTimeout(resolve, 30_000 * attempt));
    }

    if (response?.ok()) {
      const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      const userId = json?.id != null ? String(json.id) : '';
      const userName = String(json?.name ?? json?.email ?? '').trim();
      const isSuperuser = json?.is_superuser ? 'true' : 'false';

      if (userId) {
        await page.evaluate(
          (metadata: { userId: string; userName: string; isSuperuser: string }) => {
            window.localStorage.removeItem('secure_userToken');
            window.localStorage.removeItem('secure_refreshToken');
            window.localStorage.setItem('userId', metadata.userId);
            window.localStorage.setItem('userName', metadata.userName);
            window.localStorage.setItem('isSuperuser', metadata.isSuperuser);
          },
          { userId, userName, isSuperuser },
        );
        const probe = await context.request.get(`${baseURL}/api/user/me/verifications/`);
        if (probe.ok()) {
          await done();
          return;
        }
      }
    }
  } catch {
    // Fall back to the UI login below.
  }

  // UI login fallback.
  await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle', timeout: 120_000 }).catch(() => null);
  try {
    await page.waitForURL((url: any) => url.pathname.includes('/login'), { timeout: 30_000 });
  } catch {
    // keep going
  }

  const didFill = await fillLoginForm(page, email, password);
  if (didFill) {
    await page.getByText('Войти', { exact: true }).click({ timeout: 30_000 }).catch(() => null);
    try {
      await Promise.race([
        page.waitForURL((url: any) => !url.pathname.includes('/login'), { timeout: 60_000 }).catch(() => null),
        page
          .waitForFunction(() => {
            try {
              const userId = window.localStorage?.getItem('userId');
              return typeof userId === 'string' && userId.length > 0;
            } catch {
              return false;
            }
          }, { timeout: 60_000 })
          .catch(() => null),
      ]);
    } catch {
      // keep going
    }
  }

  await done();
}

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL as string | undefined;
  const authMode = resolveE2EAuthMode(process.env);
  const email = ensureEnv('E2E_EMAIL');
  const password = ensureEnv('E2E_PASSWORD');

  fs.mkdirSync(path.dirname(STORAGE_STATE_PATH), { recursive: true });

  if (!baseURL) {
    throw new Error('Playwright baseURL is required for E2E global setup.');
  }

  // `webServer` can be started in parallel with `globalSetup`. Avoid flaky connection refused errors.
  await waitForBaseURL(baseURL, 600_000);

  if (authMode === 'guest') {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    await context.storageState({ path: STORAGE_STATE_PATH });
    await context.storageState({ path: STORAGE_STATE_B_PATH });
    await browser.close();
    return;
  }

  if (!email || !password) {
    throw new Error('E2E_AUTH_MODE=required needs E2E_EMAIL and E2E_PASSWORD.');
  }

  // Account A (primary E2E account, owner).
  if (await storageStateHasValidSession(STORAGE_STATE_PATH, baseURL)) {
    // Reuse the cookie session issued by a previous shard. Avoid hammering /api/user/login/
    // across the 16-shard local e2e runner and tripping backend rate limits.
  } else {
    await writeStorageStateForAccount({
      email,
      password,
      baseURL,
      outputPath: STORAGE_STATE_PATH,
    });
  }

  // Account B (E2E_EMAIL2) for two-account flows (public-trips applicant etc.).
  // Gracefully skip if creds not set; specs that need B check for the file at runtime.
  const emailB = ensureEnv('E2E_EMAIL2');
  const passwordB = ensureEnv('E2E_PASSWORD2');
  if (await storageStateHasValidSession(STORAGE_STATE_B_PATH, baseURL)) {
    // Reuse existing applicant state across shards.
  } else if (emailB && passwordB) {
    await writeStorageStateForAccount({
      email: emailB,
      password: passwordB,
      baseURL,
      outputPath: STORAGE_STATE_B_PATH,
    });
  }
}
