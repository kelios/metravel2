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

test.describe('Travel details should not flash Home', () => {
  test('opening /travels/:slug does not show Home hero text during initial load', async ({ page }) => {
    await preacceptCookies(page);

    // Force deterministic slow details load.
    let fulfilledOnce = false;
    await page.route('**/api/travels/by-slug/**', async (route: any, request: any) => {
      if (fulfilledOnce || request.method() !== 'GET') {
        await route.continue();
        return;
      }

      fulfilledOnce = true;
      await new Promise((r) => setTimeout(r, 1200));

      const mocked = {
        id: 999997,
        name: 'E2E No Flicker Travel',
        slug: 'e2e-no-flicker',
        url: '/travels/e2e-no-flicker',
        userName: 'E2E',
        cityName: 'E2E',
        countryName: 'E2E',
        countryCode: 'EE',
        countUnicIpView: '0',
        travel_image_thumb_url:
          'https://metravelprod.s3.eu-north-1.amazonaws.com/6880/conversions/p9edKtQrl2wM0xC1yRrkzVJEi4B4qxkxWqSADDLM-webpTravelMainImage_400.webp',
        travel_image_thumb_small_url:
          'https://metravelprod.s3.eu-north-1.amazonaws.com/6880/conversions/p9edKtQrl2wM0xC1yRrkzVJEi4B4qxkxWqSADDLM-webpTravelMainImage_400.webp',
        gallery: [],
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

    await page.goto('/travels/e2e-no-flicker', { waitUntil: 'domcontentloaded' });

    // Immediately after navigation, Home hero text should not be visible.
    // If Home flashes, this text is usually visible even very briefly.
    const homeHeroText = page.getByText('Пиши о своих путешествиях');

    // Wait a short window where flicker would be noticeable.
    await page.waitForTimeout(800);

    expect(await homeHeroText.isVisible().catch(() => false)).toBe(false);

    // Then the travel page should render.
    await expect(page.locator('[data-testid="travel-details-page"]')).toBeVisible({ timeout: 45_000 });
  });
});
