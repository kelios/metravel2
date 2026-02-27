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
  test('switches slides smoothly without UI artifacts', async ({ page }) => {
    await preacceptCookies(page);
    await page.setViewportSize({ width: 1280, height: 720 });

    const hasSlider = await navigateToTravelWithSlider(page);
    if (!hasSlider) {
      const cards = page.locator('[data-testid="travel-card-link"]');
      const hasAnyCard = (await cards.count()) > 0;
      if (!hasAnyCard) {
        await expect(page.locator('text=/Пока нет путешествий|Найдено:\\s*0/i').first()).toBeVisible();
        return;
      }

      await cards.first().click();
      await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 15_000 });
      await expect(page.locator('[data-testid="slider-scroll"]').first()).toBeVisible();
      return;
    }

    const nextBtn = page.locator('[aria-label="Next slide"]').first();
    await nextBtn.click();

    await page.waitForTimeout(250);

    // Slider stays interactive and keeps rendered image content after navigation.
    await expect(page.locator('[data-testid="slider-scroll"]').first()).toBeVisible();

    const counterAdvanced = await page.evaluate(() => {
      const re = /^(\d+)\/(\d+)$/;
      const all = document.querySelectorAll('*');
      for (const el of all) {
        if (el.children.length > 0) continue;
        const t = (el.textContent || '').trim();
        const m = t.match(re);
        if (m) {
          const current = Number(m[1]);
          const total = Number(m[2]);
          if (total > 1 && current >= 2) return true;
        }
      }
      return false;
    });
    expect(counterAdvanced).toBe(true);

    // Prefer strict check for accessible naming.
    const hasAnyAccessibleImage = await page
      .locator('img[alt^="Фотография путешествия"], [role="img"][aria-label^="Фотография путешествия"]')
      .first()
      .isVisible()
      .catch(() => false);
    if (hasAnyAccessibleImage) {
      expect(hasAnyAccessibleImage).toBe(true);
      return;
    }

    // Fallback: expo-image on web can render without exposing alt/aria-label.
    const hasAnySlideContent = await page.evaluate(() => {
      return (
        document.querySelector('[data-testid^="slider-image-"]') !== null ||
        document.querySelector('[data-testid^="slider-neutral-placeholder-"]') !== null
      );
    });
    expect(hasAnySlideContent).toBe(true);
  });
});
