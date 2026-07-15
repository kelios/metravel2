import { test, expect } from './fixtures';
import { preacceptCookies } from './helpers/navigation';

const rouletteTravel = {
  id: 71001,
  slug: 'e2e-roulette-route',
  url: '/travels/e2e-roulette-route',
  name: 'E2E Roulette Route',
  cityName: 'Минск',
  countryName: 'Беларусь',
  publish: true,
  moderation: true,
  travel_image_thumb_url: '',
};

async function mockRouletteApi(page: import('@playwright/test').Page) {
  await page.route('**/getFiltersTravel/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      categories: [],
      categoryTravelAddress: [],
      companions: [],
      complexity: [],
      month: [],
      over_nights_stay: [],
      sortings: [],
      transports: [],
      year: '',
    }),
  }));
  await page.route('**/countriesforsearch/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{ id: 3, name: 'Беларусь' }]),
  }));
  await page.route('**/countries/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{ id: 3, name: 'Беларусь' }]),
  }));
  await page.route('**/travels/facets/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ total: 1, facets: {} }),
  }));
  await page.route('**/travels/random/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: [rouletteTravel], total: 1 }),
  }));
}

test.describe('Roulette', () => {
  test('spins and reaches a defined result or empty state', async ({ page }) => {
    await preacceptCookies(page);
    await mockRouletteApi(page);

    await page.goto('/roulette', { waitUntil: 'domcontentloaded' });

    const spin = page.getByRole('button', { name: 'Крутить рулетку' }).first();
    await expect(spin).toBeVisible({ timeout: 30_000 });
    await expect(spin).toBeEnabled();
    await spin.click();

    await expect(page.locator('[data-testid="travel-card-link"]').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('E2E Roulette Route', { exact: true }).first()).toBeVisible();
  });
});
