import { test, expect } from './fixtures';
import { gotoWithRetry, preacceptCookies, tid } from './helpers/navigation';
import { getTravelsListPath } from './helpers/routes';

const CARD = '[data-testid="travel-card-link"], [testID="travel-card-link"]';
const IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8ZKfkAAAAASUVORK5CYII=';

const createTravel = (id: number) => ({
  id,
  slug: `e2e-pagination-${id}`,
  url: `/travels/e2e-pagination-${id}`,
  name: `E2E paginated travel ${id}`,
  countryName: 'Беларусь',
  cityName: 'Минск',
  travel_image_thumb_url: IMAGE,
  travel_image_thumb_small_url: IMAGE,
  publish: true,
  moderation: true,
});

test.describe('Travels list — infinite scroll', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('requests and renders the next page when the list reaches its end', async ({ page }) => {
    await preacceptCookies(page);

    const firstPage = [1, 2, 3, 4].map(createTravel);
    const secondPage = [5].map(createTravel);
    const requestedPages: number[] = [];

    const fulfillList = async (route: import('@playwright/test').Route) => {
      const url = new URL(route.request().url());
      const isListEndpoint =
        url.pathname.endsWith('/api/travels/') || url.pathname === '/travels/';
      if (!isListEndpoint || route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }

      const pageNumber = Number(url.searchParams.get('page') ?? '1');
      requestedPages.push(pageNumber);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: pageNumber === 1 ? firstPage : pageNumber === 2 ? secondPage : [],
          total: firstPage.length + secondPage.length,
        }),
      });
    };

    await page.route('**/api/travels/**', fulfillList);
    await page.route('**/travels/**', fulfillList);

    await gotoWithRetry(page, getTravelsListPath());

    const cards = page.locator(CARD);
    await expect(cards).toHaveCount(firstPage.length, { timeout: 30_000 });
    expect(requestedPages).toContain(1);

    const scroll = page.locator(tid('right-column-scrollview')).first();
    await expect(scroll).toBeVisible();
    await scroll.evaluate((node: HTMLElement) => {
      node.scrollTop = node.scrollHeight;
      node.dispatchEvent(new Event('scroll', { bubbles: true }));
    });

    await expect
      .poll(() => requestedPages.filter((pageNumber) => pageNumber === 2).length, {
        timeout: 15_000,
      })
      .toBe(1);

    await expect(page.getByText('E2E paginated travel 5', { exact: true })).toBeVisible({
      timeout: 15_000,
    });
  });
});
