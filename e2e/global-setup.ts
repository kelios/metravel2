import fs from 'node:fs';
import path from 'node:path';
import { chromium, type FullConfig } from '@playwright/test';
import { getTravelsListPath } from './helpers/routes';

const STORAGE_STATE_PATH = 'e2e/.auth/storageState.json';

function ensureEnv(name: string): string | null {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : null;
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

  await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded', timeout: 120_000 });

  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Пароль').fill(password);

  await page.getByText('Войти', { exact: true }).click();

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
