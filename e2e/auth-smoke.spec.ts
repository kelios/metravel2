import { test } from './fixtures';
import { gotoWithRetry, preacceptCookies } from './helpers/navigation';
import { getTravelsListPath } from './helpers/routes';

test.describe('@smoke Auth smoke', () => {
  test('travels page loads (with storageState if available)', async ({ page }) => {
    await preacceptCookies(page);

    await gotoWithRetry(page, getTravelsListPath());

    // Page should render travel list (cards/skeletons) OR empty state OR landing hero on new homepage.
    await Promise.any([
      page.waitForSelector('[data-testid="travel-card-link"], [testID="travel-card-link"], [data-testid="travel-card-skeleton"], [testID="travel-card-skeleton"]', {
        timeout: 30_000,
      }),
      page.waitForSelector('[data-testid="list-travel-skeleton"], [testID="list-travel-skeleton"]', { timeout: 30_000 }),
      page.waitForSelector('text=Пока нет путешествий', { timeout: 30_000 }),
      page.waitForSelector('text=Ничего не найдено', { timeout: 30_000 }),
      page.waitForSelector('[data-testid="results-count-wrapper"], [testID="results-count-wrapper"]', { timeout: 30_000 }),
      page.waitForSelector('text=Результаты', { timeout: 30_000 }),
      page.waitForSelector('text=Пиши о своих путешествиях', { timeout: 30_000 }),
    ]);
  });
});
