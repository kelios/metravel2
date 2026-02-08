import { test, expect } from './fixtures';
import { preacceptCookies } from './helpers/navigation';

test.describe('Auth favorites', () => {
  test('favorites tab does not show auth gate after login', async ({ page }) => {
    const hasCreds = !!process.env.E2E_EMAIL && !!process.env.E2E_PASSWORD;
    if (!hasCreds) {
      test.info().annotations.push({
        type: 'note',
        description: 'E2E_EMAIL/E2E_PASSWORD not provided; skipping authenticated favorites assertions',
      });
      return;
    }

    // Pre-accept cookies to avoid overlay affecting interactions.
    await preacceptCookies(page);

    // Go directly to the favorites route (more stable than relying on tabs UI).
    await page.goto('/favorites', { waitUntil: 'domcontentloaded' });

    // Authenticated run: should not be kicked to /login.
    await expect(page).not.toHaveURL(/\/login/);

    // Auth gate should not appear.
    await expect(page.getByText(/Избранное.*доступно.*(регистрации|авторизации)/i)).toHaveCount(0);

    // UI may show the "Избранное" header (when there are items) or the empty-state
    // title "Сохраняй маршруты..." (when favorites list is empty). Both are valid.
    const candidates = [
      page.getByText('Избранное', { exact: true }).first(),
      page.getByText('Сохраняй маршруты, чтобы вернуться к ним позже'),
      page.getByText('Найти маршруты'),
    ];
    const anyVisible = await Promise.all(
      candidates.map((c) => c.waitFor({ state: 'visible', timeout: 15_000 }).then(() => true).catch(() => false))
    );
    expect(anyVisible.some(Boolean)).toBeTruthy();
  });
});
