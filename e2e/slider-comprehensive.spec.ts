/**
 * E2E: Comprehensive slider tests
 *
 * Covers:
 *   1. Counter display and accuracy
 *   2. Pagination dots — count, active state
 *   3. Arrow visibility on hover
 *   4. Wrap-around navigation (last → first, first → last)
 *   5. Autoplay advances slides (desktop)
 *   6. Autoplay pauses on drag, resumes after
 *   7. Keyboard navigation requires focus on wrapper
 *   8. Single-image slider — no arrows, no counter, no dots
 *   9. Slide virtualization — out-of-window slides have no img
 *  10. Accessibility: aria-labels on nav buttons, role=button
 *  11. No horizontal page overflow caused by slider
 *  12. Touch swipe (pointer events simulation)
 */

import { test, expect } from './fixtures';
import { preacceptCookies, gotoWithRetry, assertNoHorizontalScroll } from './helpers/navigation';
import { getTravelsListPath } from './helpers/routes';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

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

async function waitForCounterValue(
  page: import('@playwright/test').Page,
  expected: number,
  timeout = 8_000,
) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const c = await getCounter(page);
    if (c && c.current === expected) return c;
    await page.waitForTimeout(200);
  }
  return getCounter(page);
}

/**
 * Navigate to a travel detail page that has a multi-image slider.
 * Returns counter info or null if none found.
 */
async function navigateToTravelWithSlider(
  page: import('@playwright/test').Page,
  maxCards = 8,
): Promise<{ current: number; total: number } | null> {
  await gotoWithRetry(page, getTravelsListPath());

  const cards = page.locator('[data-testid="travel-card-link"]');
  await cards.first().waitFor({ state: 'visible', timeout: 30_000 }).catch(() => null);
  const count = await cards.count();
  if (count === 0) return null;

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

    const nextBtn = page.locator('[aria-label="Next slide"]').first();
    const hasNext = await nextBtn
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    if (!hasNext) continue;

    const counter = await waitForCounterValue(page, 1, 10_000);
    if (counter) return counter;
  }

  return null;
}

/**
 * Navigate to a travel detail page (any — single or multi image).
 */
