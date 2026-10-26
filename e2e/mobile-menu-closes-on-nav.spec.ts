import { test, expect } from './fixtures';
import { preacceptCookies, gotoWithRetry } from './helpers/navigation';
import { getTravelsListPath } from './helpers/routes';

// #2779: у шапки телефона своего меню нет — кнопка меню открывает лист «Ещё»
// нижнего дока. После перехода по пункту лист обязан закрыться.
test.describe('Mobile menu navigation', () => {
  test('header menu opens the «Ещё» sheet and it closes after selecting a nav item (mobile)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await preacceptCookies(page);

    await gotoWithRetry(page, getTravelsListPath());

    const burger = page.locator('[data-testid="mobile-menu-open"]:visible').first();
    await expect(burger).toBeVisible({ timeout: 30_000 });
    await burger.click();

    const sheet = page.getByTestId('footer-more-sheet');
    await expect(sheet).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('footer-more-list')).toBeVisible({ timeout: 10_000 });

    const placesItem = page.getByTestId('footer-more-item-places');
    await expect(placesItem).toBeVisible({ timeout: 10_000 });
    await Promise.all([
      page.waitForURL((url) => url.pathname.includes('/places'), { timeout: 30_000 }),
      placesItem.click(),
    ]);

    await expect(page.getByTestId('footer-more-sheet')).toHaveCount(0, { timeout: 10_000 });
  });
});
