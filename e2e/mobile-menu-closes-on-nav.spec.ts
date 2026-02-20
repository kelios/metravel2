import { test, expect } from './fixtures';
import { preacceptCookies, gotoWithRetry } from './helpers/navigation';
import { getTravelsListPath } from './helpers/routes';

test.describe('Mobile menu navigation', () => {
  test('closes menu overlay after selecting a nav item (mobile)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await preacceptCookies(page);

    await gotoWithRetry(page, getTravelsListPath());

    // Wait for the burger menu to appear — no need to wait for the full list render.
    const burger = page.getByTestId('mobile-menu-open');
    await expect(burger).toBeVisible({ timeout: 30_000 });
    await burger.click();

    const overlay = page.getByTestId('mobile-menu-overlay');
    await expect(overlay).toBeVisible({ timeout: 10_000 });

    const panel = page.getByTestId('mobile-menu-panel');
    await expect(panel).toBeVisible({ timeout: 10_000 });

    // Pick any stable nav item and ensure menu closes after navigation.
    const mapNav = panel.getByRole('button', { name: /Популярное|Карта/i });
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
