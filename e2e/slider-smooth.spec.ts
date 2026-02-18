import { test, expect } from './fixtures';
import { preacceptCookies, navigateToFirstTravel } from './helpers/navigation';

test.describe('@smoke Slider smoothness', () => {
  test('does not show loading shimmer immediately when switching slides', async ({ page }) => {
    await preacceptCookies(page);
    await page.setViewportSize({ width: 1280, height: 720 });

    const opened = await navigateToFirstTravel(page);
    expect(opened, 'Unable to open first travel details page').toBeTruthy();
    const slider = page.locator('[data-testid="slider-wrapper"]').first();
    await expect(slider).toBeVisible();

    const nextBtn = slider.locator('[aria-label="Next slide"]').first();
    await expect(nextBtn).toBeVisible();

    await nextBtn.click();

    // We intentionally delay rendering shimmer on web to avoid a visible "gray flash" for cached/fast loads.
    await page.waitForTimeout(100);
    await expect(slider.locator('[data-testid="slider-loading-overlay-1"]')).toHaveCount(0);
  });
});
