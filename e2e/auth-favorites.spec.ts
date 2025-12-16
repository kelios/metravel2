import { test, expect } from '@playwright/test';

test.describe('Auth favorites', () => {
  test('favorites tab does not show auth gate after login', async ({ page }) => {
    const hasCreds = !!process.env.E2E_EMAIL && !!process.env.E2E_PASSWORD;
    if (!hasCreds) {
      test.skip(true, 'E2E_EMAIL/E2E_PASSWORD not provided; skipping authenticated favorites assertions');
    }

    // Pre-accept cookies to avoid overlay affecting interactions.
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

    // Go directly to the favorites route (more stable than relying on tabs UI).
    await page.goto('/favorites', { waitUntil: 'domcontentloaded' });

    // Authenticated run: should not be kicked to /login.
    await expect(page).not.toHaveURL(/\/login/);

    // Auth gate should not appear.
    await expect(page.getByText(/Избранное.*доступно.*(регистрации|авторизации)/i)).toHaveCount(0);

    // Either empty state or actual content should be shown.
    const empty = page.getByText('Избранное пусто', { exact: true });
    const emptyAlt = page.getByText('Добавляй понравившиеся путешествия и сохраняй их здесь');
    const seeAll = page.getByText('Смотреть все', { exact: true });

    const hasEmpty = await empty.isVisible().catch(() => false);
    const hasEmptyAlt = await emptyAlt.isVisible().catch(() => false);
    const hasSeeAll = await seeAll.isVisible().catch(() => false);

    expect(hasEmpty || hasEmptyAlt || hasSeeAll).toBeTruthy();
  });
});
