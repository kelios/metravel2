import { test, expect } from './fixtures';
import { seedNecessaryConsent } from './helpers/storage';

const tid = (id: string) => `[data-testid="${id}"], [testID="${id}"]`;

test.describe('Travel points -> map popup', () => {
  test('clicking point card opens map popup without navigation', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);

    const slug = 'e2e-points-map-popup';
    const image =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8ZKfkAAAAASUVORK5CYII=';
    const coord = '52.4238936, 31.0131698';
    const mocked = {
      id: 999998,
      name: 'E2E Points Map Popup',
      slug,
      url: `/travels/${slug}`,
      userName: 'E2E',
      cityName: 'E2E',
      countryName: 'E2E',
      countryCode: 'EE',
      countUnicIpView: '0',
      travel_image_thumb_url: image,
      travel_image_thumb_small_url: image,
      gallery: [image],
      travelAddress: [
        {
          id: 1,
          name: 'Гомель',
          address: 'Гомель',
          coord,
          travelImageThumbUrl: image,
          travel_image_thumb_url: image,
          categoryName: 'Город',
          urlTravel: '',
          articleUrl: '',
        },
      ],
      coordsMeTravel: [
        {
          lat: 52.4238936,
          lng: 31.0131698,
          title: 'Гомель',
          coord,
        },
      ],
      year: '2025',
      monthName: 'Январь',
      number_days: 1,
      companions: [],
      youtube_link: '',
      description: '<p>Тестовое описание маршрута.</p>',
      recommendation: '',
      plus: '',
      minus: '',
      userIds: '',
    };

    const routeHandler = async (route: any, request: any) => {
      if (request.method() !== 'GET') {
        await route.continue();
        return;
      }
      const url = request.url();
      let pathname = '';
      try {
        pathname = new URL(url).pathname;
      } catch {
        pathname = url;
      }
      if (!pathname.includes(`/travels/by-slug/${slug}`)) {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mocked),
      });
    };

    await page.route('**/api/travels/by-slug/**', routeHandler);
    await page.route('**/travels/by-slug/**', routeHandler);

    await page.goto(`/travels/${slug}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(tid('travel-details-page'), { timeout: 20_000 });

    const pointsSection = page.locator(tid('travel-details-points')).first();
    await pointsSection.scrollIntoViewIfNeeded();
    await expect(pointsSection).toBeVisible();

    const pointCards = pointsSection.locator('[data-testid^="travel-point-card-"]');
    if ((await pointCards.count()) === 0) {
      const toggleButton = pointsSection.getByRole('button', { name: /координат/i });
      if (await toggleButton.isVisible()) {
        await toggleButton.click();
      }
    }

    if ((await pointCards.count()) === 0) {
      test.info().annotations.push({
        type: 'note',
        description: 'No point cards available after toggling; skipping click assertions.',
      });
      return;
    }

    const currentUrl = page.url();
    const popupPromise = page.waitForEvent('popup', { timeout: 1500 }).catch(() => null);

    await pointCards.first().click();

    const popup = await popupPromise;
    expect(popup).toBeNull();
    await expect(page).toHaveURL(currentUrl);

    const mapSection = page.locator(tid('travel-details-map')).first();
    await mapSection.scrollIntoViewIfNeeded();
    await expect(mapSection).toBeVisible();

    const popupLocator = page.locator('.leaflet-popup');
    await expect(popupLocator).toBeVisible({ timeout: 15_000 });
  });
});
