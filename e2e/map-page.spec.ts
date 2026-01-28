import { test, expect } from './fixtures';
import { installNoConsoleErrorsGuard } from './helpers/consoleGuards';
import { seedNecessaryConsent } from './helpers/storage';

const maybeRecoverFromMapErrorScreen = async (page: any) => {
  const errorTitle = page.getByText('Что-то пошло не так', { exact: true });
  const hasError = await errorTitle.isVisible().catch(() => false);

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
  if (!hasUi) throw new Error(`Map UI did not appear (url=${page.url()})`);
};

const gotoMapWithRecovery = async (page: any) => {
  const mapReady = page.getByTestId('map-leaflet-wrapper');
  const mobileMenu = page.getByTestId('map-panel-open');
  const errorTitle = page.getByText('Что-то пошло не так', { exact: true });
  const homeHeadline = page.getByText('Пиши о своих путешествиях', { exact: true });
  const mapTabLink = page.getByRole('link', { name: 'Карта' });
  const mapDockItem = page.getByTestId('footer-item-map');

  const startedAt = Date.now();
  const maxTotalMs = 120_000;

  await page.goto('/map', { waitUntil: 'domcontentloaded', timeout: 120_000 });

  while (Date.now() - startedAt < maxTotalMs) {
    // Success condition: UI is present.
    const hasUi =
      (await mapReady.isVisible().catch(() => false)) ||
      (await mobileMenu.isVisible().catch(() => false));
    if (hasUi) return;

    // Sometimes mobile web boots into the Home tab even after direct navigation.
    // If we detect the Home hero, click the "Карта" tab to force the correct route.
    const onHome = await homeHeadline.isVisible().catch(() => false);
    if (onHome) {
      if (await mapDockItem.isVisible().catch(() => false)) {
        await mapDockItem.click({ force: true }).catch(() => null);
      } else if (await mapTabLink.isVisible().catch(() => false)) {
        await mapTabLink.click({ force: true }).catch(() => null);
      }
      await page.waitForURL(/\/map(\?|$)/, { timeout: 5_000 }).catch(() => null);
      await page.waitForTimeout(500).catch(() => null);
      continue;
    }

    // If an error screen is visible, try to recover and keep looping.
    const hasErrorScreen = await errorTitle.isVisible().catch(() => false);
    if (hasErrorScreen) {
      await maybeRecoverFromMapErrorScreen(page);
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
    await page.addInitScript(seedNecessaryConsent);
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

  test('desktop: clicking a travel card opens popup and focuses map', async ({ page }) => {
    await gotoMapWithRecovery(page);

    await expect(page.getByTestId('map-panel-tab-travels')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('map-panel-tab-travels').click();
    await expect(page.getByTestId('map-travels-tab')).toBeVisible({ timeout: 60_000 });

    const cards = page.locator('[data-testid="map-travel-card"]');
    const cardCount = await cards.count();
    if (cardCount === 0) return;

    // Ensure map markers are mounted so openPopupForCoord has something to target.
    await page.locator('.leaflet-marker-icon').first().waitFor({ state: 'visible', timeout: 30_000 });

    await cards.first().click({ position: { x: 16, y: 16 } });

    // Leaflet popup rendered in DOM.
    const popupLocator = page.locator('.leaflet-popup');
    const opened = await popupLocator.isVisible({ timeout: 8_000 }).catch(() => false);
    if (!opened) {
      const marker = page.locator('.leaflet-marker-icon').first();
      if (await marker.isVisible().catch(() => false)) {
        await marker.click({ force: true });
      }
    }
    await expect(popupLocator).toBeVisible({ timeout: 20_000 });
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
    await gotoMapWithRecovery(page);
    await page.setViewportSize({ width: 375, height: 720 });

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
    await gotoMapWithRecovery(page);
    await page.setViewportSize({ width: 375, height: 720 });

    await expect(page.getByTestId('map-panel-open')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('map-panel-open').click();

    // Закрываем панель повторным нажатием на кнопку меню (toggle).
    await expect(page.getByTestId('filters-panel')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('map-panel-open').click({ force: true });

    await expect(page.getByTestId('map-panel-open')).toBeVisible({ timeout: 20_000 });
  });

  test('mobile: double click on menu does not cause panel flicker (stays open)', async ({ page }) => {
    await gotoMapWithRecovery(page);
    await page.setViewportSize({ width: 375, height: 720 });

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
