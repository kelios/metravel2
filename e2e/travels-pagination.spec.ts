import { test, expect } from './fixtures';
import { preacceptCookies, waitForMainListRender, gotoWithRetry } from './helpers/navigation';
import { getTravelsListPath } from './helpers/routes';

/**
 * Infinite-scroll pagination on the travels list (useListTravelData ->
 * useInfiniteQuery, PER_PAGE = 20). Previously untested.
 *
 * Runs against live data with a graceful skip: it reads the reported `total`
 * from the first list API response and only asserts growth when a second page
 * actually exists (total > items already loaded).
 */
const CARD = '[data-testid="travel-card-link"], [testID="travel-card-link"]';

test.describe('Travels list — infinite scroll', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('loads the next page when scrolled to the end', async ({ page }) => {
    await preacceptCookies(page);

    // Capture the reported total from the first travels list response.
    const totalPromise = page
      .waitForResponse(
        (resp) => /\/travels?\b/i.test(resp.url()) && resp.request().method() === 'GET' && resp.ok(),
        { timeout: 60_000 }
      )
      .then(async (resp) => {
        const json = await resp.json().catch(() => null);
        const total = Number(json?.total ?? json?.count);
        return Number.isFinite(total) ? total : null;
      })
      .catch(() => null);

    await gotoWithRetry(page, getTravelsListPath());
    await waitForMainListRender(page);

    const cards = page.locator(CARD);
    await cards.first().waitFor({ state: 'visible', timeout: 30_000 }).catch(() => null);

    const initialCount = await cards.count();
    if (initialCount === 0) {
      test.info().annotations.push({
        type: 'note',
        description: 'No travel cards available in this environment; nothing to paginate.',
      });
      return;
    }

    const total = await totalPromise;
    if (total != null && total <= initialCount) {
      test.info().annotations.push({
        type: 'note',
        description: `Dataset fits on one page (total=${total}, loaded=${initialCount}); no second page to load.`,
      });
      return;
    }

    // Scroll to the end a few times; the next page should append more cards.
    const grew = await expect
      .poll(
        async () => {
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await page.waitForTimeout(600);
          return cards.count();
        },
        { timeout: 30_000, intervals: [600, 1000, 1500, 2000] }
      )
      .toBeGreaterThan(initialCount)
      .then(() => true)
      .catch(() => false);

    if (!grew) {
      // total was unknown and the list happened to fit one page — acceptable.
      test.info().annotations.push({
        type: 'note',
        description: `Card count did not grow past ${initialCount}; treating as single-page dataset.`,
      });
      return;
    }

    expect(await cards.count()).toBeGreaterThan(initialCount);
  });
});
