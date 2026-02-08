import { test, expect } from './fixtures';
import { preacceptCookies, assertNoHorizontalScroll, tid } from './helpers/navigation';

test.describe('@perf Travel details skeleton transition (no layout shift)', () => {
  test('details shows loading skeleton, then renders key blocks without big size jump', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await preacceptCookies(page);

    // Deterministic: delay and mock the travel-by-slug request.
    let requestCount = 0;
    await page.route('**/api/travels/by-slug/**', async (route: any, request: any) => {
      if (request.method() !== 'GET') {
        await route.continue();
        return;
      }

      requestCount += 1;
      await new Promise((r) => setTimeout(r, requestCount === 1 ? 1500 : 250));

      const mocked = {
        id: 999998,
        name: 'E2E Details Skeleton Travel',
        slug: 'e2e-details-skeleton',
        url: '/travels/e2e-details-skeleton',
        userName: 'E2E',
        cityName: 'E2E',
        countryName: 'E2E',
        countryCode: 'EE',
        countUnicIpView: '0',
        travel_image_thumb_url:
          'https://metravelprod.s3.eu-north-1.amazonaws.com/6880/conversions/p9edKtQrl2wM0xC1yRrkzVJEi4B4qxkxWqSADDLM-webpTravelMainImage_400.webp',
        travel_image_thumb_small_url:
          'https://metravelprod.s3.eu-north-1.amazonaws.com/6880/conversions/p9edKtQrl2wM0xC1yRrkzVJEi4B4qxkxWqSADDLM-webpTravelMainImage_400.webp',
        gallery: [
          {
            id: 1,
            url: 'https://metravelprod.s3.eu-north-1.amazonaws.com/6880/conversions/p9edKtQrl2wM0xC1yRrkzVJEi4B4qxkxWqSADDLM-webpTravelMainImage_400.webp',
            width: 1200,
            height: 800,
            updated_at: '2025-01-01T00:00:00.000Z',
          },
        ],
        travelAddress: [],
        year: '2025',
        monthName: 'Январь',
        number_days: 1,
        companions: [],
        youtube_link: '',
        description: '<p>E2E</p>',
        recommendation: '',
        plus: '',
        minus: '',
        userIds: '',
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mocked),
      });
    });

    await page.goto('/travels/e2e-details-skeleton', { waitUntil: 'domcontentloaded' });

    // Loading skeleton can be skipped if the page resolves very quickly.
    const loading = page.locator(tid('travel-details-loading'));
    const pageRoot = page.locator(tid('travel-details-page'));

    await Promise.race([
      loading.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => null),
      pageRoot.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => null),
    ]);

    const skeletonBox = (await loading.isVisible().catch(() => false)) ? await loading.boundingBox() : null;

    // Wait for the real page to render.
    await expect(page.locator(tid('travel-details-page'))).toBeVisible({ timeout: 45_000 });
    await expect(page.locator(tid('travel-details-hero'))).toHaveCount(1);
    await expect(page.locator(tid('travel-details-quick-facts'))).toHaveCount(1);

    // Basic stability check: main wrapper shouldn't drastically change size.
    const pageBox = await page.locator(tid('travel-details-page')).boundingBox();
    if (skeletonBox && pageBox) {
      const widthDiff = Math.abs(pageBox.width - skeletonBox.width);
      expect(widthDiff, `Width jump too large: ${widthDiff}px`).toBeLessThanOrEqual(60);
    }

    await assertNoHorizontalScroll(page);
  });
});
