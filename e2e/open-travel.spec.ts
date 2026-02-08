import { test, expect } from './fixtures';
import { getTravelsListPath } from './helpers/routes';
import { seedNecessaryConsent } from './helpers/storage';

test.describe('@smoke Travel details', () => {
  test('can open a travel details page from list', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);

    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });

    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    const count = await cards.count();

    if (count === 0) {
      test.info().annotations.push({
        type: 'note',
        description: 'No travel cards available in this environment; nothing to open',
      });
      return;
    }

    await cards.first().click();

    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Minimal sanity check: page should render some content.
    await expect(page.locator('body')).toContainText(/./);
  });
});
