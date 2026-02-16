/**
 * E2E: Slider drag / swipe on web
 *
 * Verifies that the image slider on a travel details page can be navigated by:
 *   1. Clicking the arrow buttons (prev / next)
 *   2. Mouse drag-to-scroll (desktop web)
 *   3. Keyboard arrows (left / right)
 *
 * The test opens the travel list, picks the first card, navigates to its detail
 * page, and waits for the slider with >1 image to appear.
 */

import { test, expect } from './fixtures';
import { preacceptCookies, gotoWithRetry } from './helpers/navigation';
import { getTravelsListPath } from './helpers/routes';

/**
 * Extract current and total from the slider counter element.
 * RNW renders Text as leaf <div> elements — walk all leaf nodes and check innerText.
 * Returns null when the counter is not found or the travel has only one image.
 */
async function getCounter(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const re = /^(\d+)\/(\d+)$/;
    const all = document.querySelectorAll('*');
    for (const el of all) {
      if (el.children.length > 0) continue;
      const t = (el.textContent || '').trim();
      const m = t.match(re);
      if (m) {
        const current = Number(m[1]);
        const total = Number(m[2]);
        if (total > 1 && total <= 500 && current >= 1 && current <= total) {
          return { current, total };
        }
      }
    }
    return null;
  });
}

/**
 * Wait for the counter to show a specific `current` value.
 */
async function waitForCounterValue(page: import('@playwright/test').Page, expected: number, timeout = 5_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const c = await getCounter(page);
    if (c && c.current === expected) return c;
    await page.waitForTimeout(200);
  }
  return getCounter(page);
}

/**
 * Navigate to the first travel from the list that has a multi-image slider.
 * Tries up to `maxCards` cards. Returns the counter or null.
 */
async function navigateToTravelWithSlider(
  page: import('@playwright/test').Page,
  maxCards = 5
): Promise<{ current: number; total: number } | null> {
  await gotoWithRetry(page, getTravelsListPath());

  const cards = page.locator('[data-testid="travel-card-link"]');
  await cards.first().waitFor({ state: 'visible', timeout: 30_000 }).catch(() => null);
  const count = await cards.count();
  if (count === 0) return null;

  for (let i = 0; i < Math.min(count, maxCards); i++) {
    // RNW renders links as <div role="link"> — no href attribute.
    // Navigate to the list page, click the i-th card, wait for /travels/ URL.
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

    // Wait for the "Next slide" button — it only renders when images.length > 1
    const nextBtn = page.locator('[aria-label="Next slide"]').first();
    const hasNext = await nextBtn
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => true)
      .catch(() => false);

    if (!hasNext) continue;

    // Wait for the counter
    const counter = await waitForCounterValue(page, 1, 10_000);
    if (counter) return counter;
  }

  return null;
}

