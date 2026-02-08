import { test, expect } from './fixtures';
import { gotoWithRetry, assertNoHorizontalScroll } from './helpers/navigation';
import { getTravelsListPath } from './helpers/routes';
import { hideRecommendationsBanner, seedNecessaryConsent } from './helpers/storage';

// Skeleton-specific: also clears sessionStorage to ensure skeleton is visible.
async function preacceptCookies(page: any) {
  await page.addInitScript(() => {
    try {
      window.sessionStorage.clear();
    } catch {
      // ignore
    }
  });
  await page.addInitScript(seedNecessaryConsent);
  await page.addInitScript(hideRecommendationsBanner);
}

test.describe('@perf Skeleton transition (no layout shift)', () => {
  test('main list shows skeleton, then replaces it with cards without big size jump', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await preacceptCookies(page);

    // Deterministic skeleton: delay and then mock the very first travels list response.
    // This guarantees we see the skeleton and then transition to a real card.
    let fulfilledOnce = false;
    await page.route(/\/api\/(?:p\/)?travels\//, async (route: any, request: any) => {
      const url = request.url();
      const isListRequest =
        !fulfilledOnce &&
        request.method() === 'GET' &&
        /\/api\/(?:p\/)?travels\/?\?/.test(url) &&
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

    await gotoWithRetry(page, getTravelsListPath());

    const search = page.getByRole('textbox', { name: /Поиск путешествий/i });
    await expect(search).toBeVisible({ timeout: 30_000 });

    // Main page uses TravelListSkeleton -> TravelCardSkeleton.
    // But if data resolves very quickly, skeleton may not appear.
    const skeletonCard = page.locator('[data-testid="travel-card-skeleton"]').first();
    const cardLink = page.locator('[data-testid="travel-card-link"]').first();

    await Promise.race([
      skeletonCard.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => null),
      cardLink.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => null),
    ]);

    const hasSkeleton = (await skeletonCard.count()) > 0 && (await skeletonCard.isVisible().catch(() => false));

    // Capture skeleton dimensions immediately (avoid flakiness if skeleton disappears quickly).
    const skeletonHandle = hasSkeleton ? await skeletonCard.elementHandle() : null;
    const skeletonBox = skeletonHandle ? await skeletonHandle.boundingBox() : null;

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

      const dockItem0 = dock.getByTestId('footer-item-home');
      const dockItem1 = dock.getByTestId('footer-item-search');

      const has0 = (await dockItem0.count()) > 0;
      const has1 = (await dockItem1.count()) > 0;
      if (has0 && has1) {
        await Promise.all([
          dockItem0.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => null),
          dockItem1.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => null),
        ]);

        const [b0, b1] = await Promise.all([
          dockItem0.boundingBox(),
          dockItem1.boundingBox(),
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
    // If it never appeared, this is already satisfied.
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
