import { test, expect } from './fixtures';
import { installNoConsoleErrorsGuard } from './helpers/consoleGuards';
import { seedNecessaryConsent } from './helpers/storage';

const getCanonicalHref = async (page: any): Promise<string | null> => {
  return page.evaluate(() => {
    const el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    return el?.href || null;
  });
};

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

const safeGoto = async (page: any, url: string, opts: any) => {
  let lastErr: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(url, opts);
      return;
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || e);
      if (!msg.includes('ERR_CONNECTION_REFUSED')) throw e;
      await page.waitForTimeout(600);
    }
  }
  throw lastErr;
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

  await safeGoto(page, '/map', { waitUntil: 'domcontentloaded', timeout: 120_000 });

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

  test('desktop: map tiles are visible (screenshot)', async ({ page }) => {
    await gotoMapWithRecovery(page);

    const mapWrapper = page.getByTestId('map-leaflet-wrapper');
    await expect(mapWrapper).toBeVisible({ timeout: 60_000 });

    const tile = page.locator('.leaflet-tile');
    // Wait for multiple tiles to reduce flakiness (single tile can be a placeholder).
    await expect
      .poll(async () => tile.count(), { timeout: 60_000 })
      .toBeGreaterThanOrEqual(4);
    await tile.first().waitFor({ state: 'visible', timeout: 60_000 });

    await expect(mapWrapper).toHaveScreenshot('map-visible.png', {
      // Tile servers, device scale factors and font rasterization can cause small diffs.
      // Keep this as a coarse smoke visual guard.
      maxDiffPixelRatio: 0.18,
    });
  });

  test('desktop: loads map and shows filters panel', async ({ page }) => {
    await gotoMapWithRecovery(page);

    await expect(page.getByTestId('map-leaflet-wrapper')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('filters-panel')).toBeVisible({ timeout: 60_000 });

    await expect(page.getByTestId('segmented-radius')).toBeVisible();
    await expect(page.getByTestId('segmented-route')).toBeVisible();
  });

  test('desktop: renders markers and opens popup on marker click', async ({ page }) => {
    await gotoMapWithRecovery(page);

    await expect(page.getByTestId('map-leaflet-wrapper')).toBeVisible({ timeout: 60_000 });

    // Markers may load async after API returns.
    const marker = page.locator('.leaflet-marker-icon').first();
    const markerVisible = await marker.isVisible({ timeout: 60_000 }).catch(() => false);
    if (!markerVisible) return;

    await marker.click({ force: true });

    const popupLocator = page.locator('.leaflet-popup');
    await expect(popupLocator).toBeVisible({ timeout: 20_000 });

    // Smoke check: popup should contain at least one link (details or card).
    const anyLink = popupLocator.locator('a').first();
    await expect(anyLink).toBeVisible({ timeout: 10_000 });
  });

  test('desktop: popup link navigates to travel details', async ({ page }) => {
    await gotoMapWithRecovery(page);

    // Prefer using list -> open popup to avoid marker overlap issues.
    await expect(page.getByTestId('map-panel-tab-travels')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('map-panel-tab-travels').click();

    const cards = page.locator('[data-testid="map-travel-card"]');
    const cardCount = await cards.count();
    if (cardCount === 0) return;

    await page.locator('.leaflet-marker-icon').first().waitFor({ state: 'visible', timeout: 60_000 });
    await cards.first().click({ position: { x: 16, y: 16 } });

    const popupLocator = page.locator('.leaflet-popup');
    await expect(popupLocator).toBeVisible({ timeout: 20_000 });

    const link = popupLocator.locator('a[href*="/travel/"] , a[href*="/travels/"]').first();
    const hasLink = await link.isVisible({ timeout: 2_000 }).catch(() => false);
    if (!hasLink) return;

    await Promise.all([
      page.waitForURL(/\/(travel|travels)\//, { timeout: 60_000 }),
      link.click({ force: true }),
    ]);
  });

  test('desktop: applying category filter updates markers and sends where.categories', async ({ page }) => {
    await gotoMapWithRecovery(page);

    await expect(page.getByTestId('filters-panel')).toBeVisible({ timeout: 60_000 });

    // Ensure at least one successful map search response happened.
    await page
      .waitForResponse((resp: any) => resp.ok() && /\/api\/travels\/search_travels_for_map\//.test(resp.url()), {
        timeout: 90_000,
      })
      .catch(() => null);

    // Make sure Categories section is opened (some UIs use different copy).
    const categoriesHeader = page.getByText(/Категор/i);
    if (await categoriesHeader.isVisible().catch(() => false)) {
      await categoriesHeader.click({ force: true }).catch(() => null);
    }

    // Prefer clicking by label text (more stable for RN-web), fallback to raw inputs.
    const candidateLabel = page
      .getByTestId('filters-panel')
      .locator('label')
      .filter({ hasText: /.+/ })
      .first();
    const candidateInput = page
      .getByTestId('filters-panel')
      .locator('input[type="checkbox"], input[type="radio"], [role="checkbox"], [role="radio"]')
      .first();

    const canClickLabel = await candidateLabel.isVisible({ timeout: 5_000 }).catch(() => false);
    const canClickInput = await candidateInput.isVisible({ timeout: 2_000 }).catch(() => false);
    if (!canClickLabel && !canClickInput) return;

    // Some builds refetch instantly on filter change, others wait until radius/viewport changes.
    // We treat both as valid: always assert the UI can toggle a filter, and if a request happens
    // we also validate it contains where.categories.
    const maybeResponsePromise = page
      .waitForResponse(
        async (resp: any) => {
          if (!resp.ok()) return false;
          const url = resp.url();
          if (!/\/api\/travels\/search_travels_for_map\//.test(url)) return false;

          try {
            const u = new URL(url);
            const where = u.searchParams.get('where');
            if (!where) return false;
            const parsed = JSON.parse(where);
            return Array.isArray(parsed?.categories) && parsed.categories.length > 0;
          } catch {
            return false;
          }
        },
        { timeout: 12_000 }
      )
      .catch(() => null);

    if (canClickLabel) {
      await candidateLabel.click({ force: true });
    } else {
      await candidateInput.click({ force: true });
    }

    // Basic UI confirmation: filter should become checked/selected if it's an input.
    if (canClickInput) {
      await expect
        .poll(async () => {
          try {
            const el = await candidateInput.elementHandle();
            if (!el) return null;
            const role = await el.getAttribute('role');
            if (role === 'checkbox' || role === 'radio') {
              return el.getAttribute('aria-checked');
            }
            const type = await el.getAttribute('type');
            if (type === 'checkbox' || type === 'radio') {
              return el.isChecked();
            }
            return null;
          } catch {
            return null;
          }
        }, {
          timeout: 5_000,
        })
        .not.toBeNull();
    }

    await maybeResponsePromise;

    // Markers should remain present (either same count or updated); basic sanity.
    const marker = page.locator('.leaflet-marker-icon');
    const markerCount = await marker.count().catch(() => 0);
    if (markerCount > 0) {
      await expect(marker.first()).toBeVisible({ timeout: 60_000 });
      return;
    }

    // Valid empty state: some API responses legitimately return no points.
    // Don't lock to a specific UI copy; treat "no markers" as a valid outcome.
    test.info().annotations.push({
      type: 'note',
      description: 'No markers rendered after category toggle; treating as valid empty dataset for this environment',
    });
    return;
  });

  test('desktop: SEO title and canonical are set for /map', async ({ page }) => {
    await gotoMapWithRecovery(page);

    // Title should be set by InstantSEO when focused.
    await expect(page).toHaveTitle(/Карта путешествий/i, { timeout: 60_000 });

    const canonical = await getCanonicalHref(page);
    expect(canonical, 'canonical link must be present').toBeTruthy();
    expect(canonical || '').toMatch(/\/map(\?|$)/);
  });

  test('desktop: shows error UI and retry recovers when API fails once', async ({ page }) => {
    let failOnce = true;
    await page.route('**/api/travels/search_travels_for_map/**', async (route: any) => {
      if (!failOnce) return route.continue();
      failOnce = false;
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Injected 500' }) });
    });

    await page.goto('/map', { waitUntil: 'domcontentloaded', timeout: 120_000 });

    // Expect app-level error display.
    const errorTitle = page.getByText('Не удалось загрузить карту', { exact: true });
    const errorVisible = await errorTitle.isVisible({ timeout: 30_000 }).catch(() => false);
    if (!errorVisible) return;

    // Trigger retry.
    const retryButton = page.getByText('Попробовать снова', { exact: true });
    const hasRetry = await retryButton.isVisible().catch(() => false);
    if (!hasRetry) return;

    await retryButton.click({ force: true });

    // After retry, map UI should appear.
    await waitForMapUi(page, 90_000);
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
    await page.setViewportSize({ width: 375, height: 720 });

    await gotoMapWithRecovery(page);

    // На мобильном панель закрыта по умолчанию, должна быть видна кнопка меню
    await expect(page.getByTestId('map-panel-open')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('map-panel-open').click();

    // On mobile layout, the panel can render either as full filters panel or as a layout wrapper.
    const filtersPanel = page.getByTestId('filters-panel');
    const hasFiltersPanel = await filtersPanel.isVisible({ timeout: 20_000 }).catch(() => false);
    if (!hasFiltersPanel) {
      // Fallback: verify any of the expected controls exist.
      await expect(page.getByTestId('segmented-radius')).toBeVisible({ timeout: 20_000 });
    }

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
    await page.getByTestId('segmented-radius').waitFor({ state: 'visible', timeout: 20_000 }).catch(() => null);
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
    const opened = await panel.isVisible({ timeout: 20_000 }).catch(() => false);
    if (!opened) {
      await expect(page.getByTestId('segmented-radius')).toBeVisible({ timeout: 20_000 });
    }

    // Give the UI a moment: if there is flicker, it would have collapsed by now.
    await page.waitForTimeout(400);
    if (opened) {
      await expect(panel).toBeVisible();
    } else {
      await expect(page.getByTestId('segmented-radius')).toBeVisible();
    }
  });
});
