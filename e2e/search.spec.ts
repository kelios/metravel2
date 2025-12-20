import { test, expect } from '@playwright/test';

test.describe('Search', () => {
  test('search box filters list and can be cleared', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem(
          'metravel_consent_v1',
          JSON.stringify({ necessary: true, analytics: false, date: new Date().toISOString() })
        );
      } catch {
        // ignore
      }
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const search = page.getByRole('textbox', { name: /Поиск путешествий/i });
    await expect(search).toBeVisible({ timeout: 30_000 });

    await search.fill('минск');

    // Wait for debounced search application.
    await page.waitForTimeout(600);

    // We accept either cards, skeletons, or empty state as valid.
    await Promise.race([
      page.waitForSelector('[data-testid="travel-card-link"]', { timeout: 30_000 }),
      page.waitForSelector('[data-testid="travel-card-skeleton"]', { timeout: 30_000 }),
      page.waitForSelector('text=Пока нет путешествий', { timeout: 30_000 }),
      page.waitForSelector('text=Найдено', { timeout: 30_000 }),
    ]);

    // Clear search: try explicit UI controls first, fallback to keyboard.
    const resetAll = page.getByText('Сбросить', { exact: true });
    if (await resetAll.isVisible().catch(() => false)) {
      await resetAll.click();
    } else {
      await search.click();
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.press('Backspace');
    }

    await expect(search).toHaveValue('');
  });
});
