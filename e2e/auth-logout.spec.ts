import { test, expect } from './fixtures';

function hasCreds(): boolean {
  return !!process.env.E2E_EMAIL && !!process.env.E2E_PASSWORD;
}

test.describe('Auth logout', () => {
  test('logout from profile', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem(
          'metravel_consent_v1',
          JSON.stringify({ necessary: true, analytics: false, date: new Date().toISOString() })
        );
      } catch {
        // ignore
      }
    });

    await page.goto('/profile', { waitUntil: 'domcontentloaded' });

    if (!hasCreds()) {
      await expect(page.getByText('Войдите в аккаунт')).toBeVisible();
      return;
    }

    // Profile page should show logout button when authenticated.
    await page.getByLabel('Выйти из аккаунта').click({ timeout: 20_000 });

    // Profile screen logs out and redirects to /login
    await page.waitForURL((url) => url.pathname.includes('/login'), { timeout: 30_000 });

    // Login screen UI currently uses "Войти" button and input labels, not a "Вход" heading.
    await expect(page.getByRole('button', { name: 'Войти' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible({ timeout: 15_000 });
  });
});
