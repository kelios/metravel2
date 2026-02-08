import { test, expect } from './fixtures';
import { preacceptCookies, gotoWithRetry, waitForMainListRender } from './helpers/navigation';
import { getTravelsListPath } from './helpers/routes';

async function waitForMainToRender(page: any) {
  await Promise.race([
    page.waitForSelector('#search-input', { timeout: 30_000 }),
    page.waitForSelector(
      '[data-testid="travel-card-link"], [data-testid="travel-card-skeleton"], [data-testid="list-travel-skeleton"]',
      { timeout: 30_000 }
    ),
    page.waitForSelector('text=Пока нет путешествий', { timeout: 30_000 }),
    page.waitForSelector('text=Найдено:', { timeout: 30_000 }),
    page.waitForSelector('text=Пиши о своих путешествиях', { timeout: 30_000 }),
  ]);
}

test.describe('Mobile menu navigation', () => {
  test('closes menu overlay after selecting a nav item (mobile)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await preacceptCookies(page);

    await gotoWithRetry(page, getTravelsListPath());
    await waitForMainToRender(page);

    const burger = page.getByTestId('mobile-menu-open');
    await expect(burger).toBeVisible({ timeout: 30_000 });
    await burger.click();

    const overlay = page.getByTestId('mobile-menu-overlay');
    await expect(overlay).toBeVisible({ timeout: 10_000 });

    const panel = page.getByTestId('mobile-menu-panel');
    await expect(panel).toBeVisible({ timeout: 10_000 });

    // Pick any stable nav item and ensure menu closes after navigation.
    const mapNav = panel.getByRole('button', { name: /Карта/i });
    await expect(mapNav).toBeVisible({ timeout: 10_000 });
    await Promise.all([
      page.waitForURL((url) => url.pathname.includes('/map'), { timeout: 30_000 }),
      mapNav.click(),
    ]);

    // After navigation, the menu overlay must be dismissed.
    await expect(page.getByTestId('mobile-menu-overlay')).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByTestId('mobile-menu-panel')).toHaveCount(0, { timeout: 10_000 });
  });
});
