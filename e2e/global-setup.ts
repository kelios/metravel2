import fs from 'node:fs';
import path from 'node:path';
import { chromium, request, type FullConfig } from '@playwright/test';
import { getTravelsListPath } from './helpers/routes';

const STORAGE_STATE_PATH = 'e2e/.auth/storageState.json';
const STORAGE_STATE_B_PATH = 'e2e/.auth/storageState.b.json';

function simpleEncrypt(text: string, key: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return `enc1:${Buffer.from(result, 'binary').toString('base64')}`;
}

function ensureEnv(name: string): string | null {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : null;
}

function storageStateHasToken(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) return false;
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8')) as any;
    const origins: any[] = Array.isArray(json?.origins) ? json.origins : [];
    return origins.some((origin) => {
      const ls: any[] = Array.isArray(origin?.localStorage) ? origin.localStorage : [];
      return ls.some((entry) => entry?.name === 'secure_userToken' && String(entry?.value ?? '').trim().length > 0);
    });
  } catch {
    return false;
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

function installFakeAuth(context: any) {
  const encrypted = simpleEncrypt('e2e-fake-token', 'metravel_encryption_key_v1');
  context.addInitScript((value: string) => {
    try {
      window.localStorage.setItem('secure_userToken', value);
    } catch {
      // ignore
    }
  }, encrypted);

  context.addInitScript(() => {
    try {
      window.localStorage.setItem('userId', '1');
      window.localStorage.setItem('userName', 'E2E User');
      window.localStorage.setItem('isSuperuser', 'false');
    } catch {
      // ignore
    }
  });
}

/**
 * Логинит один аккаунт через API (или UI-fallback) и пишет storageState.
 * Возвращает true если запись удалась с реальным токеном, false — анонимно.
 */
async function writeStorageStateForAccount(opts: {
  apiBase: string | null;
  email: string;
  password: string;
  baseURL: string;
  outputPath: string;
}): Promise<void> {
  const { apiBase, email, password, baseURL, outputPath } = opts;

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

  // Try API login first.
  if (apiBase) {
    try {
      const api = await request.newContext({
        baseURL: apiBase,
        extraHTTPHeaders: { 'Content-Type': 'application/json' },
      });
      let resp: any = null;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        resp = await api.post('/api/user/login/', { data: { email, password } });
        if (resp.ok() || resp.status() !== 429 || attempt === 3) break;
        await new Promise((resolve) => setTimeout(resolve, 30_000 * attempt));
      }
      if (resp.ok()) {
        const json = (await resp.json().catch(() => null)) as any;
        const token = String(json?.token ?? '').trim();
        const userId = json?.id != null ? String(json.id) : '';
        const userName = String(json?.name ?? json?.email ?? '').trim();
        const isSuperuser = json?.is_superuser ? 'true' : 'false';
        if (token) {
          const encrypted = simpleEncrypt(token, 'metravel_encryption_key_v1');
          await context.addInitScript((value: string) => {
            try {
              window.localStorage.setItem('secure_userToken', value);
            } catch {
              // ignore
            }
          }, encrypted);
          await context.addInitScript(
            (payload: { userId: string; userName: string; isSuperuser: string }) => {
              try {
                if (payload.userId) window.localStorage.setItem('userId', payload.userId);
                if (payload.userName) window.localStorage.setItem('userName', payload.userName);
                window.localStorage.setItem('isSuperuser', payload.isSuperuser);
              } catch {
                // ignore
              }
            },
            { userId, userName, isSuperuser }
          );
          await api.dispose();
          await page.goto(`${baseURL}${getTravelsListPath()}`, { waitUntil: 'domcontentloaded', timeout: 120_000 }).catch(() => null);
          await done();
          return;
        }
      }
      await api.dispose();
    } catch {
      // fall back to UI login
    }
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
              const v = window.localStorage?.getItem('secure_userToken');
              return typeof v === 'string' && v.length > 0;
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
  const email = ensureEnv('E2E_EMAIL');
  const password = ensureEnv('E2E_PASSWORD');

  const apiBaseRaw = ensureEnv('E2E_API_URL') || ensureEnv('EXPO_PUBLIC_API_URL');
  const apiBase = apiBaseRaw ? apiBaseRaw.replace(/\/+$/, '') : null;

  fs.mkdirSync(path.dirname(STORAGE_STATE_PATH), { recursive: true });

  if (!baseURL) {
    // No baseURL — write empty state and bail.
    const browser = await chromium.launch();
    const context = await browser.newContext();
    await context.storageState({ path: STORAGE_STATE_PATH });
    await browser.close();
    return;
  }

  // `webServer` can be started in parallel with `globalSetup`. Avoid flaky connection refused errors.
  try {
    await waitForBaseURL(baseURL, 600_000);
  } catch {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    await context.storageState({ path: STORAGE_STATE_PATH });
    await browser.close();
    return;
  }

  // Account A (primary E2E account, owner).
  if (storageStateHasToken(STORAGE_STATE_PATH)) {
    // Reuse the token issued by a previous shard. Avoid hammering /api/user/login/
    // across the 16-shard local e2e runner and tripping backend rate limits.
  } else if (!email || !password) {
    // No creds → write fake-auth state.
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto(`${baseURL}${getTravelsListPath()}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    } catch {
      // ignore
    }
    installFakeAuth(context);
    await context.storageState({ path: STORAGE_STATE_PATH });
    await browser.close();
  } else {
    await writeStorageStateForAccount({
      apiBase,
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
  if (storageStateHasToken(STORAGE_STATE_B_PATH)) {
    // Reuse existing applicant state across shards.
  } else if (emailB && passwordB && apiBase) {
    try {
      await writeStorageStateForAccount({
        apiBase,
        email: emailB,
        password: passwordB,
        baseURL,
        outputPath: STORAGE_STATE_B_PATH,
      });
    } catch {
      // Non-fatal: B-state missing → two-account specs will skip themselves.
    }
  }
}