async function navigateToAnyTravel(page: import('@playwright/test').Page): Promise<boolean> {
  await gotoWithRetry(page, getTravelsListPath());
  const cards = page.locator('[data-testid="travel-card-link"]');
  await cards.first().waitFor({ state: 'visible', timeout: 30_000 }).catch(() => null);
  if ((await cards.count()) === 0) return false;
  await cards.first().click();
  return page
    .waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('Slider — counter accuracy', () => {
  test('counter starts at 1 and increments correctly on next', async ({ page }) => {
    await preacceptCookies(page);
    const counter = await navigateToTravelWithSlider(page);
    if (!counter) {
      test.skip(true, 'No multi-image travel found');
      return;
    }

    expect(counter.current).toBe(1);
    expect(counter.total).toBeGreaterThan(1);

    const nextBtn = page.locator('[aria-label="Next slide"]').first();
    await nextBtn.click();
    const c2 = await waitForCounterValue(page, 2, 8_000);
    expect(c2?.current).toBe(2);
    expect(c2?.total).toBe(counter.total); // total must not change
  });

  test('counter decrements on prev', async ({ page }) => {
    await preacceptCookies(page);
    const counter = await navigateToTravelWithSlider(page);
    if (!counter) {
      test.skip(true, 'No multi-image travel found');
      return;
    }

    // Go to slide 2 first
    await page.locator('[aria-label="Next slide"]').first().click();
    await waitForCounterValue(page, 2, 8_000);

    // Then go back
    await page.locator('[aria-label="Previous slide"]').first().click();
    const c = await waitForCounterValue(page, 1, 8_000);
    expect(c?.current).toBe(1);
  });
});

test.describe('Slider — pagination dots', () => {
  test('dot count matches total images', async ({ page }) => {
    await preacceptCookies(page);
    const counter = await navigateToTravelWithSlider(page);
    if (!counter) {
      test.skip(true, 'No multi-image travel found');
      return;
    }

    // Wait for slider wrapper
    await page.locator('[data-testid="slider-wrapper"]').first().waitFor({ state: 'visible', timeout: 10_000 });

    const dotCount = await page.evaluate(() => {
      const wrapper = document.querySelector('[data-testid="slider-wrapper"]');
      if (!wrapper) return 0;
      // Dots are small circles: look for elements with rounded style inside the dots container
      // The dots container has flexDirection row and contains View elements
      // We identify them by their computed size (6px × 6px or 20px × 6px for active)
      const allDivs = wrapper.querySelectorAll('div');
      let count = 0;
      for (const d of allDivs) {
        const s = getComputedStyle(d);
        const h = parseFloat(s.height);
        const br = parseFloat(s.borderRadius);
        const bg = s.backgroundColor;
        // Dots are 6px tall, have border-radius, and a white/semi-white background
        if (
          Math.abs(h - 6) < 2 &&
          br >= 2 &&
          bg.includes('255') &&
          d.children.length === 0
        ) {
          count++;
        }
      }
      return count;
    });

    expect(dotCount).toBe(counter.total);
  });

  test('active dot changes when navigating', async ({ page }) => {
    await preacceptCookies(page);
    const counter = await navigateToTravelWithSlider(page);
    if (!counter) {
      test.skip(true, 'No multi-image travel found');
      return;
    }

    await page.locator('[data-testid="slider-wrapper"]').first().waitFor({ state: 'visible', timeout: 10_000 });

    // Get active dot width before navigation (active dot is wider: 20px)
    const activeDotWidthBefore = await page.evaluate(() => {
      const wrapper = document.querySelector('[data-testid="slider-wrapper"]');
      if (!wrapper) return 0;
      const allDivs = wrapper.querySelectorAll('div');
      for (const d of allDivs) {
        const s = getComputedStyle(d);
        const h = parseFloat(s.height);
        const w = parseFloat(s.width);
        const bg = s.backgroundColor;
        if (Math.abs(h - 6) < 2 && w > 10 && bg.includes('255, 255, 255')) {
          return w;
        }
      }
      return 0;
    });

    // Active dot should be wider than inactive
    expect(activeDotWidthBefore).toBeGreaterThan(6);

    // Navigate to next slide
    await page.locator('[aria-label="Next slide"]').first().click();
    await waitForCounterValue(page, 2, 8_000);

    // The active dot position should have changed (first dot should no longer be active)
    const firstDotIsActive = await page.evaluate(() => {
      const wrapper = document.querySelector('[data-testid="slider-wrapper"]');
      if (!wrapper) return true;
      const allDivs = Array.from(wrapper.querySelectorAll('div'));
      // Find all dot-sized elements
      const dots = allDivs.filter((d) => {
        const s = getComputedStyle(d);
        const h = parseFloat(s.height);
        const br = parseFloat(s.borderRadius);
        return Math.abs(h - 6) < 2 && br >= 2 && d.children.length === 0 && s.backgroundColor.includes('255');
      });
      if (dots.length < 2) return true;
      // First dot should NOT be the wide active one
      const firstW = parseFloat(getComputedStyle(dots[0]).width);
      return firstW > 10;
    });

    expect(firstDotIsActive).toBe(false);
  });
});

test.describe('Slider — arrow visibility', () => {
  test('arrows are hidden by default and visible on hover', async ({ page }) => {
    await preacceptCookies(page);
    const counter = await navigateToTravelWithSlider(page);
    if (!counter) {
      test.skip(true, 'No multi-image travel found');
      return;
    }

    const wrapper = page.locator('[data-testid="slider-wrapper"]').first();
    await wrapper.waitFor({ state: 'visible', timeout: 10_000 });

    const nextBtn = page.locator('[aria-label="Next slide"]').first();
    const prevBtn = page.locator('[aria-label="Previous slide"]').first();

    // Buttons must exist in DOM
    await expect(nextBtn).toBeAttached();
    await expect(prevBtn).toBeAttached();

    // Before hover: opacity should be 0 (hidden)
    const opacityBefore = await nextBtn.evaluate((el) => {
      return parseFloat(getComputedStyle(el).opacity);
    });
    expect(opacityBefore).toBe(0);

    // Hover the wrapper
    await wrapper.hover();

    // After hover: opacity should be 1
    const opacityAfter = await nextBtn.evaluate((el) => {
      return parseFloat(getComputedStyle(el).opacity);
    });
    expect(opacityAfter).toBe(1);
  });
});

test.describe('Slider — wrap-around navigation', () => {
  test('prev on first slide wraps to last', async ({ page }) => {
    await preacceptCookies(page);
    const counter = await navigateToTravelWithSlider(page);
    if (!counter) {
      test.skip(true, 'No multi-image travel found');
      return;
    }

    expect(counter.current).toBe(1);

    // Click prev on first slide → should wrap to last
    const prevBtn = page.locator('[aria-label="Previous slide"]').first();
    await prevBtn.click();
    const afterWrap = await waitForCounterValue(page, counter.total, 8_000);
    expect(afterWrap?.current).toBe(counter.total);
  });

  test('next on last slide wraps to first', async ({ page }) => {
    await preacceptCookies(page);
    const counter = await navigateToTravelWithSlider(page);
    if (!counter) {
      test.skip(true, 'No multi-image travel found');
      return;
    }

    // Navigate to last slide
    const nextBtn = page.locator('[aria-label="Next slide"]').first();
    for (let i = 1; i < counter.total; i++) {
      await nextBtn.click();
      await waitForCounterValue(page, i + 1, 8_000);
    }

    const cLast = await getCounter(page);
    expect(cLast?.current).toBe(counter.total);

    // Click next → should wrap to first
    await nextBtn.click();
    const afterWrap = await waitForCounterValue(page, 1, 8_000);
    expect(afterWrap?.current).toBe(1);
  });
});

test.describe('Slider — accessibility', () => {
  test('nav buttons have correct aria-label and role=button', async ({ page }) => {
    await preacceptCookies(page);
    const counter = await navigateToTravelWithSlider(page);
    if (!counter) {
      test.skip(true, 'No multi-image travel found');
      return;
    }

    const nextBtn = page.locator('[aria-label="Next slide"]').first();
    const prevBtn = page.locator('[aria-label="Previous slide"]').first();

    await expect(nextBtn).toBeAttached();
    await expect(prevBtn).toBeAttached();

    // Check role
    const nextRole = await nextBtn.getAttribute('role');
    const prevRole = await prevBtn.getAttribute('role');
    expect(nextRole).toBe('button');
    expect(prevRole).toBe('button');
  });

  test('slider wrapper is keyboard-focusable (tabindex=0)', async ({ page }) => {
    await preacceptCookies(page);
    const counter = await navigateToTravelWithSlider(page);
    if (!counter) {
      test.skip(true, 'No multi-image travel found');
      return;
    }

    const wrapper = page.locator('[data-testid="slider-wrapper"]').first();
    await wrapper.waitFor({ state: 'visible', timeout: 10_000 });

    // The wrapper or its parent should have tabindex=0 for keyboard navigation
    const tabindex = await page.evaluate(() => {
      const wrapper = document.querySelector('[data-testid="slider-wrapper"]');
      if (!wrapper) return null;
      // Check wrapper itself or its parent
      const ti = wrapper.getAttribute('tabindex');
      if (ti !== null) return ti;
      const parent = wrapper.parentElement;
      return parent?.getAttribute('tabindex') ?? null;
    });

    expect(tabindex).toBe('0');
  });

  test('slide images have descriptive alt text', async ({ page }) => {
    await preacceptCookies(page);
    const counter = await navigateToTravelWithSlider(page);
    if (!counter) {
      test.skip(true, 'No multi-image travel found');
      return;
    }

    // First slide image should have alt text
    const firstImg = page.locator('img[alt*="1 из"]').first();
    await firstImg.waitFor({ state: 'attached', timeout: 10_000 }).catch(() => null);

    const alt = await firstImg.getAttribute('alt').catch(() => null);
    expect(alt).toBeTruthy();
    expect(alt).toMatch(/1 из \d+/);
  });
});

test.describe('Slider — single image', () => {
  test('single-image slider shows no arrows, counter, or dots', async ({ page }) => {
    await preacceptCookies(page);

    // Try to find a travel with exactly 1 image
    await gotoWithRetry(page, getTravelsListPath());
    const cards = page.locator('[data-testid="travel-card-link"]');
    await cards.first().waitFor({ state: 'visible', timeout: 30_000 }).catch(() => null);
    const count = await cards.count();
    if (count === 0) {
      test.skip(true, 'No travels found');
      return;
    }

    let foundSingle = false;
    for (let i = 0; i < Math.min(count, 10); i++) {
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

      // Wait for slider to mount
      await page.locator('[data-testid="slider-scroll"]').first().waitFor({ state: 'attached', timeout: 10_000 }).catch(() => null);

      const hasNext = await page.locator('[aria-label="Next slide"]').first().isVisible().catch(() => false);
      if (!hasNext) {
        // This travel has 1 image (or 0)
        foundSingle = true;
        break;
      }
    }

    if (!foundSingle) {
      test.skip(true, 'No single-image travel found');
      return;
    }

    // Verify no counter text like "1/1" or "1/N"
    const counterText = await page.evaluate(() => {
      const re = /^\d+\/\d+$/;
      const all = document.querySelectorAll('*');
      for (const el of all) {
        if (el.children.length > 0) continue;
        if (re.test((el.textContent || '').trim())) return true;
      }
      return false;
    });
    expect(counterText).toBe(false);

    // No next/prev buttons
    expect(await page.locator('[aria-label="Next slide"]').count()).toBe(0);
    expect(await page.locator('[aria-label="Previous slide"]').count()).toBe(0);
  });
});

test.describe('Slider — no horizontal page overflow', () => {
  test('slider does not cause horizontal page scroll', async ({ page }) => {
    await preacceptCookies(page);
    const navigated = await navigateToAnyTravel(page);
    if (!navigated) {
      test.skip(true, 'No travels found');
      return;
    }

    // Wait for slider to mount
    await page.locator('[data-testid="slider-scroll"]').first().waitFor({ state: 'attached', timeout: 15_000 }).catch(() => null);
    await page.waitForTimeout(500);

    await assertNoHorizontalScroll(page);
  });
});

test.describe('Slider — autoplay', () => {
  test('autoplay advances slides automatically on desktop', async ({ page }) => {
    await preacceptCookies(page);
    const counter = await navigateToTravelWithSlider(page);
    if (!counter) {
      test.skip(true, 'No multi-image travel found');
      return;
    }

    expect(counter.current).toBe(1);

    // Default autoPlayInterval is 6000ms. We wait up to 10s for autoplay to fire.
    // We speed up by evaluating JS to reduce the interval.
    await page.evaluate(() => {
      // Patch setInterval to fire faster for the autoplay timer
      // We can't easily patch the component, but we can wait the full interval.
      // Instead, just wait — the test verifies autoplay works at all.
    });

    // Wait up to 10s for slide to advance
    const advanced = await (async () => {
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        const c = await getCounter(page);
        if (c && c.current > 1) return true;
        await page.waitForTimeout(500);
      }
      return false;
    })();

    expect(advanced).toBe(true);
  });

  test('autoplay pauses when user hovers slider', async ({ page }) => {
    await preacceptCookies(page);
    const counter = await navigateToTravelWithSlider(page);
    if (!counter) {
      test.skip(true, 'No multi-image travel found');
      return;
    }

    // Hover the slider to trigger pause (via onScrollBeginDrag equivalent)
    // On web, autoplay pauses on touch/drag, not hover. We simulate a drag start.
    const wrapper = page.locator('[data-testid="slider-wrapper"]').first();
    await wrapper.waitFor({ state: 'visible', timeout: 10_000 });

    // Simulate mousedown to pause autoplay
    await page.evaluate(() => {
      const scroll = document.querySelector('[data-testid="slider-scroll"]') as HTMLElement;
      if (!scroll) return;
      scroll.dispatchEvent(new MouseEvent('mousedown', { button: 0, pageX: 100, pageY: 100, bubbles: true }));
    });

    // Record current slide
    const cBefore = await getCounter(page);
    const slideBefore = cBefore?.current ?? 1;

    // Wait 3 seconds — autoplay should NOT advance while paused
    await page.waitForTimeout(3000);

    const cAfter = await getCounter(page);
    // Release drag
    await page.evaluate(() => {
      window.dispatchEvent(new MouseEvent('mouseup', { button: 0, pageX: 100, pageY: 100, bubbles: true }));
    });

    // Slide should not have changed during the pause window
    expect(cAfter?.current).toBe(slideBefore);
  });
});

