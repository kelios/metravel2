import type { Page } from '@playwright/test';

import { test, expect } from './fixtures';
import { gotoWithRetry, preacceptCookies } from './helpers/navigation';

const WEB_AUTH_COOKIE = 'authToken';
const JS_AUTH_STORAGE_KEYS = [
  'secure_userToken',
  'secure_refreshToken',
  'userToken',
  'refreshToken',
] as const;

function requireCredentials(): { email: string; password: string } {
  const email = String(process.env.E2E_EMAIL || '').trim();
  const password = String(process.env.E2E_PASSWORD || '');
  if (!email || !password) {
    throw new Error('Auth cookie E2E requires E2E_EMAIL and E2E_PASSWORD from .env.e2e');
  }
  return { email, password };
}

async function fillLoginForm(page: Page, email: string, password: string): Promise<void> {
  const emailInput = page
    .locator('input[type="email"]')
    .or(page.locator('input[autocomplete="email"]'))
    .or(page.getByRole('textbox', { name: /^email$/i }))
    .first();
  const passwordInput = page
    .locator('input[type="password"]')
    .or(page.locator('input[autocomplete="current-password"]'))
    .or(page.getByLabel(/пароль|password/i))
    .first();

  await expect(emailInput).toBeVisible({ timeout: 30_000 });
  await expect(passwordInput).toBeVisible({ timeout: 30_000 });
  await emailInput.fill(email);
  await passwordInput.fill(password);
}

async function expectNoJavaScriptAuthTokens(page: Page): Promise<void> {
  const presentKeys = await page.evaluate((keys) => {
    const found: string[] = [];
    for (const key of keys) {
      if (window.localStorage.getItem(key) != null) found.push(`localStorage:${key}`);
      if (window.sessionStorage.getItem(key) != null) found.push(`sessionStorage:${key}`);
    }
    return found;
  }, [...JS_AUTH_STORAGE_KEYS]);

  expect(presentKeys, 'Web auth credentials must never be readable from JavaScript storage').toEqual([]);
}

async function getWebAuthCookie(page: Page) {
  const cookies = await page.context().cookies();
  return cookies.find((cookie) => cookie.name === WEB_AUTH_COOKIE);
}

test.describe('HttpOnly-cookie web auth', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('login -> profile -> reload -> logout keeps credentials out of JS storage', async ({ page }) => {
    test.setTimeout(180_000);
    const { email, password } = requireCredentials();
    const tokenHeaderRequests: string[] = [];

    page.on('request', (request) => {
      const authorization = request.headers().authorization || '';
      if (/^Token\s+/i.test(authorization)) {
        tokenHeaderRequests.push(new URL(request.url()).pathname);
      }
    });

    await preacceptCookies(page);
    await gotoWithRetry(page, '/login');
    await expectNoJavaScriptAuthTokens(page);
    await fillLoginForm(page, email, password);

    const loginResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname.endsWith('/api/user/login/'),
      { timeout: 60_000 },
    );

    await page.getByRole('button', { name: /^Войти$/ }).click();
    const loginResponse = await loginResponsePromise;
    expect(loginResponse.ok(), `Login returned HTTP ${loginResponse.status()}`).toBe(true);

    // Playwright error-context snapshots include current input values. Clear the
    // credential fields before any assertion that could fail and write an artifact.
    await page.evaluate(() => {
      for (const input of document.querySelectorAll<HTMLInputElement>(
        'input[type="email"], input[type="password"]',
      )) {
        input.value = '';
      }
    });
    await gotoWithRetry(page, '/profile');

    const profileMenu = page.getByRole('button', { name: 'Меню профиля' }).first();
    await expect(profileMenu).toBeVisible({ timeout: 60_000 });

    await expect
      .poll(async () => Boolean(await getWebAuthCookie(page)), {
        timeout: 20_000,
        message: `${WEB_AUTH_COOKIE} cookie was not set after successful login`,
      })
      .toBe(true);

    const authCookie = await getWebAuthCookie(page);
    expect(authCookie?.httpOnly).toBe(true);
    expect(authCookie?.secure).toBe(true);
    await expectNoJavaScriptAuthTokens(page);

    await expect(page.getByText('Войдите в аккаунт', { exact: true })).toHaveCount(0);
    await expectNoJavaScriptAuthTokens(page);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(profileMenu).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Войдите в аккаунт', { exact: true })).toHaveCount(0);
    await expectNoJavaScriptAuthTokens(page);

    await profileMenu.click();
    const logoutButton = page.getByRole('button', { name: /^Выйти$/ }).first();
    await expect(logoutButton).toBeVisible({ timeout: 20_000 });

    const logoutResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname.endsWith('/api/user/logout/'),
      { timeout: 60_000 },
    );

    await logoutButton.click();
    const logoutResponse = await logoutResponsePromise;
    expect(logoutResponse.ok(), `Logout returned HTTP ${logoutResponse.status()}`).toBe(true);

    await page.waitForURL((url) => url.pathname.includes('/login'), { timeout: 30_000 });
    await expect(page.getByRole('button', { name: /^Войти$/ })).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(async () => Boolean(await getWebAuthCookie(page)), {
        timeout: 20_000,
        message: `${WEB_AUTH_COOKIE} cookie remained after logout`,
      })
      .toBe(false);
    await expectNoJavaScriptAuthTokens(page);
    expect(tokenHeaderRequests, 'Web requests must not send Authorization: Token').toEqual([]);
  });
});
