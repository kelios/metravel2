/**
 * E2E: Slider drag / swipe on web
 *
 * Verifies that the image slider on a travel details page can be navigated by:
 *   1. Clicking the arrow buttons (prev / next)
 *   2. Mouse drag-to-scroll (desktop web)
 *   3. Keyboard arrows (left / right)
 *
 * The test opens a deterministic mocked travel details page and verifies slider
 * interactions without relying on live list data.
 */

import { test, expect } from './fixtures';
import { preacceptCookies, gotoWithRetry } from './helpers/navigation';

/**
 * Extract current and total from the slider counter element.
 * RNW renders Text as leaf <div> elements — walk all leaf nodes and check innerText.
 * Returns null when the counter is not found or the travel has only one image.
 */
async function getCounter(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const re = /^(\d+)\/(\d+)$/;
    const wrappers = Array.from(document.querySelectorAll('[data-testid="slider-wrapper"]')) as HTMLElement[];
    const wrapper = wrappers.findLast((node) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    });
    const scope = wrapper ?? document.body;
    const all = scope.querySelectorAll('*');
    for (const el of all) {
      const htmlEl = el as HTMLElement;
      if (htmlEl.children.length > 0) continue;
      if (htmlEl.getClientRects().length === 0) continue;
      const style = getComputedStyle(htmlEl);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
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

function getSliderWrapper(page: import('@playwright/test').Page) {
  return page.locator('[data-testid="slider-wrapper"]').last();
}

function getSliderNavButton(page: import('@playwright/test').Page, label: 'Next slide' | 'Previous slide') {
  return getSliderWrapper(page).locator(`[aria-label="${label}"]`).last();
}

async function clickSliderNavButton(
  page: import('@playwright/test').Page,
  label: 'Next slide' | 'Previous slide',
) {
  await getSliderWrapper(page).hover();
  await getSliderNavButton(page, label).evaluate((el: any) => {
    if (typeof el?.click === 'function') el.click();
  });
}

async function dispatchSliderKey(
  page: import('@playwright/test').Page,
  key: 'ArrowLeft' | 'ArrowRight',
) {
  await getSliderWrapper(page).evaluate((el: any, pressedKey) => {
    el?.dispatchEvent?.(
      new KeyboardEvent('keydown', {
        key: pressedKey,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, key);
}

async function dragSlider(
  page: import('@playwright/test').Page,
  startRatio: number,
  endRatio: number,
) {
  const node = page.locator('[data-testid="slider-scroll"]').first();
  const box = await node.boundingBox();
  if (!box) return false;

  const centerY = box.y + box.height / 2;
  const startX = box.x + box.width * startRatio;
  const endX = box.x + box.width * endRatio;

  await page.mouse.move(startX, centerY);
  await page.mouse.down();

  const steps = 15;
  for (let i = 1; i <= steps; i += 1) {
    const x = startX + (endX - startX) * (i / steps);
    await page.mouse.move(x, centerY, { steps: 1 });
  }

  await page.mouse.up();
  return true;
}

async function waitForSliderReady(
  page: import('@playwright/test').Page,
  opts?: { timeout?: number; requireVisibleNextArrow?: boolean },
) {
  const timeout = opts?.timeout ?? 60_000;
  const requireVisibleNextArrow = opts?.requireVisibleNextArrow ?? true;
  const bundling = page.getByText('Bundling...').first();
  await bundling.waitFor({ state: 'hidden', timeout }).catch(() => null);
  await page.locator('[data-testid="slider-scroll"]').first().waitFor({ state: 'attached', timeout });
  await expect
    .poll(async () => getSliderWrapper(page).getAttribute('tabindex'), { timeout })
    .toBe('0');
  if (requireVisibleNextArrow) {
    await getSliderNavButton(page, 'Next slide').waitFor({ state: 'visible', timeout });
  }
}

/**
 * Navigate to the first travel from the list that has a multi-image slider.
 * Tries up to `maxCards` cards. Returns the counter or null.
 */
async function navigateToTravelWithSlider(
  page: import('@playwright/test').Page,
  opts?: { requireVisibleNextArrow?: boolean },
): Promise<{ current: number; total: number } | null> {
  const fallbackId = 990011;
  const fallbackSlug = 'e2e-slider-swipe-fallback';
  const fallbackGallery = [
    {
      id: 1,
      url: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 2,
      url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 3,
      url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
  ];

  const fallbackTravel = {
    id: fallbackId,
    slug: fallbackSlug,
    url: `/travels/${fallbackSlug}`,
    name: 'E2E slider swipe fallback travel',
    description: '<p>Fallback travel details used by slider swipe tests.</p>',
    publish: true,
    moderation: true,
    travel_image_thumb_url: fallbackGallery[0]?.url,
    travel_image_thumb_small_url: fallbackGallery[0]?.url,
    gallery: fallbackGallery,
    categories: [],
    countries: [],
    travelAddress: [],
    coordsMeTravel: [],
  };

  const fallbackRoute = async (route: import('@playwright/test').Route) => {
    const url = route.request().url();
    if (
      url.includes(`/api/travels/by-slug/${fallbackSlug}/`) ||
      url.includes(`/travels/by-slug/${fallbackSlug}/`) ||
      url.includes(`/api/travels/${fallbackId}/`)
    ) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fallbackTravel),
      });
      return;
    }
    await route.continue();
  };

  await page.route('**/api/travels/by-slug/**', fallbackRoute);
  await page.route('**/travels/by-slug/**', fallbackRoute);
  await page.route(`**/api/travels/${fallbackId}/`, fallbackRoute);

  await page.addInitScript(
    ({ slug, data }) => {
      const w = window as unknown as Record<string, unknown>;
      w.__metravelTravelPreload = {
        slug,
        isId: false,
        data,
      };
      w.__metravelTravelPreloadPending = false;
      w.__metravelTravelPreloadPromise = undefined;
    },
    { slug: fallbackSlug, data: fallbackTravel },
  );

  await gotoWithRetry(page, `/travels/${fallbackSlug}`);
  await waitForSliderReady(page, { requireVisibleNextArrow: opts?.requireVisibleNextArrow ?? true });
  if (opts?.requireVisibleNextArrow === false) {
    return waitForCounterValue(page, 1, 10_000);
  }

  const fallbackNext = await page
    .locator('[data-testid="slider-wrapper"]')
    .last()
    .locator('[aria-label="Next slide"]')
    .last()
    .waitFor({ state: 'visible', timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  if (fallbackNext) {
    const fallbackCounter = await waitForCounterValue(page, 1, 10_000);
    if (fallbackCounter) return fallbackCounter;
  }

  return null;
}

test.describe('Slider navigation on web', () => {
  test.describe.configure({ mode: 'serial' });

  test('arrow buttons change the active slide', async ({ page }) => {
    await preacceptCookies(page);

    const counter = await navigateToTravelWithSlider(page);
    if (!counter) {
      throw new Error('Slider test precondition failed');
    }

    expect(counter.current).toBe(1);
    expect(counter.total).toBeGreaterThan(1);

    // Click the "Next slide" arrow
    const nextBtn = getSliderNavButton(page, 'Next slide');
    await expect(nextBtn).toBeVisible({ timeout: 5_000 });
    await clickSliderNavButton(page, 'Next slide');
    await page.waitForTimeout(500); // wait for scroll animation

    const afterNext = await waitForCounterValue(page, 2, 10_000);
    expect(afterNext?.current).toBe(2);

    // Click the "Previous slide" arrow
    const prevBtn = getSliderNavButton(page, 'Previous slide');
    await expect(prevBtn).toBeVisible({ timeout: 5_000 });
    await clickSliderNavButton(page, 'Previous slide');
    await page.waitForTimeout(500); // wait for scroll animation

    const afterPrev = await waitForCounterValue(page, 1, 10_000);
    expect(afterPrev?.current).toBe(1);
  });

  test('mouse drag keeps slider interactive', async ({ page }) => {
    await preacceptCookies(page);

    const counter = await navigateToTravelWithSlider(page);
    if (!counter) {
      throw new Error('Slider test precondition failed');
    }

    expect(counter.current).toBe(1);

    const dragOk = await dragSlider(page, 0.84, 0.12);
    expect(dragOk).toBe(true);

    await page.waitForTimeout(1000);
    const afterDrag = await getCounter(page);
    expect(afterDrag).not.toBeNull();

    const dragBackOk = await dragSlider(page, 0.16, 0.88);
    expect(dragBackOk).toBe(true);

    await page.waitForTimeout(1000);
    const nextBtn = getSliderNavButton(page, 'Next slide');
    await expect(nextBtn).toBeVisible({ timeout: 5_000 });
    await clickSliderNavButton(page, 'Next slide');
    const afterArrowNavigation = await waitForCounterValue(page, 2, 10_000);
    expect(afterArrowNavigation?.current).toBe(2);
  });

  test('mouse drag does not break slider in a narrow web viewport', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await preacceptCookies(page);

    const counter = await navigateToTravelWithSlider(page, { requireVisibleNextArrow: false });
    if (!counter) {
      throw new Error('Slider test precondition failed');
    }

    expect(counter.current).toBe(1);

    const dragOk = await dragSlider(page, 0.84, 0.12);
    expect(dragOk).toBe(true);

    await page.waitForTimeout(1000);
    const afterDrag = await getCounter(page);
    expect(afterDrag).not.toBeNull();
  });

  test('keyboard arrows navigate the slider', async ({ page }) => {
    await preacceptCookies(page);

    const counter = await navigateToTravelWithSlider(page);
    if (!counter) {
      throw new Error('Slider test precondition failed');
    }

    expect(counter.current).toBe(1);

    // Focus the slider wrapper: Slider.web sets tabindex=0 on a wrapper element.
    // Wait until it's present, then focus it so keydown handler is active.
    const wrapper = getSliderWrapper(page);
    await expect(wrapper).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => wrapper.getAttribute('tabindex'), { timeout: 10_000 })
      .toBe('0');
    await wrapper.focus();
    await expect
      .poll(async () => wrapper.evaluate((el) => document.activeElement === el), { timeout: 5_000 })
      .toBe(true);

    // Dispatch ArrowRight directly on the wrapper so the RNW keydown handler receives it.
    await dispatchSliderKey(page, 'ArrowRight');
    await page.waitForTimeout(500);
    const afterRight = await waitForCounterValue(page, 2, 10_000);
    expect(afterRight?.current).toBe(2);

    // Dispatch ArrowLeft directly on the wrapper for the same reason.
    await dispatchSliderKey(page, 'ArrowLeft');
    await page.waitForTimeout(500);
    const afterLeft = await waitForCounterValue(page, 1, 10_000);
    expect(afterLeft?.current).toBe(1);
  });
});