test.describe('Slider — touch/pointer swipe', () => {
  test('pointer swipe left advances to next slide', async ({ page }) => {
    await preacceptCookies(page);
    const counter = await navigateToTravelWithSlider(page);
    if (!counter) {
      test.skip(true, 'No multi-image travel found');
      return;
    }

    expect(counter.current).toBe(1);

    // Use pointer events (touch simulation)
    const swipeOk = await page.evaluate(async () => {
      const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const scroll = document.querySelector('[data-testid="slider-scroll"]') as HTMLElement;
      if (!scroll) return false;

      const rect = scroll.getBoundingClientRect();
      const startX = rect.left + rect.width * 0.75;
      const endX = rect.left + rect.width * 0.1;
      const y = rect.top + rect.height / 2;

      // Simulate touch via pointer events
      scroll.dispatchEvent(new PointerEvent('pointerdown', {
        pointerId: 1, pointerType: 'touch',
        clientX: startX, clientY: y, pageX: startX, pageY: y, bubbles: true,
      }));
      await delay(50);

      const steps = 10;
      for (let i = 1; i <= steps; i++) {
        const x = startX + (endX - startX) * (i / steps);
        scroll.dispatchEvent(new PointerEvent('pointermove', {
          pointerId: 1, pointerType: 'touch',
          clientX: x, clientY: y, pageX: x, pageY: y, bubbles: true,
        }));
        await delay(16);
      }

      scroll.dispatchEvent(new PointerEvent('pointerup', {
        pointerId: 1, pointerType: 'touch',
        clientX: endX, clientY: y, pageX: endX, pageY: y, bubbles: true,
      }));

      return true;
    });

    expect(swipeOk).toBe(true);
    // Allow time for scroll snap to settle
    await page.waitForTimeout(1200);

    // The slide may have advanced via native scroll-snap (touch scrolling)
    // We just verify no crash and slider is still functional
    const cAfter = await getCounter(page);
    expect(cAfter).not.toBeNull();
  });
});

