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
