import { test, expect } from '@playwright/test';

async function preacceptCookies(page: any) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem(
        'metravel_consent_v1',
        JSON.stringify({ necessary: true, analytics: false, date: new Date().toISOString() })
      );
    } catch {
      // ignore
    }

    // Keep base UI stable for the skeleton test.
    try {
      sessionStorage.setItem('recommendations_visible', 'false');
    } catch {
      // ignore
    }
  });
}

async function assertNoHorizontalScroll(page: any) {
  const res = await page.evaluate(() => {
    const docEl = document.documentElement;
    const body = document.body;
    return {
      docScrollWidth: docEl?.scrollWidth ?? 0,
      docClientWidth: docEl?.clientWidth ?? 0,
      bodyScrollWidth: body?.scrollWidth ?? 0,
      bodyClientWidth: body?.clientWidth ?? 0,
    };
  });

  expect(res.docScrollWidth).toBeLessThanOrEqual(res.docClientWidth);
  expect(res.bodyScrollWidth).toBeLessThanOrEqual(res.bodyClientWidth);
}

test.describe('Skeleton transition (no layout shift)', () => {
  test('main list shows skeleton, then replaces it with cards without big size jump', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await preacceptCookies(page);

    // Delay the travels list request so the skeleton is guaranteed to appear.
    let delayedOnce = false;
    await page.route('**/api/travels/**', async (route: any, request: any) => {
      const url = request.url();
      const isListRequest =
        request.method() === 'GET' &&
        url.includes('/api/travels') &&
        url.includes('where=') &&
        url.includes('perPage=');

      if (!delayedOnce && isListRequest) {
        delayedOnce = true;
        await new Promise((r) => setTimeout(r, 1200));
      }

      await route.continue();
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const listSkeleton = page.locator('[data-testid="list-travel-skeleton"]');
    await expect(listSkeleton).toBeVisible({ timeout: 30_000 });

    const skeletonCard = page.locator('[data-testid="list-travel-skeleton-card"]').first();
    await expect(skeletonCard).toBeVisible({ timeout: 30_000 });

    const skeletonBox = await skeletonCard.boundingBox();
    expect(skeletonBox).not.toBeNull();

    // Now wait for real content OR empty state.
    await Promise.race([
      page.waitForSelector('[data-testid="travel-card-link"]', { timeout: 45_000 }),
      page.waitForSelector('text=Пока нет путешествий', { timeout: 45_000 }),
    ]);

    // Skeleton should be gone once content is ready (we allow brief overlap, but final state should hide it).
    await expect(listSkeleton).toHaveCount(0, { timeout: 45_000 });

    // If there are cards, compare dimensions between skeleton and the first real card.
    const cards = page.locator('[data-testid="travel-card-link"]');
    const cardCount = await cards.count();

    if (cardCount > 0 && skeletonBox) {
      const firstCard = cards.first();
      await expect(firstCard).toBeVisible({ timeout: 30_000 });
      const cardBox = await firstCard.boundingBox();
      expect(cardBox).not.toBeNull();

      if (cardBox) {
        const widthDiff = Math.abs(cardBox.width - skeletonBox.width);
        const heightDiff = Math.abs(cardBox.height - skeletonBox.height);

        // Not pixel-perfect: just prevent major jumps.
        // Width should be close (mobile is single-column full width).
        expect(widthDiff, `Width jump too large: ${widthDiff}px`).toBeLessThanOrEqual(40);
        // Height can vary due to text length; allow more slack.
        expect(heightDiff, `Height jump too large: ${heightDiff}px`).toBeLessThanOrEqual(120);
      }
    }

    await assertNoHorizontalScroll(page);
  });
});
