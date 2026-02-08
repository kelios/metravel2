import { test, expect } from './fixtures';
import { getTravelsListPath } from './helpers/routes';
import { hideRecommendationsBanner, seedNecessaryConsent } from './helpers/storage';

// This test protects against a regression where the mobile footer dock (position: fixed on web)
// overlaps the main content / skeletons because no bottom gutter is reserved.

test.describe('Footer dock (web mobile)', () => {
  test('does not overlap main content (skeletons) on initial load', async ({ page }) => {
    // Force mobile-ish viewport to trigger Footer mobile dock.
    await page.setViewportSize({ width: 390, height: 844 });

    await page.addInitScript(seedNecessaryConsent);
    await page.addInitScript(hideRecommendationsBanner);

    // Expo dev server can occasionally return transient ERR_EMPTY_RESPONSE / ERR_CONNECTION_REFUSED while starting.
    // Retry navigation with backoff to reduce flakiness.
    let lastError: any = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
         
        await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
        lastError = null;
        break;
      } catch (e) {
        lastError = e;
        const msg = String((e as any)?.message ?? e);
        const isTransient =
          msg.includes('ERR_EMPTY_RESPONSE') ||
          msg.includes('ERR_CONNECTION_REFUSED') ||
          msg.includes('ECONNREFUSED') ||
          msg.includes('net::');
        const backoffMs = isTransient ? Math.min(1000 + attempt * 600, 8000) : 500;
         
        await page.waitForTimeout(backoffMs);
      }
    }
    if (lastError) throw lastError;

    // Wait for footer dock to mount.
    const dock = page.getByTestId('footer-dock-measure');
    await expect(dock).toBeVisible({ timeout: 30_000 });

    // Gutter should be present on web mobile to prevent overlap.
    const gutter = page.getByTestId('bottom-gutter');
    await expect(gutter).toHaveCount(1, { timeout: 30_000 });
    await gutter.scrollIntoViewIfNeeded().catch(() => null);

    // Robust invariant: the reserved gutter height must be at least the dock height.
    // If not, the fixed dock can overlap content at the bottom of the scroll.
    const { dockHeight, gutterHeight } = await page.evaluate(() => {
      const dockEl = document.querySelector('[data-testid="footer-dock-measure"]') as HTMLElement | null;
      const gutterEl = document.querySelector('[data-testid="bottom-gutter"]') as HTMLElement | null;

      return {
        dockHeight: dockEl ? dockEl.offsetHeight : 0,
        gutterHeight: gutterEl ? gutterEl.offsetHeight : 0,
      };
    });

    expect(dockHeight, 'footer dock height should be measurable').toBeGreaterThan(0);
    expect(dockHeight).toBeGreaterThan(0);
    expect(gutterHeight).toBeGreaterThan(0);

    expect(gutterHeight).toBeGreaterThanOrEqual(dockHeight - 1);
    expect(
      gutterHeight,
      `bottom gutter should not be excessively large (gutterHeight=${gutterHeight}, dockHeight=${dockHeight})`
    ).toBeLessThanOrEqual(dockHeight + 20);
  });
});
