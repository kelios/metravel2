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

async function gotoWithRetry(page: any, url: string) {
  let lastError: any = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
       
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      lastError = null;
      break;
    } catch (e) {
      lastError = e;
      const msg = String((e as any)?.message ?? e ?? '');
      const isTransient =
        msg.includes('ERR_CONNECTION_REFUSED') ||
        msg.includes('ERR_EMPTY_RESPONSE') ||
        msg.includes('NS_ERROR_NET_RESET') ||
        msg.includes('net::');

      if (typeof page?.isClosed === 'function' && page.isClosed()) break;

       
      try {
        await page.waitForTimeout(isTransient ? Math.min(1200 + attempt * 600, 8000) : 500);
      } catch {
        break;
      }
    }
  }
  if (lastError) throw lastError;
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

    await gotoWithRetry(page, '/');

    const search = page.getByRole('textbox', { name: /Поиск путешествий/i });
    await expect(search).toBeVisible({ timeout: 30_000 });

    // Main page uses TravelListSkeleton -> TravelCardSkeleton.
    const skeletonCard = page.locator('[data-testid="travel-card-skeleton"]').first();
    await expect(skeletonCard).toBeVisible({ timeout: 30_000 });

    // Capture skeleton dimensions immediately (avoid flakiness if skeleton disappears quickly).
    const skeletonHandle = await skeletonCard.elementHandle();
    const skeletonBox = skeletonHandle ? await skeletonHandle.boundingBox() : null;
    expect(skeletonBox).not.toBeNull();

    // Invariant during loading: web-mobile footer dock must not render as a vertical list.
    // This guards against SSR/hydration/layout flashes where footer items stack.
    const dock = page.getByTestId('footer-dock-wrapper');
    await expect(dock).toBeVisible({ timeout: 30_000 });
    // Stroboscopic guard: catch transient oversized/vertical dock during the first second.
    for (let i = 0; i < 10; i++) {
      // Desktop footer must not flash on mobile during loading.
       
      await expect(page.getByTestId('footer-desktop-bar')).toHaveCount(0);

       
      const h = await dock.boundingBox().then((b: any) => (b ? b.height : 0));
      expect(h, `footer dock must be compact during loading (height=${h}px, sample=${i})`).toBeLessThanOrEqual(120);

      const dockInteractive = dock.locator('[role="link"], [role="button"]');
       
      const cnt = await dockInteractive.count();
      if (cnt >= 2) {
         
        const [b0, b1] = await Promise.all([
          dockInteractive.nth(0).boundingBox(),
          dockInteractive.nth(1).boundingBox(),
        ]);
        expect(b0, 'expected first dock item to have a bounding box during loading').not.toBeNull();
        expect(b1, 'expected second dock item to have a bounding box during loading').not.toBeNull();
        if (b0 && b1) {
          const yDiff = Math.abs(b0.y - b1.y);
          expect(yDiff, `footer dock must be single-row during loading (yDiff=${yDiff}px, sample=${i})`).toBeLessThanOrEqual(10);
        }
      }

       
      await page.waitForTimeout(100);
    }

    // Performance invariant: on web-mobile the skeleton card must not be excessively tall.
    // This catches regressions where skeleton height is wrong and causes large layout shifts.
    if (skeletonBox) {
      expect(
        skeletonBox.height,
        `Unexpected skeleton card height on mobile: ${skeletonBox.height}px`
      ).toBeLessThanOrEqual(360);
      expect(
        skeletonBox.height,
        `Unexpected skeleton card height on mobile: ${skeletonBox.height}px`
      ).toBeGreaterThanOrEqual(280);
    }

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
        // Height should be very close. Big jumps here usually indicate wrong skeleton height,
        // which increases CLS and hurts perceived performance.
        expect(heightDiff, `Height jump too large: ${heightDiff}px`).toBeLessThanOrEqual(60);
      }
    }

    await assertNoHorizontalScroll(page);
  });
});
