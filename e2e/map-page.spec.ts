import { test, expect } from '@playwright/test';
import { installNoConsoleErrorsGuard } from './helpers/consoleGuards';

test.describe('Map Page (/map) - smoke e2e', () => {
  test.beforeEach(async ({ page }) => {
    installNoConsoleErrorsGuard(page);
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
    await page.goto('/map', { waitUntil: 'domcontentloaded', timeout: 120_000 });

    await expect(page.getByTestId('map-leaflet-wrapper')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('filters-panel')).toBeVisible({ timeout: 60_000 });

    await expect(page.getByTestId('segmented-radius')).toBeVisible();
    await expect(page.getByTestId('segmented-route')).toBeVisible();
  });

  test('desktop: can switch to route mode and sees route builder', async ({ page }) => {
    await page.goto('/map', { waitUntil: 'domcontentloaded', timeout: 120_000 });

    await page.getByTestId('segmented-route').click();

    await expect(page.getByTestId('route-builder')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('filters-build-route-button')).toBeVisible();
    await expect(page.getByTestId('filters-panel-footer')).toBeVisible();
  });

  test('desktop: changing radius persists to localStorage (map-filters)', async ({ page }) => {
    await page.goto('/map', { waitUntil: 'domcontentloaded', timeout: 120_000 });

    await expect(page.getByTestId('filters-panel')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('radius-option-100')).toBeVisible({ timeout: 60_000 });

    await page.getByTestId('radius-option-100').click();

    const saved = await page.evaluate(() => {
      try {
        return window.localStorage.getItem('map-filters');
      } catch {
        return null;
      }
    });

    expect(saved, 'map-filters must be stored in localStorage after changing radius').toBeTruthy();
    const parsed = saved ? JSON.parse(saved) : null;
    expect(parsed?.radius).toBe('100');
  });

  test('desktop: can open travels tab in right panel', async ({ page }) => {
    await page.goto('/map', { waitUntil: 'domcontentloaded', timeout: 120_000 });

    await expect(page.getByTestId('map-panel-tab-travels')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('map-panel-tab-travels').click();
    await expect(page.getByTestId('map-travels-tab')).toBeVisible({ timeout: 60_000 });
  });

  test('desktop: scroll reaches footer area', async ({ page }) => {
    await page.goto('/map', { waitUntil: 'domcontentloaded', timeout: 120_000 });

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
    await page.goto('/map', { waitUntil: 'domcontentloaded', timeout: 120_000 });

    // На мобильном панель закрыта по умолчанию, должна быть видна кнопка меню
    await expect(page.getByTestId('map-panel-open')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('map-panel-open').click();

    // Должен появиться overlay для закрытия панели тапом вне
    await expect(page.getByTestId('map-panel-overlay')).toBeVisible({ timeout: 20_000 });

    await expect(page.getByTestId('filters-panel')).toBeVisible({ timeout: 20_000 });

    // Закрытие через крестик (если доступен) либо через overlay
    const closeButton = page.getByTestId('filters-panel-close-button');
    const panelCloseButton = page.getByTestId('map-close-panel-button');
    const hasCloseButton = await closeButton.isVisible({ timeout: 2_000 }).catch(() => false);
    const hasPanelCloseButton = await panelCloseButton.isVisible({ timeout: 2_000 }).catch(() => false);

    if (hasCloseButton) {
      await closeButton.click({ force: true });
    } else if (hasPanelCloseButton) {
      await panelCloseButton.click({ force: true });
    } else {
      await page.getByTestId('map-panel-overlay').click({ position: { x: 5, y: 5 }, force: true });
    }
    await expect(page.getByTestId('map-panel-open')).toBeVisible({ timeout: 20_000 });
  });

  test('mobile: overlay click closes panel', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 });
    await page.goto('/map', { waitUntil: 'domcontentloaded', timeout: 120_000 });

    await expect(page.getByTestId('map-panel-open')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('map-panel-open').click();

    const overlay = page.getByTestId('map-panel-overlay');
    await expect(overlay).toBeVisible({ timeout: 20_000 });
    // Click in a safe spot that is not covered by the right panel.
    await overlay.click({ position: { x: 5, y: 5 } });

    await expect(page.getByTestId('map-panel-open')).toBeVisible({ timeout: 20_000 });
  });
});
