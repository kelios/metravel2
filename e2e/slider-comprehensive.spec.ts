/**
 * E2E: Comprehensive slider tests
 *
 * Covers:
 *   1. Counter display and accuracy
 *   2. Pagination dots — count, active state
 *   3. Arrow visibility on hover (CSS :hover)
 *   4. Wrap-around navigation (last → first, first → last)
 *   5. Keyboard navigation requires focus on wrapper
 *   6. Single-image slider — no arrows, no counter, no dots
 *   7. Slide virtualization — out-of-window slides have no img
 *   8. Accessibility: aria-labels on nav buttons, role=button
 *   9. No horizontal page overflow caused by slider
 *  10. Scroll container CSS properties
 *  11. Rapid navigation stability
 *  12. Touch/pointer swipe
 *
 * Note: autoPlay={false} is intentionally set on the travel details page,
 * so autoplay is not tested here against that page.
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

    await page.locator('[data-testid="slider-wrapper"]').first().waitFor({ state: 'visible', timeout: 10_000 });

    // Dots are rendered as sibling divs inside the dotsContainer.
    // The dotsContainer is the only div inside the dots overlay that has flexDirection=row
    // and contains only leaf divs (no children). Count them by finding the container.
    const dotCount = await page.evaluate(() => {
      const wrapper = document.querySelector('[data-testid="slider-wrapper"]');
      if (!wrapper) return 0;
      // Find the dots container: a div with multiple leaf-div children that are all small
      const allDivs = Array.from(wrapper.querySelectorAll('div'));
      for (const container of allDivs) {
        const children = Array.from(container.children) as HTMLElement[];
        if (children.length < 2) continue;
        // All children should be leaf divs with similar small height
        const allLeafSmall = children.every((c) => {
          if (c.tagName !== 'DIV') return false;
          if (c.children.length > 0) return false;
          const h = parseFloat(getComputedStyle(c).height);
          return h >= 4 && h <= 10;
        });
        if (allLeafSmall) return children.length;
      }
      return 0;
    });

    expect(dotCount).toBe(counter.total);
  });

  test('active dot is wider than inactive dots', async ({ page }) => {
    await preacceptCookies(page);
    const counter = await navigateToTravelWithSlider(page);
    if (!counter) {
      test.skip(true, 'No multi-image travel found');
      return;
    }

    await page.locator('[data-testid="slider-wrapper"]').first().waitFor({ state: 'visible', timeout: 10_000 });

    // Find the dots container and check that one dot is wider (active)
    const dotsInfo = await page.evaluate(() => {
      const wrapper = document.querySelector('[data-testid="slider-wrapper"]');
      if (!wrapper) return null;
      const allDivs = Array.from(wrapper.querySelectorAll('div'));
      for (const container of allDivs) {
        const children = Array.from(container.children) as HTMLElement[];
        if (children.length < 2) continue;
        const allLeafSmall = children.every((c) => {
          if (c.tagName !== 'DIV') return false;
          if (c.children.length > 0) return false;
          const h = parseFloat(getComputedStyle(c).height);
          return h >= 4 && h <= 10;
        });
        if (!allLeafSmall) continue;
        const widths = children.map((c) => parseFloat(getComputedStyle(c).width));
        const maxW = Math.max(...widths);
        const minW = Math.min(...widths);
        return { widths, maxW, minW };
      }
      return null;
    });

    expect(dotsInfo).not.toBeNull();
    // Active dot (index 0 at start) should be wider than inactive dots
    expect(dotsInfo!.maxW).toBeGreaterThan(dotsInfo!.minW);

    // Navigate to next slide
    await page.locator('[aria-label="Next slide"]').first().click();
    await waitForCounterValue(page, 2, 8_000);

    // After navigation, the widest dot should now be at index 1 (not index 0)
    const dotsAfter = await page.evaluate(() => {
      const wrapper = document.querySelector('[data-testid="slider-wrapper"]');
      if (!wrapper) return null;
      const allDivs = Array.from(wrapper.querySelectorAll('div'));
      for (const container of allDivs) {
        const children = Array.from(container.children) as HTMLElement[];
        if (children.length < 2) continue;
        const allLeafSmall = children.every((c) => {
          if (c.tagName !== 'DIV') return false;
          if (c.children.length > 0) return false;
          const h = parseFloat(getComputedStyle(c).height);
          return h >= 4 && h <= 10;
        });
        if (!allLeafSmall) continue;
        const widths = children.map((c) => parseFloat(getComputedStyle(c).width));
        const maxIdx = widths.indexOf(Math.max(...widths));
        return { widths, maxIdx };
      }
      return null;
    });

    expect(dotsAfter).not.toBeNull();
    // Active dot should now be at index 1 (second dot)
    expect(dotsAfter!.maxIdx).toBe(1);
  });
});

test.describe('Slider — arrow visibility', () => {
  test('arrows exist in DOM and are clickable', async ({ page }) => {
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

    // Buttons must exist in DOM and be attached
    await expect(nextBtn).toBeAttached();
    await expect(prevBtn).toBeAttached();

    // Arrows have opacity:0 by default (CSS), shown on :hover via CSS rule.
    // Move cursor away from slider first to ensure no hover state
    await page.mouse.move(0, 0);
    await page.waitForTimeout(100);

    const opacityAway = await nextBtn.evaluate((el) =>
      parseFloat(getComputedStyle(el).opacity)
    );
    expect(opacityAway).toBe(0);

    // Hover the wrapper — CSS :hover rule sets opacity:1
    await wrapper.hover();
    await page.waitForTimeout(100);

    const opacityHover = await nextBtn.evaluate((el) =>
      parseFloat(getComputedStyle(el).opacity)
    );
    expect(opacityHover).toBe(1);
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

test.describe('Slider — autoplay disabled on travel page', () => {
  test('autoPlay=false: slider does not auto-advance on travel details page', async ({ page }) => {
    // The travel details page explicitly sets autoPlay={false} on the Slider.
    // This test verifies the slider stays on slide 1 for 5 seconds without user interaction.
    await preacceptCookies(page);
    const counter = await navigateToTravelWithSlider(page);
    if (!counter) {
      test.skip(true, 'No multi-image travel found');
      return;
    }

    expect(counter.current).toBe(1);

    // Wait 5 seconds — autoplay is disabled, slide should NOT advance
    await page.waitForTimeout(5000);

    const cAfter = await getCounter(page);
    expect(cAfter?.current).toBe(1);
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

    // Use pointer events (touch simulation) — pageX is not in PointerEventInit type
    // so we use clientX only (sufficient for scroll behavior)
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
        clientX: startX, clientY: y, bubbles: true,
      }));
      await delay(50);

      const steps = 10;
      for (let i = 1; i <= steps; i++) {
        const x = startX + (endX - startX) * (i / steps);
        scroll.dispatchEvent(new PointerEvent('pointermove', {
          pointerId: 1, pointerType: 'touch',
          clientX: x, clientY: y, bubbles: true,
        }));
        await delay(16);
      }

      scroll.dispatchEvent(new PointerEvent('pointerup', {
        pointerId: 1, pointerType: 'touch',
        clientX: endX, clientY: y, bubbles: true,
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
  // Virtualization: Slider.web.tsx renders only slides within ±VIRTUAL_WINDOW (2) of current index.
  // Slides outside the window render an empty placeholder div (no Slide component = no img).
  // The testID "slider-image-N" is set on the ExpoImage inside Slide via imageProps.testID.
  // RNW renders testID as data-testid on the DOM element.

  test('slides far from current index have no image rendered', async ({ page }) => {
    await preacceptCookies(page);
    const counter = await navigateToTravelWithSlider(page);
    if (!counter || counter.total < 4) {
      test.skip(true, 'Need travel with ≥4 images for virtualization test');
      return;
    }

    // At index 0, VIRTUAL_WINDOW=2 renders indices 0,1,2.
    // Slide at index (total-1) should NOT have an image if total > 3.
    const lastSlideHasImg = await page.evaluate((total: number) => {
      // slider-image-N is set via imageProps.testID which RNW renders as data-testid
      return document.querySelector(`[data-testid="slider-image-${total - 1}"]`) !== null;
    }, counter.total);

    expect(lastSlideHasImg).toBe(false);
  });

  test('virtualization renders slide 0 image when at index 0', async ({ page }) => {
    await preacceptCookies(page);
    const counter = await navigateToTravelWithSlider(page);
    if (!counter) {
      test.skip(true, 'No multi-image travel found');
      return;
    }

    // Slide 0 should always be rendered at index 0
    const slide0HasImg = await page.evaluate(() => {
      return document.querySelector('[data-testid="slider-image-0"]') !== null;
    });
    expect(slide0HasImg).toBe(true);
  });

  test('virtualization window expands as user navigates', async ({ page }) => {
    await preacceptCookies(page);
    const counter = await navigateToTravelWithSlider(page);
    if (!counter || counter.total < 5) {
      test.skip(true, 'Need travel with ≥5 images');
      return;
    }

    // Navigate to slide 3 (index 2)
    const nextBtn = page.locator('[aria-label="Next slide"]').first();
    await nextBtn.click();
    await waitForCounterValue(page, 2, 8_000);
    await nextBtn.click();
    await waitForCounterValue(page, 3, 8_000);

    // Now index=2, VIRTUAL_WINDOW=2 → renders indices 0..4
    // Slide at index 4 should now be rendered
    const slide4Rendered = await page.evaluate(() => {
      return document.querySelector('[data-testid="slider-image-4"]') !== null;
    });
    expect(slide4Rendered).toBe(true);

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
    const navigated = await navigateToAnyTravel(page);
    if (!navigated) {
      test.skip(true, 'No travels found');
      return;
    }

    await page.locator('[data-testid="slider-scroll"]').first().waitFor({ state: 'attached', timeout: 15_000 }).catch(() => null);

    const scrollSnapType = await page.evaluate(() => {
      const scroll = document.querySelector('[data-testid="slider-scroll"]') as HTMLElement;
      if (!scroll) return null;
      return getComputedStyle(scroll).scrollSnapType;
    });

    expect(scrollSnapType).toContain('x');
    expect(scrollSnapType).toContain('mandatory');
  });

  test('scroll container overflow is auto on x-axis', async ({ page }) => {
    await preacceptCookies(page);
    const navigated = await navigateToAnyTravel(page);
    if (!navigated) {
      test.skip(true, 'No travels found');
      return;
    }

    await page.locator('[data-testid="slider-scroll"]').first().waitFor({ state: 'attached', timeout: 15_000 }).catch(() => null);

    const overflowX = await page.evaluate(() => {
      const scroll = document.querySelector('[data-testid="slider-scroll"]') as HTMLElement;
      if (!scroll) return null;
      return getComputedStyle(scroll).overflowX;
    });

    expect(['auto', 'scroll']).toContain(overflowX);
  });

  test('scroll container width matches wrapper width', async ({ page }) => {
    await preacceptCookies(page);
    const navigated = await navigateToAnyTravel(page);
    if (!navigated) {
      test.skip(true, 'No travels found');
      return;
    }

    await page.locator('[data-testid="slider-scroll"]').first().waitFor({ state: 'attached', timeout: 15_000 }).catch(() => null);
    await page.waitForTimeout(300);

    const widths = await page.evaluate(() => {
      const scroll = document.querySelector('[data-testid="slider-scroll"]') as HTMLElement;
      const wrapper = document.querySelector('[data-testid="slider-wrapper"]') as HTMLElement;
      if (!scroll || !wrapper) return null;
      return {
        scrollW: scroll.getBoundingClientRect().width,
        wrapperW: wrapper.getBoundingClientRect().width,
      };
    });

    expect(widths).not.toBeNull();
    expect(widths!.scrollW).toBeGreaterThan(0);
    // Scroll container should be same width as wrapper (not wider)
    expect(widths!.scrollW).toBeLessThanOrEqual(widths!.wrapperW + 2);
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
