import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { seedNecessaryConsent } from './helpers/storage';
import { getTravelsListPath } from './helpers/routes';

const SEARCH_TIMEOUT_MS = 30_000;
const SEARCH_DEBOUNCE_MS = 600;

const waitForSearchResults = async (page: Page) => {
  // We accept either cards, skeletons, or empty state as valid.
  await Promise.race([
    page.waitForSelector('[data-testid="travel-card-link"]', { timeout: SEARCH_TIMEOUT_MS }),
    page.waitForSelector('[data-testid="travel-card-skeleton"]', { timeout: SEARCH_TIMEOUT_MS }),
    page.waitForSelector('text=Пока нет путешествий', { timeout: SEARCH_TIMEOUT_MS }),
    page.waitForSelector('text=Найдено', { timeout: SEARCH_TIMEOUT_MS }),
  ]);
};

const clearSearch = async (page: Page, searchInput: Locator) => {
  // Clear search: try explicit UI controls first, fallback to keyboard.
  const resetAll = page.getByText('Сбросить', { exact: true });
  if (await resetAll.isVisible().catch(() => false)) {
    await resetAll.click();
    return;
  }

  await searchInput.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Backspace');
};

test.describe('Search', () => {
  test('search box filters list and can be cleared', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);

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