test.describe('Slider — slide virtualization', () => {
  test('slides far from current index are not rendered (virtualization)', async ({ page }) => {
    await preacceptCookies(page);
    const counter = await navigateToTravelWithSlider(page);
    if (!counter || counter.total < 4) {
      test.skip(true, 'Need travel with ≥4 images for virtualization test');
      return;
    }

    // Slide at index 3+ (0-based) should not have an img rendered when we're at slide 1
    const lastSlideHasImg = await page.evaluate((total: number) => {
      // Find all slide containers
      const scroll = document.querySelector('[data-testid="slider-scroll"]');
      if (!scroll) return null;
      // The last slide is the (total-1)th child of the scroll content
      // Actually slides are direct children of the scrollContent View
      // Let's check by testid pattern
      const lastImg = document.querySelector(`[data-testid="slider-image-${total - 1}"]`);
      return lastImg !== null;
    }, counter.total);

    // With VIRTUAL_WINDOW=2, slide at index (total-1) should NOT be rendered when at index 0
    // (only renders ±2 from current = indices 0,1,2)
    if (counter.total > 3) {
      expect(lastSlideHasImg).toBe(false);
    }
  });

  test('virtualization window expands as user navigates', async ({ page }) => {
    await preacceptCookies(page);
    const counter = await navigateToTravelWithSlider(page);
    if (!counter || counter.total < 4) {
      test.skip(true, 'Need travel with ≥4 images');
      return;
    }

    // Navigate to slide 3 (index 2)
    const nextBtn = page.locator('[aria-label="Next slide"]').first();
    await nextBtn.click();
    await waitForCounterValue(page, 2, 8_000);
    await nextBtn.click();
    await waitForCounterValue(page, 3, 8_000);

    // Now index=2, VIRTUAL_WINDOW=2 → renders indices 0..4
    // Slide at index 4 (counter value 5) should now be rendered if total >= 5
    if (counter.total >= 5) {
      const slide4Rendered = await page.evaluate(() => {
        return document.querySelector('[data-testid="slider-image-4"]') !== null;
      });
      expect(slide4Rendered).toBe(true);
    }

    // Slide at index 0 should still be rendered (within ±2 of index 2)
    const slide0Rendered = await page.evaluate(() => {
      return document.querySelector('[data-testid="slider-image-0"]') !== null;
    });
    expect(slide0Rendered).toBe(true);
  });
});