test.describe('Slider navigation on web', () => {
  test('arrow buttons change the active slide', async ({ page }) => {
    await preacceptCookies(page);

    const counter = await navigateToTravelWithSlider(page);
    if (!counter) {
      test.skip(true, 'No travel with multi-image slider found');
      return;
    }

    expect(counter.current).toBe(1);
    expect(counter.total).toBeGreaterThan(1);

    // Click the "Next slide" arrow
    const nextBtn = page.locator('[aria-label="Next slide"]').first();
    await expect(nextBtn).toBeVisible({ timeout: 5_000 });
    await nextBtn.click();
    await page.waitForTimeout(500); // wait for scroll animation

    const afterNext = await waitForCounterValue(page, 2, 10_000);
    expect(afterNext?.current).toBe(2);

    // Click the "Previous slide" arrow
    const prevBtn = page.locator('[aria-label="Previous slide"]').first();
    await expect(prevBtn).toBeVisible({ timeout: 5_000 });
    await prevBtn.click();
    await page.waitForTimeout(500); // wait for scroll animation

    const afterPrev = await waitForCounterValue(page, 1, 10_000);
    expect(afterPrev?.current).toBe(1);
  });

  test('mouse drag scrolls to the next slide', async ({ page }) => {
    await preacceptCookies(page);

    const counter = await navigateToTravelWithSlider(page);
    if (!counter) {
      test.skip(true, 'No travel with multi-image slider found');
      return;
    }

    expect(counter.current).toBe(1);

    // Dispatch mouse drag events directly on the scroll container DOM node.
    // Playwright's page.mouse targets the topmost element (the absolutely-positioned
    // image), but the mousedown handler is attached to the scroll container via
    // addEventListener. We use page.evaluate with async delays between events so
    // the browser can process scroll position changes between frames.
    const dragOk = await page.evaluate(async () => {
      const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const img = document.querySelector('img[alt^="Фотография путешествия 1 из"]');
      if (!img) return false;
      let node: HTMLElement | null = img.parentElement;
      while (node) {
        if (getComputedStyle(node).overflowX === 'scroll' || getComputedStyle(node).overflowX === 'auto') break;
        node = node.parentElement;
      }
      if (!node) return false;

      const rect = node.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      const startX = rect.left + rect.width * 0.8;
      const endX = rect.left + rect.width * 0.1;

      node.dispatchEvent(new MouseEvent('mousedown', {
        button: 0, pageX: startX, pageY: centerY, clientX: startX, clientY: centerY, bubbles: true,
      }));
      await delay(50);

      const steps = 15;
      for (let i = 1; i <= steps; i++) {
        const x = startX + (endX - startX) * (i / steps);
        window.dispatchEvent(new MouseEvent('mousemove', {
          pageX: x, pageY: centerY, clientX: x, clientY: centerY, bubbles: true,
        }));
        await delay(16);
      }

      window.dispatchEvent(new MouseEvent('mouseup', {
        button: 0, pageX: endX, pageY: centerY, clientX: endX, clientY: centerY, bubbles: true,
      }));

      return true;
    });
    expect(dragOk).toBe(true);

    await page.waitForTimeout(1000); // wait for snap animation
    const afterDrag = await waitForCounterValue(page, 2, 10_000);
    expect(afterDrag?.current).toBe(2);

    // Drag back: left to right (swipe right → previous slide)
    const dragBackOk = await page.evaluate(async () => {
      const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const img = document.querySelector('img[alt^="Фотография путешествия"]');
      if (!img) return false;
      let node: HTMLElement | null = img.parentElement;
      while (node) {
        if (getComputedStyle(node).overflowX === 'scroll' || getComputedStyle(node).overflowX === 'auto') break;
        node = node.parentElement;
      }
      if (!node) return false;

      const rect = node.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      const startX = rect.left + rect.width * 0.2;
      const endX = rect.left + rect.width * 0.9;

      node.dispatchEvent(new MouseEvent('mousedown', {
        button: 0, pageX: startX, pageY: centerY, clientX: startX, clientY: centerY, bubbles: true,
      }));
      await delay(50);

      const steps = 15;
      for (let i = 1; i <= steps; i++) {
        const x = startX + (endX - startX) * (i / steps);
        window.dispatchEvent(new MouseEvent('mousemove', {
          pageX: x, pageY: centerY, clientX: x, clientY: centerY, bubbles: true,
        }));
        await delay(16);
      }

      window.dispatchEvent(new MouseEvent('mouseup', {
        button: 0, pageX: endX, pageY: centerY, clientX: endX, clientY: centerY, bubbles: true,
      }));

      return true;
    });
    expect(dragBackOk).toBe(true);

    await page.waitForTimeout(1000); // wait for snap animation
    const afterDragBack = await waitForCounterValue(page, 1, 10_000);
    expect(afterDragBack?.current).toBe(1);
  });

  test('keyboard arrows navigate the slider', async ({ page }) => {
    await preacceptCookies(page);

    const counter = await navigateToTravelWithSlider(page);
    if (!counter) {
      test.skip(true, 'No travel with multi-image slider found');
      return;
    }

    expect(counter.current).toBe(1);

    // Focus the slider area by clicking on the first slider image
    const sliderImage = page.locator('img[alt^="Фотография путешествия 1 из"]').first();
    const imgVisible = await sliderImage.isVisible().catch(() => false);
    if (imgVisible) {
      await sliderImage.click();
    } else {
      // Fallback: click the "Previous slide" button area to focus the slider
      const prevBtn = page.locator('[aria-label="Previous slide"]').first();
      await prevBtn.click();
    }

    // Press ArrowRight → next slide
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(500);
    const afterRight = await waitForCounterValue(page, 2, 10_000);
    expect(afterRight?.current).toBe(2);

    // Press ArrowLeft → previous slide
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(500);
    const afterLeft = await waitForCounterValue(page, 1, 10_000);
    expect(afterLeft?.current).toBe(1);
  });
});
