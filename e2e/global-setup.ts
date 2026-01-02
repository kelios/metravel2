import fs from 'node:fs';
import path from 'node:path';
import { chromium, type FullConfig } from '@playwright/test';
import { getTravelsListPath } from './helpers/routes';

const STORAGE_STATE_PATH = 'e2e/.auth/storageState.json';

function ensureEnv(name: string): string | null {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : null;
}

async function maybeAcceptCookies(page: any) {
  const acceptAll = page.getByText('Принять всё', { exact: true });
  const necessaryOnly = page.getByText('Только необходимые', { exact: true });
  const bannerTitle = page.getByText('Мы ценим вашу приватность', { exact: true });

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

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL as string | undefined;
  const email = ensureEnv('E2E_EMAIL');
  const password = ensureEnv('E2E_PASSWORD');

  fs.mkdirSync(path.dirname(STORAGE_STATE_PATH), { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  if (!baseURL) {
    await context.storageState({ path: STORAGE_STATE_PATH });
    await browser.close();
    return;
  }

  // Always visit the app once so we have a deterministic storage state file.
  try {
    await page.goto(`${baseURL}${getTravelsListPath()}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  } catch {
    await context.storageState({ path: STORAGE_STATE_PATH });
    await browser.close();
    return;
  }

  // If creds are not provided, keep anonymous state.
  if (!email || !password) {
    await context.storageState({ path: STORAGE_STATE_PATH });
    await browser.close();
    return;
  }

  await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle', timeout: 120_000 });
  try {
    await page.waitForURL((url) => url.pathname.includes('/login'), { timeout: 30_000 });
  } catch {
    // keep going; could be redirected but still have login form on a different path
  }

  const didFill = await fillLoginForm(page, email, password);
  if (!didFill) {
    await context.storageState({ path: STORAGE_STATE_PATH });
    await browser.close();
    return;
  }

  await page.getByText('Войти', { exact: true }).click({ timeout: 30_000 }).catch(() => null);

  // After successful login app should redirect away from /login.
  // IMPORTANT: логин/редирект может быть нестабильным (сеть/креды/сервер). Global setup
  // не должен валить e2e полностью — в худшем случае продолжим с анонимным storageState.
  try {
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60_000 });
  } catch {
    // keep going; we'll just persist whatever state we have
  }

  await context.storageState({ path: STORAGE_STATE_PATH });
  await browser.close();
}
