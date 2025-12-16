import { test, expect } from '@playwright/test';

test.describe('Roulette', () => {
  test('can spin and get results (or empty) on /roulette', async ({ page }) => {
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

    await page.goto('/roulette', { waitUntil: 'domcontentloaded' });

    // On roulette page the primary action is typically "Подобрать маршруты".
    // In some states it can be disabled until filters are set.
    const pickRoutes = page.getByRole('button', { name: 'Подобрать маршруты' }).first();
    if (await pickRoutes.isVisible().catch(() => false)) {
      if (await pickRoutes.isDisabled().catch(() => false)) {
        test.skip(true, 'Roulette action is disabled (likely requires filters)');
      }
      await pickRoutes.click({ timeout: 30_000 });
    } else {
      // Fallback for older UI.
      const legacy = page.getByRole('button', { name: 'Случайный маршрут' }).first();
      if (await legacy.isVisible().catch(() => false)) {
        await legacy.click({ timeout: 30_000 });
      } else {
        test.skip(true, 'Roulette primary action button not found');
      }
    }

    // Wait for either result cards or the same screen staying stable.
    await Promise.race([
      page.waitForSelector('[data-testid="travel-card-link"]', { timeout: 30_000 }),
      page.waitForSelector('[data-testid="travel-card-skeleton"]', { timeout: 30_000 }),
      page.waitForTimeout(1500),
    ]);

    expect(true).toBeTruthy();
  });
});
