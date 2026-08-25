import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { preacceptCookies } from './helpers/navigation';
import { getTravelsListPath } from './helpers/routes';

const SEARCH_TIMEOUT_MS = 30_000;
const SEARCH_DEBOUNCE_MS = 600;

const waitForSearchResults = async (page: Page) => {
  // We accept either cards, skeletons, or empty state as valid.
  await Promise.any([
    page.waitForSelector('[data-testid="travel-card-link"], [testID="travel-card-link"]', { timeout: SEARCH_TIMEOUT_MS }),
    page.waitForSelector('[data-testid="travel-card-skeleton"], [testID="travel-card-skeleton"]', { timeout: SEARCH_TIMEOUT_MS }),
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
    const search = page.getByRole('textbox', { name: /Поиск путешествий/i });
    await expect(search).toHaveValue('Минск', { timeout: SEARCH_TIMEOUT_MS });
    await expect.poll(() => new URL(page.url()).searchParams.get('search')).toBe('Минск');
    expect(new URL(page.url()).searchParams.has('q')).toBe(false);
    expect(new URL(page.url()).searchParams.get('utm_source')).toBe('e2e');
    expect(new URL(page.url()).hash).toBe('#results');
  });

  test('zero-result text search never retries without the query', async ({ page }) => {
    await preacceptCookies(page);

    const noMatchQuery = 'metravel-e2e-no-match-1582';
    const observedQueries: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname.endsWith('/travels/')) {
        observedQueries.push(url.searchParams.get('query') ?? '');
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
        body: JSON.stringify({ data: [], total: 0 }),
      });
    });

    await page.goto(`/search?search=${encodeURIComponent(noMatchQuery)}`, {
      waitUntil: 'domcontentloaded',
    });

    const search = page.getByRole('textbox', { name: /Поиск путешествий/i });
    await expect(search).toHaveValue(noMatchQuery, { timeout: SEARCH_TIMEOUT_MS });
    await expect(page.getByText('Ничего не найдено', { exact: true })).toBeVisible({
      timeout: SEARCH_TIMEOUT_MS,
    });
    await page.waitForTimeout(SEARCH_DEBOUNCE_MS);

    expect(observedQueries.length).toBeGreaterThan(0);
    expect(observedQueries.every((query) => query === noMatchQuery)).toBe(true);
  });

  test('search box filters list and can be cleared', async ({ page }) => {
    await preacceptCookies(page);

    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });

    const search = page.getByRole('textbox', { name: /Поиск путешествий/i });
    await expect(search).toBeVisible({ timeout: SEARCH_TIMEOUT_MS });

    await search.fill('минск');

    // Wait for debounced search application.
    await page.waitForTimeout(SEARCH_DEBOUNCE_MS);

    await waitForSearchResults(page);
    await clearSearch(page, search);

    await expect(search).toHaveValue('');
  });
});
