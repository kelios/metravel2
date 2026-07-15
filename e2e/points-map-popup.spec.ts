import { test, expect } from './fixtures';
import { preacceptCookies, tid } from './helpers/navigation';

test.describe('Travel points -> map marker', () => {
  test('point card focuses its marker without navigation or an implicit popup', async ({ page }) => {
    await preacceptCookies(page);

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
      let pathname: string;
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

    const scrollContainer = page.locator(tid('travel-details-scroll')).first();
    await expect(scrollContainer).toBeVisible();
    await scrollContainer.evaluate((node: Element) => {
      const el = node as HTMLElement;
      el.scrollTop = el.scrollHeight;
      el.dispatchEvent(new Event('scroll', { bubbles: true }));
    });

    await page
      .getByRole('button', { name: /Перейти к разделу Координаты мест/i })
      .click();
    const pointsSection = page.locator(tid('travel-details-points')).first();
    await expect(pointsSection).toBeVisible({ timeout: 20_000 });
    await pointsSection.scrollIntoViewIfNeeded();

    const pointCards = pointsSection.locator('[data-testid^="travel-point-card-"]');
    await expect(pointCards).toHaveCount(1, { timeout: 20_000 });

    const currentUrl = page.url();
    const popupPromise = page.waitForEvent('popup', { timeout: 1500 }).catch(() => null);

    await pointCards.first().getByText('Гомель', { exact: true }).click();

    const openedPopup = await popupPromise;
    expect(openedPopup).toBeNull();
    await expect(page).toHaveURL(currentUrl);

    const mapSection = page.locator(tid('travel-details-map')).first();
    await mapSection.scrollIntoViewIfNeeded();
    await expect(mapSection).toBeVisible();

    const leafletContainer = mapSection.locator('.leaflet-container').first();
    await expect(leafletContainer).toBeVisible({ timeout: 20_000 });

    // Selecting the point card must focus/highlight the marker without opening
    // its popup. The popup is reserved for an explicit marker click.
    const leafletPopup = mapSection.locator('.leaflet-popup').first();
    await expect(leafletPopup).toHaveCount(0);
    const highlightedMarker = mapSection.locator('.metravel-travel-highlighted-marker');
    await expect(highlightedMarker).toHaveCount(1, { timeout: 10_000 });
  });
});
