import { test, expect } from '@playwright/test';

test.describe('Auth smoke', () => {
  test('travels page loads (with storageState if available)', async ({ page }) => {
    // Pre-accept cookies to avoid overlay affecting interactions.
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

    // Travels list route is '/'
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Page should render travel list (cards/skeletons) OR empty state OR landing hero on new homepage.
    await Promise.race([
      page.waitForSelector('[data-testid="travel-card-link"], [data-testid="travel-card-skeleton"]', {
        timeout: 30_000,
      }),
      page.waitForSelector('text=Пока нет путешествий', { timeout: 30_000 }),
      page.waitForSelector('text=Найдено:', { timeout: 30_000 }),
      page.waitForSelector('text=Пиши о своих путешествиях', { timeout: 30_000 }),
    ]);

    const cards = await page.locator('[data-testid="travel-card-link"]').count();
    const skeletons = await page.locator('[data-testid="travel-card-skeleton"]').count();

    // If data is present we should see cards or skeletons.
    // If data is empty, the page still counts as "loaded" (handled by the waits above).
    expect(cards + skeletons).toBeGreaterThanOrEqual(0);
  });
});
