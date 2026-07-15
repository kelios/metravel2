import type { Page, Response } from '@playwright/test';

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

async function clearCredentialInputs(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const input of document.querySelectorAll<HTMLInputElement>(
      'input[type="email"], input[type="password"]',
    )) {
      input.value = '';
    }
  });
}

async function loginRespectingRateLimit(
  page: Page,
  email: string,
  password: string,
): Promise<Response> {
  let lastResponse: Response | null = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await fillLoginForm(page, email, password);
    const responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname.endsWith('/api/user/login/'),
      { timeout: 60_000 },
    );

    await page.getByRole('button', { name: /^Войти$/ }).click();
    const response = await responsePromise;
    lastResponse = response;
    await clearCredentialInputs(page);

    if (response.status() !== 429 || attempt === 3) return response;

    const retryAfterSeconds = Number(response.headers()['retry-after']);
    const retryDelayMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? retryAfterSeconds * 1000
      : 30_000 * attempt;
    await page.waitForTimeout(retryDelayMs);
  }

  if (!lastResponse) throw new Error('Login did not produce a response');
  return lastResponse;
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

async function getSafeResponseError(response: Response): Promise<string> {
  try {
    const payload = await response.json() as Record<string, unknown>;
    const detail = payload.detail || payload.error || payload.message;
    return typeof detail === 'string' ? detail : 'no public error detail';
  } catch {
    return 'non-JSON response';
  }
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
    const loginResponse = await loginRespectingRateLimit(page, email, password);
    expect(loginResponse.ok(), `Login returned HTTP ${loginResponse.status()}`).toBe(true);
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
    const logoutButton = page.getByRole('button', { name: /^Выйти из аккаунта$/ }).first();
    await expect(logoutButton).toBeVisible({ timeout: 20_000 });

    const csrfCookie = (await page.context().cookies()).find((cookie) => cookie.name === 'csrftoken');
    expect(csrfCookie, 'Logout requires the backend csrftoken cookie').toBeTruthy();
    const csrfCookieIsReadable = await page.evaluate(() =>
      document.cookie.split(';').some((cookie) => cookie.trim().startsWith('csrftoken=')),
    );
    expect(csrfCookieIsReadable, 'csrftoken must be readable so the SPA can send X-CSRFToken').toBe(true);

    const logoutResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname.endsWith('/api/user/logout/'),
      { timeout: 60_000 },
    );

    await logoutButton.click();
    const logoutResponse = await logoutResponsePromise;
    const logoutRequestHeaders = await logoutResponse.request().allHeaders();
    expect(
      Boolean(logoutRequestHeaders['x-csrftoken']),
      'Logout request must mirror csrftoken in X-CSRFToken',
    ).toBe(true);
    const logoutError = logoutResponse.ok() ? '' : await getSafeResponseError(logoutResponse);
    expect(
      logoutResponse.ok(),
      `Logout returned HTTP ${logoutResponse.status()}: ${logoutError}`,
    ).toBe(true);

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
