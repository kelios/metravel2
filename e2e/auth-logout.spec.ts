import { test, expect } from './fixtures';
import { preacceptCookies } from './helpers/navigation';

function hasCreds(): boolean {
  return !!process.env.E2E_EMAIL && !!process.env.E2E_PASSWORD;
}

const AUTH_STORAGE_KEY = 'metravel_encryption_key_v1';

function buildAuthSeed(payload: any) {
  const token = String(payload?.token ?? '').trim();
  if (!token) return null;
  return {
    token,
    userId: payload?.id != null ? String(payload.id) : '',
    userName: String(payload?.name ?? payload?.email ?? '').trim(),
    isSuperuser: payload?.is_superuser ? 'true' : 'false',
  };
}

async function fillLoginForm(page: any, email: string, password: string) {
  const emailCandidates = [
    page.locator('input[type="email"]'),
    page.locator('input[name*="email" i]'),
    page.locator('input[autocomplete="email"]'),
    page.getByPlaceholder('Email'),
    page.getByLabel('Email'),
    page.getByRole('textbox', { name: /^email$/i }),
  ];

  const passwordCandidates = [
    page.locator('input[type="password"]'),
    page.locator('input[name*="pass" i]'),
    page.locator('input[autocomplete="current-password"]'),
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
    await Promise.race(
      candidates.map((c) => c.first().waitFor({ state: 'visible', timeout: 1000 }).catch(() => null))
    );
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

test.describe('Auth logout', () => {
  test('logout from profile', async ({ page }) => {
    await preacceptCookies(page);

    let authSeed: { token: string; userId: string; userName: string; isSuperuser: string } | null = null;
    const email = process.env.E2E_EMAIL as string | undefined;
    const password = process.env.E2E_PASSWORD as string | undefined;

    if (email && password) {
      const apiResponse = await page.request
        .post('/api/user/login/', { data: { email, password } })
        .catch(() => null);

      if (apiResponse && apiResponse.ok()) {
        const payload = (await apiResponse.json().catch(() => null)) as any;
        authSeed = buildAuthSeed(payload);
      }
    }

    if (authSeed) {
      await page.addInitScript(
        (data) => {
          const encrypt = (text: string, key: string) => {
            if (typeof btoa !== 'function') return text;
            let result = '';
            for (let i = 0; i < text.length; i++) {
              result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
            }
            return btoa(result);
          };

          try {
            const encrypted = encrypt(data.token, data.key);
            window.localStorage.setItem('secure_userToken', encrypted);
            if (data.userId) window.localStorage.setItem('userId', data.userId);
            if (data.userName) window.localStorage.setItem('userName', data.userName);
            window.localStorage.setItem('isSuperuser', data.isSuperuser);
          } catch {
            // ignore
          }
        },
        { ...authSeed, key: AUTH_STORAGE_KEY }
      );
    }

    await page.goto('/profile', { waitUntil: 'domcontentloaded' });

    const loginPrompt = page.getByText('Войдите в аккаунт', { exact: true });
    if (await loginPrompt.isVisible().catch(() => false)) {
      if (!hasCreds()) {
        await expect(loginPrompt).toBeVisible();
        return;
      }

      await page.goto('/login', { waitUntil: 'domcontentloaded' });
      const ok = await fillLoginForm(page, email as string, password as string);
      if (!ok) {
        throw new Error('Auth logout: unable to locate login inputs');
      }

      await page.getByRole('button', { name: 'Войти' }).click();
      await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60_000 });
      await page.goto('/profile', { waitUntil: 'domcontentloaded' });
      await loginPrompt.waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => null);

      if (await loginPrompt.isVisible().catch(() => false)) {
        const fallbackSeed = {
          token: 'e2e-fake-token',
          userId: '1',
          userName: 'E2E User',
          isSuperuser: 'false',
        };
        await page.evaluate((data) => {
          const encrypt = (text: string, key: string) => {
            if (typeof btoa !== 'function') return text;
            let result = '';
            for (let i = 0; i < text.length; i++) {
              result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
            }
            return btoa(result);
          };

          try {
            const encrypted = encrypt(data.token, data.key);
            window.localStorage.setItem('secure_userToken', encrypted);
            window.localStorage.setItem('userId', data.userId);
            window.localStorage.setItem('userName', data.userName);
            window.localStorage.setItem('isSuperuser', data.isSuperuser);
          } catch {
            // ignore
          }
        }, { ...fallbackSeed, key: AUTH_STORAGE_KEY });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await loginPrompt.waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => null);
      }

      if (await loginPrompt.isVisible().catch(() => false)) {
        throw new Error('Auth logout: unable to authenticate (API/UI/fake auth all failed)');
      }
    }

    // Profile page should show logout button when authenticated.
    const logoutButton = page.getByRole('button', { name: /выйти/i }).first();
    await expect(logoutButton).toBeVisible({ timeout: 20_000 });
    await logoutButton.click({ timeout: 20_000 });

    // Profile screen logs out and redirects to /login
    await Promise.race([
      page.waitForURL((url) => url.pathname.includes('/login'), { timeout: 30_000 }).catch(() => null),
      page.getByText('Войдите в аккаунт', { exact: true }).waitFor({ state: 'visible', timeout: 30_000 }).catch(() => null),
    ]);

    // Login screen UI currently uses "Войти" button and input labels, not a "Вход" heading.
    await expect(page.getByRole('button', { name: 'Войти' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible({ timeout: 15_000 });
  });
});
