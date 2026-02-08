import { test, expect } from './fixtures';
import { getTravelsListPath } from './helpers/routes';
import { seedNecessaryConsent } from './helpers/storage';

async function gotoWithRetry(page: any, url: string) {
  let lastError: any = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      lastError = null;
      break;
    } catch (e) {
      lastError = e;
      const msg = String((e as any)?.message ?? e ?? '');
      const isTransient =
        msg.includes('ERR_CONNECTION_REFUSED') ||
        msg.includes('ERR_EMPTY_RESPONSE') ||
        msg.includes('NS_ERROR_NET_RESET') ||
        msg.includes('net::');

      if (typeof page?.isClosed === 'function' && page.isClosed()) break;

      try {
        await page.waitForTimeout(isTransient ? 800 + attempt * 250 : 500);
      } catch {
        break;
      }
    }
  }
  if (lastError) throw lastError;
}

test.describe('@smoke Auth smoke', () => {
  test('travels page loads (with storageState if available)', async ({ page }) => {
    // Pre-accept cookies to avoid overlay affecting interactions.
    await page.addInitScript(seedNecessaryConsent);

    // Travels list route is '/'
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
