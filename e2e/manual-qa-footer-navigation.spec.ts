import { test, expect } from './fixtures';
import { getTravelsListPath } from './helpers/routes';

const waitForConsentBanner = async (page: any) => {
  const banner = page.getByText('Мы ценим вашу приватность', { exact: true });
  await expect(banner).toBeVisible({ timeout: 10_000 });
};

const navigateWithRetry = async (page: any, path: string) => {
  let lastError: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(500);
    }
  }
  if (lastError) throw lastError;
};

test.describe('Manual QA automation: footer navigation', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('desktop footer navigation works with banner visible', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    const actions = [
      { testId: 'footer-item-header-travelsby', path: /\/travelsby/ },
      { testId: 'footer-item-header-map', path: /\/map/ },
      { testId: 'footer-item-header-roulette', path: /\/roulette/ },
    ];

    for (const action of actions) {
      await navigateWithRetry(page, '/');
      await waitForConsentBanner(page);

      const footer = page.getByTestId('footer-desktop-bar');
      await footer.scrollIntoViewIfNeeded();
      await expect(footer).toBeVisible({ timeout: 10_000 });

      const item = page.getByTestId(action.testId);
      await expect(item).toBeVisible();
      await item.click();

      await expect(page).toHaveURL(action.path);
    }
  });

  test('mobile dock "More" items navigate with banner visible', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const targets = [
      { label: 'Политика конфиденциальности', path: /\/privacy/ },
      { label: 'Настройки cookies', path: /\/cookies/ },
      { label: 'Связаться с нами', path: /\/about/ },
    ];

    for (const target of targets) {
      await navigateWithRetry(page, getTravelsListPath());
      await waitForConsentBanner(page);

      const dock = page.getByTestId('footer-dock-wrapper');
      await expect(dock).toBeVisible({ timeout: 30_000 });

      await page.getByTestId('footer-item-more').click();
      await expect(page.getByTestId('footer-more-sheet')).toBeVisible({ timeout: 10_000 });

      await page.getByText(target.label, { exact: true }).click();
      await expect(page).toHaveURL(target.path);
    }
  });
});
