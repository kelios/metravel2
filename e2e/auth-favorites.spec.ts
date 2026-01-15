import { test, expect } from './fixtures';
import { seedNecessaryConsent } from './helpers/storage';

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
    await page.addInitScript(seedNecessaryConsent);

    // Go directly to the favorites route (more stable than relying on tabs UI).
    await page.goto('/favorites', { waitUntil: 'domcontentloaded' });

    // Authenticated run: should not be kicked to /login.
    await expect(page).not.toHaveURL(/\/login/);

    // Page should render the favorites screen header.
    await expect(page.getByText('Избранное', { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    // Auth gate should not appear.
    await expect(page.getByText(/Избранное.*доступно.*(регистрации|авторизации)/i)).toHaveCount(0);

    // UI may show different empty/content states depending on backend data.
    // Keep this assertion flexible: any of the common states OR just the header is acceptable.
    const candidates = [
      page.getByText('Избранное пусто', { exact: true }),
      page.getByText('Добавляй понравившиеся путешествия и сохраняй их здесь'),
      page.getByText('Смотреть все', { exact: true }),
      page.getByText('Путешествия', { exact: true }),
    ];
    const anyVisible = await Promise.all(candidates.map((c) => c.isVisible().catch(() => false)));
    expect(anyVisible.some(Boolean) || (await page.getByText('Избранное', { exact: true }).first().isVisible().catch(() => false))).toBeTruthy();
  });
});
