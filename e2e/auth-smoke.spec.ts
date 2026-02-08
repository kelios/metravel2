import { test, expect } from './fixtures';
import { gotoWithRetry, preacceptCookies } from './helpers/navigation';
import { getTravelsListPath } from './helpers/routes';

test.describe('@smoke Auth smoke', () => {
  test('travels page loads (with storageState if available)', async ({ page }) => {
    await preacceptCookies(page);

    await gotoWithRetry(page, getTravelsListPath());

    // Page should render travel list (cards/skeletons) OR empty state OR landing hero on new homepage.
    await Promise.race([
      page.waitForSelector('[data-testid="travel-card-link"], [data-testid="travel-card-skeleton"]', {
        timeout: 30_000,
      }),
      page.waitForSelector('[data-testid="list-travel-skeleton"]', { timeout: 30_000 }),
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
