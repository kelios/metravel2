import { test, expect } from '@playwright/test';

// This test protects against a regression where the mobile footer dock (position: fixed on web)
// overlaps the main content / skeletons because no bottom gutter is reserved.

test.describe('Footer dock (web mobile)', () => {
  test('does not overlap main content (skeletons) on initial load', async ({ page }) => {
    // Force mobile-ish viewport to trigger Footer mobile dock.
    await page.setViewportSize({ width: 390, height: 844 });

    await page.addInitScript(() => {
      // Hide cookie consent banner by pre-setting consent.
      try {
        window.localStorage.setItem(
          'metravel_consent_v1',
          JSON.stringify({ necessary: true, analytics: false, date: new Date().toISOString() })
        );
      } catch {
        // ignore
      }

      // Reduce noise: keep recommendations collapsed.
      try {
        sessionStorage.setItem('recommendations_visible', 'false');
      } catch {
        // ignore
      }
    });

    // Expo dev server can occasionally return transient ERR_EMPTY_RESPONSE while hot reloading.
    // Retry navigation to reduce flakiness.
    let lastError: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
        lastError = null;
        break;
      } catch (e) {
        lastError = e;
        // eslint-disable-next-line no-await-in-loop
        await page.waitForTimeout(500);
      }
    }
    if (lastError) throw lastError;

    // Wait for footer dock to mount.
    const dock = page.getByTestId('footer-dock-measure');
    await expect(dock).toBeVisible({ timeout: 30_000 });

    // Gutter should be present on web mobile to prevent overlap.
    const gutter = page.getByTestId('bottom-gutter');
    await expect(gutter).toBeVisible({ timeout: 30_000 });

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
    expect(gutterHeight, 'bottom gutter height should be measurable').toBeGreaterThan(0);

    expect(gutterHeight).toBeGreaterThanOrEqual(dockHeight - 1);
  });
});
