import { test, expect } from '@playwright/test';

test.describe('Travel details', () => {
  test('can open a travel details page from list', async ({ page }) => {
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

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    const count = await cards.count();

    if (count === 0) {
      test.skip(true, 'No travel cards available in this environment');
    }

    await cards.first().click();

    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Minimal sanity check: page should render some content.
    await expect(page.locator('body')).toContainText(/./);
  });
});
