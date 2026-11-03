import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { preacceptCookies } from './helpers/navigation';
import { getTravelsListPath } from './helpers/routes';
import { installAnalyticsIntentRecorder, readAnalyticsIntents } from './helpers/analytics';

const SEARCH_TIMEOUT_MS = 30_000;
const SEARCH_DEBOUNCE_MS = 600;
const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
// #2895: popular routes under an empty search come from a fixture, not from the live ranking.
const POPULAR_TRAVELS = Array.from({ length: 3 }, (_, index) => ({
  id: 981_500 + index,
  slug: `e2e-popular-${index}`,
  url: `/travels/e2e-popular-${index}`,
  name: `Популярный маршрут e2e ${index + 1}`,
  countryName: 'Беларусь',
  cityName: 'Минск',
  travel_image_thumb_url: PIXEL,
  travel_image_thumb_small_url: PIXEL,
  publish: true,
  moderation: true,
  year: '2026',
}));

const waitForSearchResults = async (page: Page) => {
  // We accept either cards, skeletons, or empty state as valid.
  await Promise.any([
    page.waitForSelector('[data-testid="travel-card-link"], [testID="travel-card-link"]', { timeout: SEARCH_TIMEOUT_MS }),
    page.waitForSelector('[data-testid="travel-list-item-skeleton"], [testID="travel-list-item-skeleton"]', { timeout: SEARCH_TIMEOUT_MS }),
    page.waitForSelector('text=Пока нет путешествий', { timeout: SEARCH_TIMEOUT_MS }),
    page.waitForSelector('text=Ничего не найдено', { timeout: SEARCH_TIMEOUT_MS }),
    page.waitForSelector('[data-testid="results-count-wrapper"], [testID="results-count-wrapper"]', { timeout: SEARCH_TIMEOUT_MS }),
    page.waitForSelector('[data-testid="results-count-text"], [testID="results-count-text"]', { timeout: SEARCH_TIMEOUT_MS }),
    page.waitForSelector('text=Результаты', { timeout: SEARCH_TIMEOUT_MS }),
  ]);
};

const clearSearch = async (page: Page, searchInput: Locator) => {
  // Clear search: try explicit UI controls first, fallback to keyboard.
  const resetAll = page.locator(
    '[data-testid="clear-all-button"], [testID="clear-all-button"], [aria-label="Сбросить все фильтры и поиск"]'
  ).first();
  if (await resetAll.isVisible().catch(() => false)) {
    await resetAll.click();
    return;
  }

  const clearSearchButton = page.getByLabel('Очистить поиск').first();
  if (await clearSearchButton.isVisible().catch(() => false)) {
    await clearSearchButton.click();
    return;
  }

  await searchInput.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Backspace');
};

test.describe('@smoke Search', () => {
  test('q alias performs the canonical search and preserves unrelated URL state', async ({ page }) => {
    await preacceptCookies(page);

    const requestPromise = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return url.pathname.endsWith('/travels/') && url.searchParams.get('query') === 'Минск';
    });

    await page.goto('/search?q=%D0%9C%D0%B8%D0%BD%D1%81%D0%BA&utm_source=e2e#results', {
      waitUntil: 'domcontentloaded',
    });

    const request = await requestPromise;
    expect(new URL(request.url()).searchParams.has('sort')).toBe(false);
    const search = page.getByRole('searchbox', { name: /^Поиск маршрутов(?:\.|$)/ });
    await expect(search).toHaveValue('Минск', { timeout: SEARCH_TIMEOUT_MS });
    await expect.poll(() => new URL(page.url()).searchParams.get('search')).toBe('Минск');
    expect(new URL(page.url()).searchParams.has('q')).toBe(false);
    expect(new URL(page.url()).searchParams.get('utm_source')).toBe('e2e');
    expect(new URL(page.url()).hash).toBe('#results');
  });

  test('zero-result text search never retries without the query', async ({ page }) => {
    await preacceptCookies(page);
    await installAnalyticsIntentRecorder(page);

    const noMatchQuery = 'metravel-e2e-no-match-1582';
    const observedCatalogRequests: URLSearchParams[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname.endsWith('/travels/')) {
        observedCatalogRequests.push(url.searchParams);
      }
    });
    await page.route('**/travels/?**', async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('query') !== noMatchQuery) {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [], count: 0, next: null, stage: 'none', strict_count: 0, removed_filter_keys: [] }),
      });
    });
    await page.route('**/travels/popular/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(POPULAR_TRAVELS) }),
    );

    await page.goto(`/search?search=${encodeURIComponent(noMatchQuery)}`, {
      waitUntil: 'domcontentloaded',
    });

    const search = page.getByRole('searchbox', { name: /^Поиск маршрутов(?:\.|$)/ });
    await expect(search).toHaveValue(noMatchQuery, { timeout: SEARCH_TIMEOUT_MS });
    await expect(page.getByText('Ничего не найдено', { exact: true })).toBeVisible({
      timeout: SEARCH_TIMEOUT_MS,
    });
    // #2895: the empty state is terminal — the SSG shell is gone, the message names the
    // query, and popular routes keep the page from being a dead end.
    await expect(page.locator('#ssg-skeleton')).toHaveCount(0, { timeout: SEARCH_TIMEOUT_MS });
    await expect(page.getByText(`По запросу «${noMatchQuery}» маршрутов нет.`, { exact: true })).toBeVisible();
    await expect(page.getByText('Популярное у путешественников', { exact: true })).toBeVisible({
      timeout: SEARCH_TIMEOUT_MS,
    });
    await expect(page.getByText('Популярный маршрут e2e 1', { exact: true }).first()).toBeVisible();
    await page.waitForTimeout(SEARCH_DEBOUNCE_MS);

    expect(observedCatalogRequests).toHaveLength(1);
    expect(observedCatalogRequests[0].get('query')).toBe(noMatchQuery);
    expect(observedCatalogRequests[0].get('relaxation')).toBe('auto');
    // #2908: the zero-result outcome reaches analytics with the query.
    await expect.poll(async () => (await readAnalyticsIntents(page, 'search_zero_results')).length, {
      timeout: SEARCH_TIMEOUT_MS,
    }).toBe(1);
    const [zeroResults] = await readAnalyticsIntents(page, 'search_zero_results');
    expect(zeroResults.params).toMatchObject({ source: 'travel_catalog', search_term: noMatchQuery });
  });

  test('search box filters list and can be cleared', async ({ page }) => {
    await preacceptCookies(page);

    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });

    const search = page.getByRole('searchbox', { name: /^Поиск маршрутов(?:\.|$)/ });
    await expect(search).toBeVisible({ timeout: SEARCH_TIMEOUT_MS });

    await search.fill('минск');

    // Wait for debounced search application.
    await page.waitForTimeout(SEARCH_DEBOUNCE_MS);

    await waitForSearchResults(page);
    await clearSearch(page, search);

    await expect(search).toHaveValue('');
  });
});
