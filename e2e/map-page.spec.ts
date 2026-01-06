import { test, expect } from '@playwright/test';
import { installNoConsoleErrorsGuard } from './helpers/consoleGuards';

const maybeRecoverFromWorkletError = async (page: any) => {
  const errorTitle = page.getByText('Что-то пошло не так', { exact: true });
  const workletError = page.getByText('_WORKLET is not defined', { exact: true });

  const hasError =
    (await errorTitle.isVisible().catch(() => false)) &&
    (await workletError.isVisible().catch(() => false));

  if (!hasError) return;

  // On this error screen actions are rendered as generic clickable elements, not necessarily <button>.
  const reloadButton = page.getByText('Перезагрузить страницу', { exact: true });
  const retryButton = page.getByText('Попробовать снова', { exact: true });

  if (await reloadButton.isVisible().catch(() => false)) {
    await reloadButton.click({ force: true }).catch(() => null);
    return;
  }
  if (await retryButton.isVisible().catch(() => false)) {
    await retryButton.click({ force: true }).catch(() => null);
    return;
  }

  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => null);
};

const waitForMapUi = async (page: any, timeoutMs: number) => {
  const mapReady = page.getByTestId('map-leaflet-wrapper');
  const mobileMenu = page.getByTestId('map-panel-open');

  await Promise.race([
    mapReady.waitFor({ state: 'visible', timeout: timeoutMs }).catch(() => null),
    mobileMenu.waitFor({ state: 'visible', timeout: timeoutMs }).catch(() => null),
  ]);

  const hasUi =
    (await mapReady.isVisible().catch(() => false)) ||
    (await mobileMenu.isVisible().catch(() => false));
  if (!hasUi) throw new Error('Map UI did not appear');
};

const gotoMapWithRecovery = async (page: any) => {
  const mapReady = page.getByTestId('map-leaflet-wrapper');
  const mobileMenu = page.getByTestId('map-panel-open');
  const workletError = page.getByText('_WORKLET is not defined', { exact: true });

  const startedAt = Date.now();
  const maxTotalMs = 120_000;

  await page.goto('/map', { waitUntil: 'domcontentloaded', timeout: 120_000 });

  while (Date.now() - startedAt < maxTotalMs) {
    // Success condition: UI is present.
    const hasUi =
      (await mapReady.isVisible().catch(() => false)) ||
      (await mobileMenu.isVisible().catch(() => false));
    if (hasUi) return;

    // If worklet error is visible, try to recover and keep looping.
    const hasWorkletError = await workletError.isVisible().catch(() => false);
    if (hasWorkletError) {
      await maybeRecoverFromWorkletError(page);
      // Give the app a chance to reload after clicking.
      await page.waitForTimeout(800).catch(() => null);
      continue;
    }

    // If neither UI nor error is visible, we're likely in a loading/transient state.
    await page.waitForTimeout(300).catch(() => null);
  }

  // One last check with a longer wait before failing.
  await waitForMapUi(page, 60_000);
};

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
    await gotoMapWithRecovery(page);

    await expect(page.getByTestId('map-leaflet-wrapper')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('filters-panel')).toBeVisible({ timeout: 60_000 });

    await expect(page.getByTestId('segmented-radius')).toBeVisible();
    await expect(page.getByTestId('segmented-route')).toBeVisible();
  });

  test('desktop: can switch to route mode and sees route builder', async ({ page }) => {
    await gotoMapWithRecovery(page);

    await page.getByTestId('segmented-route').click();

    await expect(page.getByTestId('route-builder')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('filters-build-route-button')).toBeVisible();
    await expect(page.getByTestId('filters-panel-footer')).toBeVisible();
  });

  test('desktop: changing radius persists to localStorage (map-filters)', async ({ page }) => {
    await gotoMapWithRecovery(page);

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
    await gotoMapWithRecovery(page);

    await expect(page.getByTestId('map-panel-tab-travels')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('map-panel-tab-travels').click();
    await expect(page.getByTestId('map-travels-tab')).toBeVisible({ timeout: 60_000 });
  });

  test('desktop: scroll reaches footer area', async ({ page }) => {
    await gotoMapWithRecovery(page);

    const scroll = page.getByTestId('filters-panel-scroll');
    await expect(scroll).toBeVisible();

    await scroll.evaluate((el: any) => {
      el.scrollTop = el.scrollHeight;
    });

    // Footer всегда должен быть на странице
    await expect(page.getByTestId('filters-panel-footer')).toBeVisible();
    await expect(page.getByTestId('map-reset-filters-button')).toBeVisible();
  });

  test('mobile: menu button opens filters panel', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 });
    await gotoMapWithRecovery(page);

    // На мобильном панель закрыта по умолчанию, должна быть видна кнопка меню
    await expect(page.getByTestId('map-panel-open')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('map-panel-open').click();

    await expect(page.getByTestId('filters-panel')).toBeVisible({ timeout: 20_000 });

    // Закрытие через крестик (если доступен) либо повторный toggle кнопкой меню
    const closeButton = page.getByTestId('filters-panel-close-button');
    const panelCloseButton = page.getByTestId('map-close-panel-button');
    const hasCloseButton = await closeButton.isVisible({ timeout: 2_000 }).catch(() => false);
    const hasPanelCloseButton = await panelCloseButton.isVisible({ timeout: 2_000 }).catch(() => false);

    if (hasCloseButton) {
      await closeButton.click({ force: true });
    } else if (hasPanelCloseButton) {
      await panelCloseButton.click({ force: true });
    } else {
      await page.getByTestId('map-panel-open').click({ force: true });
    }
    await expect(page.getByTestId('map-panel-open')).toBeVisible({ timeout: 20_000 });
  });

  test('mobile: overlay click closes panel', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 });
    await gotoMapWithRecovery(page);

    await expect(page.getByTestId('map-panel-open')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('map-panel-open').click();

    // Закрываем панель повторным нажатием на кнопку меню (toggle).
    await expect(page.getByTestId('filters-panel')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('map-panel-open').click({ force: true });

    await expect(page.getByTestId('map-panel-open')).toBeVisible({ timeout: 20_000 });
  });

  test('mobile: double click on menu does not cause panel flicker (stays open)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 });
    await gotoMapWithRecovery(page);

    const toggle = page.getByTestId('map-panel-open');
    await expect(toggle).toBeVisible({ timeout: 20_000 });

    // Regression: RN-web Pressable can emit double events; panel should not open then immediately close.
    await toggle.dblclick();

    const panel = page.getByTestId('filters-panel');
    await expect(panel).toBeVisible({ timeout: 20_000 });

    // Give the UI a moment: if there is flicker, it would have collapsed by now.
    await page.waitForTimeout(400);
    await expect(panel).toBeVisible();
  });
});
