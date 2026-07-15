import type { Page, Route } from '@playwright/test';

import { test, expect } from './fixtures';
import { gotoWithRetry, preacceptCookies } from './helpers/navigation';
import { getTravelsListPath } from './helpers/routes';

const FILTER_TIMEOUT_MS = 30_000;
const IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8ZKfkAAAAASUVORK5CYII=';

const travelFixture = {
  id: 990_120,
  slug: 'e2e-filtered-travel',
  url: '/travels/e2e-filtered-travel',
  name: 'E2E filter catalog travel',
  countryName: 'Беларусь',
  cityName: 'Минск',
  travel_image_thumb_url: IMAGE,
  travel_image_thumb_small_url: IMAGE,
  publish: true,
  moderation: true,
  year: '2024',
};

const filterDictionaries = {
  categories: [
    { id: 1, name: 'Горы' },
    { id: 2, name: 'Города' },
  ],
  categoryTravelAddress: [{ id: 10, name: 'Музей' }],
  companions: [{ id: 20, name: 'С друзьями' }],
  complexity: [{ id: 30, name: 'Легко' }],
  month: [{ id: 7, name: 'Июль' }],
  over_nights_stay: [{ id: 40, name: 'Отель' }],
  sortings: [
    { id: 'newest', name: 'Сначала новые', sortBy: 'created_at', sortOrder: 'desc' },
    { id: 'oldest', name: 'Сначала старые', sortBy: 'created_at', sortOrder: 'asc' },
    { id: 'popular_desc', name: 'Популярные ↓', sortBy: 'countUnicIpView', sortOrder: 'desc' },
    { id: 'popular_asc', name: 'Популярные ↑', sortBy: 'countUnicIpView', sortOrder: 'asc' },
    { id: 'name_asc', name: 'Название А–Я', sortBy: 'name', sortOrder: 'asc' },
    { id: 'name_desc', name: 'Название Я–А', sortBy: 'name', sortOrder: 'desc' },
  ],
  transports: [{ id: 50, name: 'Поезд' }],
};

const facetFixture = {
  total: 1,
  facets: {
    categories: [
      { id: 1, name: 'Горы', count: 1 },
      { id: 2, name: 'Города', count: 1 },
    ],
    categoryTravelAddress: [{ id: 10, name: 'Музей', count: 1 }],
    companions: [{ id: 20, name: 'С друзьями', count: 1 }],
    complexity: [{ id: 30, name: 'Легко', count: 1 }],
    countries: [{ id: 112, name: 'Беларусь', count: 1 }],
    month: [{ id: 7, name: 'Июль', count: 1 }],
    over_nights_stay: [{ id: 40, name: 'Отель', count: 1 }],
    transports: [{ id: 50, name: 'Поезд', count: 1 }],
  },
};

async function fulfillJson(route: Route, body: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function installCatalogMocks(page: Page): Promise<string[]> {
  const listRequests: string[] = [];

  await page.route('**/getFiltersTravel/**', (route) => fulfillJson(route, filterDictionaries));
  await page.route('**/countriesforsearch/**', (route) =>
    fulfillJson(route, [{ country_id: 112, title_ru: 'Беларусь' }]),
  );

  const fulfillTravels = async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() !== 'GET') {
      await route.fallback();
      return;
    }

    if (url.pathname.endsWith('/travels/facets/')) {
      await fulfillJson(route, facetFixture);
      return;
    }

    if (url.pathname.endsWith('/api/travels/') || url.pathname === '/travels/') {
      listRequests.push(url.toString());
      await fulfillJson(route, { data: [travelFixture], total: 1 });
      return;
    }

    await route.fallback();
  };

  await page.route('**/api/travels/**', fulfillTravels);
  await page.route('**/travels/**', fulfillTravels);
  return listRequests;
}

async function openCatalog(page: Page, path = getTravelsListPath()) {
  await preacceptCookies(page);
  const listRequests = await installCatalogMocks(page);
  await gotoWithRetry(page, path);
  await expect(page.getByText(travelFixture.name, { exact: true })).toBeVisible({
    timeout: FILTER_TIMEOUT_MS,
  });
  await expect(page.getByRole('button', { name: /Сортировка:/i }).first()).toBeVisible({
    timeout: FILTER_TIMEOUT_MS,
  });
  return listRequests;
}

function requestWhere(urlString: string): Record<string, unknown> {
  const raw = new URL(urlString).searchParams.get('where');
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

test.describe('@smoke Filters and sorting — deterministic catalog integration', () => {
  test.use({ viewport: { width: 1600, height: 1200 } });

  test('selecting a sort option closes the menu and updates the catalog request', async ({ page }) => {
    const requests = await openCatalog(page);
    const sortTrigger = page.getByRole('button', { name: /Сортировка:/i }).first();

    await sortTrigger.click();
    const options = page.getByRole('radio');
    await expect(options).toHaveCount(filterDictionaries.sortings.length, {
      timeout: FILTER_TIMEOUT_MS,
    });

    await page.getByRole('radio', { name: 'Популярные ↓', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Сортировка: Популярные ↓', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Сначала старые', exact: true })).toHaveCount(0);

    await expect
      .poll(
        () => requests.some((requestUrl) => {
          const url = new URL(requestUrl);
          return url.searchParams.get('sort') === 'popular_desc'
            || url.searchParams.get('sortBy') === 'countUnicIpView';
        }),
        { timeout: FILTER_TIMEOUT_MS },
      )
      .toBe(true);
  });

  test('selecting and clearing a category updates both UI state and API query', async ({ page }) => {
    const requests = await openCatalog(page);

    const mountains = page.getByRole('checkbox', { name: 'Горы', exact: true });
    if (!(await mountains.isVisible())) {
      await page.getByRole('button', { name: /^Развернуть Категории$/i }).click();
    }
    await expect(mountains).toBeVisible({ timeout: FILTER_TIMEOUT_MS });
    await mountains.click();
    await expect(mountains).toHaveAttribute('aria-checked', 'true');

    await expect
      .poll(
        () => requests.some((requestUrl) => {
          const selected = requestWhere(requestUrl).categories;
          return Array.isArray(selected) && selected.map(String).includes('1');
        }),
        { timeout: FILTER_TIMEOUT_MS },
      )
      .toBe(true);

    const clearGroup = page.getByRole('button', { name: /Очистить 1 выбранн/i }).first();
    await expect(clearGroup).toBeVisible({ timeout: FILTER_TIMEOUT_MS });
    await clearGroup.click();
    await expect(mountains).toHaveAttribute('aria-checked', 'false');
  });

  test('year filter is sent to the catalog API', async ({ page }) => {
    const requests = await openCatalog(page, '/search');
    const yearInput = page.getByLabel('Фильтр по году');

    await expect(yearInput).toBeVisible({ timeout: FILTER_TIMEOUT_MS });
    await yearInput.fill('2024');
    await expect(yearInput).toHaveValue('2024');

    await expect
      .poll(
        () => requests.some((requestUrl) => requestWhere(requestUrl).year === '2024'),
        { timeout: FILTER_TIMEOUT_MS },
      )
      .toBe(true);
  });
});
