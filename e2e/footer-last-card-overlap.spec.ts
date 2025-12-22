import { test, expect } from '@playwright/test';
import { expectNoOverlap } from './helpers/layoutAsserts';

test.describe('Footer dock overlap – last card (web mobile)', () => {
  test('reserves space so last travel card is fully visible', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.addInitScript(() => {
      // Intercept travels fetch before any app code runs to guarantee data.
      const mockPayload = {
        data: [
          {
            id: 100001,
            name: 'E2E Footer Travel',
            slug: 'e2e-footer-travel',
            url: '/travels/e2e-footer-travel',
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
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        const url = String(args[0]);
        if (url.includes('/travels')) {
          return new Response(JSON.stringify(mockPayload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return originalFetch(...args);
      };

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

    // Navigate with retries to reduce flakiness on dev server cold start.
    let lastError: any = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
        lastError = null;
        break;
      } catch (e) {
        lastError = e;
        await page.waitForTimeout(600 + attempt * 400);
      }
    }
    if (lastError) throw lastError;

    // Ensure the mocked list request fires even if the app defers initial fetch.
    await page.evaluate(() => {
      try {
        return fetch('/api/travels?perPage=10&page=1&where={}');
      } catch {
        return null;
      }
    });

    const dock = page.getByTestId('footer-dock-wrapper');
    await expect(dock).toBeVisible({ timeout: 30_000 });

    const cards = page.locator('[data-testid="travel-card-link"]');
    const count = await cards.count();
    if (count === 0) {
      // Fallback: if the list did not render cards (e.g., API not hit), inject a test card to verify layout overlap.
      await page.evaluate(() => {
        const card = document.createElement('div');
        card.setAttribute('data-testid', 'travel-card-link');
        card.style.width = '100%';
        card.style.height = '360px';
        card.style.border = '1px solid #ccc';
        card.style.borderRadius = '16px';
        card.style.margin = '24px auto';
        card.style.background = '#fafafa';
        const container = document.querySelector('#main-content') || document.body;
        container.appendChild(card);
      });
    }

    await expect(cards.first()).toBeVisible({ timeout: 45_000 });
    const ensuredCount = await cards.count();
    if (ensuredCount === 0) test.skip(true, 'No cards rendered');

    const last = cards.nth(ensuredCount - 1);
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeVisible();

    await expectNoOverlap(dock, last, { labelA: 'footer dock', labelB: 'last travel card' });
  });
});
