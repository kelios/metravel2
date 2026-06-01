import { test, expect } from './fixtures';
import { gotoWithRetry, preacceptCookies } from './helpers/navigation';

const OUT_DIR = 'e2e/.artifacts/profile-redesign';

test.describe('Profile redesign screenshots', () => {
  test('desktop profile', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1400 });
    await preacceptCookies(page);
    await gotoWithRetry(page, '/profile');

    // Wait until either the authored profile header or login gate resolves.
    await page
      .waitForSelector('text=Редактировать, text=Войдите в аккаунт', { timeout: 30_000 })
      .catch(() => null);
    await page.waitForTimeout(3500);

    await page.screenshot({ path: `${OUT_DIR}/desktop-full.png`, fullPage: true });
    await page.screenshot({ path: `${OUT_DIR}/desktop-viewport.png` });

    const gate = await page.getByText('Войдите в аккаунт').isVisible().catch(() => false);
    expect(gate, 'should be authenticated via storageState (not the login gate)').toBeFalsy();
  });

  test('mobile profile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 1600 });
    await preacceptCookies(page);
    await gotoWithRetry(page, '/profile');
    await page.waitForTimeout(3500);

    await page.screenshot({ path: `${OUT_DIR}/mobile-full.png`, fullPage: true });
    await page.screenshot({ path: `${OUT_DIR}/mobile-viewport.png` });
  });
});
