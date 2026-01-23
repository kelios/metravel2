import { test, expect } from './fixtures';

test.describe('Manual QA automation: auth entrypoints', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('login -> registration link works with visible cookie banner', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const banner = page.getByText('Мы ценим вашу приватность', { exact: true });
    await expect(banner).toBeVisible({ timeout: 10_000 });

    const registerLink = page.getByText('Зарегистрируйтесь', { exact: true });
    await expect(registerLink).toBeVisible();
    await registerLink.click();

    await expect(page).toHaveURL(/\/registration/);
  });
});
