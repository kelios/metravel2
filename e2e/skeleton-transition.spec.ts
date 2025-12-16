import { test, expect } from '@playwright/test';

async function preacceptCookies(page: any) {
  await page.addInitScript(() => {
    try {
      // Ensure no cached UI/state prevents skeleton from showing.
      window.sessionStorage.clear();
      // Keep localStorage mostly intact, but clear likely non-critical caches.
      // Do not clear consent key we set below.
    } catch {
      // ignore
    }

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

    // Deterministic skeleton: delay and then mock the very first travels list response.
    // This guarantees we see the skeleton and then transition to a real card.
    let fulfilledOnce = false;
    await page.route('**/api/travels/**', async (route: any, request: any) => {
      const url = request.url();
      const isListRequest =
        !fulfilledOnce &&
        request.method() === 'GET' &&
        /\/api\/travels\/?\?/.test(url) &&
        url.includes('where=') &&
        url.includes('perPage=');

      if (!isListRequest) {
        await route.continue();
        return;
      }

      fulfilledOnce = true;
      await new Promise((r) => setTimeout(r, 1500));

      const mocked = {
        data: [
          {
            id: 999999,
            name: 'E2E Skeleton Travel',
            slug: 'e2e-skeleton-travel',
            url: '/travels/e2e-skeleton-travel',
            travel_image_thumb_url:
              'https://metravelprod.s3.eu-north-1.amazonaws.com/6880/conversions/p9edKtQrl2wM0xC1yRrkzVJEi4B4qxkxWqSADDLM-webpTravelMainImage_400.webp',
            travel_image_thumb_small_url:
              'https://metravelprod.s3.eu-north-1.amazonaws.com/6880/conversions/p9edKtQrl2wM0xC1yRrkzVJEi4B4qxkxWqSADDLM-webpTravelMainImage_400.webp',
            userName: 'E2E',
            cityName: 'E2E',
            countryName: 'E2E',
            countryCode: 'EE',
            gallery: [],
            travelAddress: [],
            year: '2025',
            monthName: 'Январь',
            number_days: 1,
            companions: [],
            youtube_link: '',
            description: '',
            recommendation: '',
            plus: '',
            minus: '',
            countUnicIpView: '0',
            userIds: '',
          },
        ],
        total: 1,
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mocked),
      });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const search = page.getByRole('textbox', { name: /Поиск путешествий/i });
    await expect(search).toBeVisible({ timeout: 30_000 });

    // Main page uses TravelListSkeleton -> TravelCardSkeleton.
    const skeletonCard = page.locator('[data-testid="travel-card-skeleton"]').first();
    await expect(skeletonCard).toBeVisible({ timeout: 30_000 });

    const skeletonBox = await skeletonCard.boundingBox();
    expect(skeletonBox).not.toBeNull();

    // Now wait for real content.
    await page.waitForSelector('[data-testid="travel-card-link"]', { timeout: 45_000 });

    // Skeleton should be gone once content is ready (final state should hide it).
    await expect(page.locator('[data-testid="travel-card-skeleton"]')).toHaveCount(0, { timeout: 45_000 });

    // If there are cards, compare dimensions between skeleton and the first real card.
    const cards = page.locator('[data-testid="travel-card"]');
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
