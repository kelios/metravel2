import { test, expect } from '@playwright/test';

test.describe('Map Page (/map) - smoke e2e', () => {
  test.beforeEach(async ({ page }) => {
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
  });

  test('desktop: loads map and shows filters panel', async ({ page }) => {
    await page.goto('/map', { waitUntil: 'networkidle', timeout: 120_000 });

    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('filters-panel')).toBeVisible({ timeout: 60_000 });

    await expect(page.getByTestId('segmented-radius')).toBeVisible();
    await expect(page.getByTestId('segmented-route')).toBeVisible();
  });

  test('desktop: can switch to route mode and sees route builder', async ({ page }) => {
    await page.goto('/map', { waitUntil: 'networkidle', timeout: 120_000 });

    await page.getByTestId('segmented-route').click();

    await expect(page.getByTestId('route-builder')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('filters-panel-footer')).toBeVisible();
  });

  test('desktop: scroll reaches footer area', async ({ page }) => {
    await page.goto('/map', { waitUntil: 'networkidle', timeout: 120_000 });

    const scroll = page.getByTestId('filters-panel-scroll');
    await expect(scroll).toBeVisible();

    await scroll.evaluate((el: any) => {
      el.scrollTop = el.scrollHeight;
    });

    // Footer всегда должен быть на странице
    await expect(page.getByTestId('filters-panel-footer')).toBeVisible();
    await expect(page.getByTestId('filters-reset-button')).toBeVisible();
  });

  test('mobile: menu button opens filters panel', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 });
    await page.goto('/map', { waitUntil: 'networkidle', timeout: 120_000 });

    // На мобильном панель закрыта по умолчанию, должна быть видна кнопка меню
    await expect(page.getByTestId('map-panel-open')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('map-panel-open').click();

    await expect(page.getByTestId('filters-panel')).toBeVisible({ timeout: 20_000 });

    // Закрытие через крестик
    await page.getByTestId('filters-panel-close-button').click();
    await expect(page.getByTestId('map-panel-open')).toBeVisible({ timeout: 20_000 });
  });
});
