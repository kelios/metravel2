import { expect, test } from './fixtures';
import { preacceptCookies } from './helpers/navigation';

const place = (
  id: string,
  title: string,
  category: string,
  lat: number,
  lng: number,
) => ({
  id,
  title,
  address: `${title}, тестовый адрес`,
  category: { id: Number(id), name: category },
  country: { code: 'BY', name: 'Беларусь' },
  lat,
  lng,
  travel: { url: `/travels/e2e-${id}` },
  image: null,
});

const castle = place('101', 'Мирский замок', 'Замки', 53.451, 26.473);
const museum = place('102', 'Музей истории', 'Музеи', 53.9, 27.56);

test.describe('@smoke Places catalog', () => {
  test.beforeEach(async ({ page }) => {
    await preacceptCookies(page);
    await page.route('**/places/catalog/**', async (route) => {
      const url = new URL(route.request().url());
      const query = (url.searchParams.get('q') || '').toLowerCase();
      const results = query.includes('музей') ? [museum] : [castle, museum];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: results.length,
          results,
          facets: {
            categories: [
              { id: 101, name: 'Замки', count: 1 },
              { id: 102, name: 'Музеи', count: 1 },
            ],
            countries: [{ code: 'BY', name: 'Беларусь', count: results.length }],
          },
        }),
      });
    });
  });

  test('renders catalog results and applies server-side search', async ({ page }) => {
    await page.goto('/places', { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('places-card-101')).toBeVisible();
    await expect(page.getByTestId('places-card-102')).toBeVisible();

    await page.getByLabel('Найти место').fill('Музей');

    await expect(page.getByTestId('places-card-102')).toBeVisible();
    await expect(page.getByTestId('places-card-101')).toHaveCount(0);
  });

  test('opens a catalog place on the map with focus parameters', async ({ page }) => {
    await page.goto('/places', { waitUntil: 'domcontentloaded' });
    const card = page.getByTestId('places-card-101');
    await expect(card).toBeVisible();

    await card.getByLabel('Открыть место на карте').click();

    await expect(page).toHaveURL(/\/map\?.*placeId=101/);
  });
});
