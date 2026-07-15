import { expect, test } from './fixtures';
import { gotoWithRetry, preacceptCookies } from './helpers/navigation';

const HYDRATION_ERROR = /Minified React error #418\b|Hydration failed because the server rendered/i;

test.describe('SSR route hydration', () => {
  test('responsive lazy routes hydrate without replacing their server HTML', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await preacceptCookies(page);

    const hydrationErrors: string[] = [];
    page.on('pageerror', (error) => {
      const message = String(error?.message ?? error);
      if (HYDRATION_ERROR.test(message)) hydrationErrors.push(message);
    });
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const text = message.text();
      if (HYDRATION_ERROR.test(text)) hydrationErrors.push(text);
    });

    for (const route of ['/login', '/registration', '/places', '/roulette']) {
      await gotoWithRetry(page, route);
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(750);
      expect(hydrationErrors, `hydration errors after ${route}`).toEqual([]);
    }
  });
});
