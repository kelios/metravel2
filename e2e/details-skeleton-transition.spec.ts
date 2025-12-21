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

test.describe('Travel details skeleton transition (no layout shift)', () => {
  test('details shows loading skeleton, then renders key blocks without big size jump', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await preacceptCookies(page);

    // Deterministic: delay and mock the travel-by-slug request.
    let fulfilledOnce = false;
    await page.route('**/api/travels/by-slug/**', async (route: any, request: any) => {
      if (fulfilledOnce || request.method() !== 'GET') {
        await route.continue();
        return;
      }

      fulfilledOnce = true;
      await new Promise((r) => setTimeout(r, 1500));

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

    // Loading skeleton should show.
    const loading = page.locator('[data-testid="travel-details-loading"]');
    await expect(loading).toBeVisible({ timeout: 30_000 });

    const skeletonHero = page.locator('[data-testid="travel-details-loading"]');
    const skeletonBox = await skeletonHero.boundingBox();
    expect(skeletonBox).not.toBeNull();

    // Wait for the real page to render.
    await expect(page.locator('[data-testid="travel-details-page"]')).toBeVisible({ timeout: 45_000 });
    await expect(page.locator('[data-testid="travel-details-hero"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="travel-details-quick-facts"]')).toHaveCount(1);

    // Basic stability check: main wrapper shouldn't drastically change size.
    const pageBox = await page.locator('[data-testid="travel-details-page"]').boundingBox();
    if (skeletonBox && pageBox) {
      const widthDiff = Math.abs(pageBox.width - skeletonBox.width);
      expect(widthDiff, `Width jump too large: ${widthDiff}px`).toBeLessThanOrEqual(60);
    }

    await assertNoHorizontalScroll(page);
  });
});