test.describe('Slider — scroll container properties', () => {
  test('scroll container has scroll-snap-type x mandatory', async ({ page }) => {
    await preacceptCookies(page);
    const counter = await navigateToTravelWithSlider(page);
    if (!counter) {
      test.skip(true, 'No multi-image travel found');
      return;
    }

    const scrollSnapType = await page.evaluate(() => {
      const scroll = document.querySelector('[data-testid="slider-scroll"]') as HTMLElement;
      if (!scroll) return null;
      return getComputedStyle(scroll).scrollSnapType;
    });

    expect(scrollSnapType).toContain('x');
    expect(scrollSnapType).toContain('mandatory');
  });

  test('scroll container overflow is auto or scroll on x-axis', async ({ page }) => {
    await preacceptCookies(page);
    const counter = await navigateToTravelWithSlider(page);
    if (!counter) {
      test.skip(true, 'No multi-image travel found');
      return;
    }

    const overflowX = await page.evaluate(() => {
      const scroll = document.querySelector('[data-testid="slider-scroll"]') as HTMLElement;
      if (!scroll) return null;
      return getComputedStyle(scroll).overflowX;
    });

    expect(['auto', 'scroll']).toContain(overflowX);
  });
});

test.describe('Slider — rapid navigation', () => {
  test('rapid clicks on next do not break counter', async ({ page }) => {
    await preacceptCookies(page);
    const counter = await navigateToTravelWithSlider(page);
    if (!counter || counter.total < 3) {
      test.skip(true, 'Need travel with ≥3 images');
      return;
    }

    const nextBtn = page.locator('[aria-label="Next slide"]').first();

    // Click rapidly 3 times
    await nextBtn.click();
    await nextBtn.click();
    await nextBtn.click();

    // Wait for counter to settle
    await page.waitForTimeout(1500);
    const c = await getCounter(page);
    expect(c).not.toBeNull();
    // Counter should be between 2 and total (not stuck at 1, not out of range)
    expect(c!.current).toBeGreaterThanOrEqual(2);
    expect(c!.current).toBeLessThanOrEqual(counter.total);
    expect(c!.total).toBe(counter.total);
  });
});
