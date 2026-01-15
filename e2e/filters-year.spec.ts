import { test, expect } from './fixtures';
import { seedNecessaryConsent } from './helpers/storage';

test.describe('Filters', () => {
  test('year filter can be set', async ({ page }) => {
    await page.goto('/travelsby', { waitUntil: 'domcontentloaded' });
    await page.addInitScript(seedNecessaryConsent);

    // На главной странице нет сайдбара, поэтому проверяем рабочую страницу поиска,
    // где фильтры (и поле "Год") доступны на десктопе.
    await page.goto('/search', { waitUntil: 'domcontentloaded' });

    // Year input exists inside ModernFilters (sidebar) on desktop.
    const yearInput = page.getByPlaceholder('2023');
    await expect(yearInput).toBeVisible({ timeout: 30_000 });

    await yearInput.fill('2024');

    // Wait for filtering to apply.
    await page.waitForTimeout(800);

    // The app may show cards, skeletons, or empty state depending on data.
    await Promise.race([
      page.waitForSelector('[data-testid="travel-card-link"]', { timeout: 30_000 }),
      page.waitForSelector('[data-testid="travel-card-skeleton"]', { timeout: 30_000 }),
      page.waitForSelector('text=Пока нет путешествий', { timeout: 30_000 }),
      page.waitForSelector('text=Найдено', { timeout: 30_000 }),
    ]);

    await expect(yearInput).toHaveValue('2024');
  });
});
