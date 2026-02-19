import { test, expect } from './fixtures';
import { preacceptCookies, gotoWithRetry } from './helpers/navigation';
import { getTravelsListPath } from './helpers/routes';

/**
 * Navigate to a travel with multi-image slider, trying up to maxCards.
 */
async function navigateToTravelWithSlider(
  page: import('@playwright/test').Page,
  maxCards = 5
): Promise<boolean> {
  await gotoWithRetry(page, getTravelsListPath());
  const cards = page.locator('[data-testid="travel-card-link"]');
  await cards.first().waitFor({ state: 'visible', timeout: 30_000 }).catch(() => null);
  const count = await cards.count();
  if (count === 0) return false;

  for (let i = 0; i < Math.min(count, maxCards); i++) {
    if (i > 0) {
      await gotoWithRetry(page, getTravelsListPath());
      await cards.first().waitFor({ state: 'visible', timeout: 30_000 }).catch(() => null);
    }

    await cards.nth(i).click();
    const navigated = await page
      .waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    if (!navigated) continue;

    // Wait for the "Next slide" button — it only renders when slider is mounted and has >1 image
    const nextBtn = page.locator('[aria-label="Next slide"]').first();
    const hasNext = await nextBtn
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => true)
      .catch(() => false);

    if (hasNext) return true;
  }

  return false;
}

test.describe('@smoke Slider smoothness', () => {
  test('does not show loading shimmer immediately when switching slides', async ({ page }) => {
    await preacceptCookies(page);
    await page.setViewportSize({ width: 1280, height: 720 });

    const hasSlider = await navigateToTravelWithSlider(page);
    if (!hasSlider) {
      test.skip(true, 'No travel with multi-image slider found');
      return;
    }

    const nextBtn = page.locator('[aria-label="Next slide"]').first();
    await nextBtn.click();

    // We intentionally delay rendering shimmer on web to avoid a visible "gray flash" for cached/fast loads.
    await page.waitForTimeout(100);
    const shimmer = page.locator('[data-testid="slider-loading-overlay-1"]');
    await expect(shimmer).toHaveCount(0);
  });
});
