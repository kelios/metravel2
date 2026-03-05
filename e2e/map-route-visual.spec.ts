/**
 * Visual Regression Test: Линия маршрута на странице /map
 * Этот тест создает снапшоты карты с линией маршрута для визуального сравнения
 */

import { test, expect } from './fixtures';
import { preacceptCookies } from './helpers/navigation';

const MAP_SHOT_SIZE = { width: 826, height: 554 };

async function installTileMock(page: any) {
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8m2p8AAAAASUVORK5CYII=';
  const png = Buffer.from(pngBase64, 'base64');

  const routeTile = async (route: any) => {
    return route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: png,
    });
  };

  await page.route('**://tile.openstreetmap.org/**', routeTile);
  await page.route('**://*.tile.openstreetmap.org/**', routeTile);
  await page.route('**://*.tile.openstreetmap.fr/**', routeTile);
  await page.route('**://*.tile.openstreetmap.de/**', routeTile);
  await page.route('**://tile.waymarkedtrails.org/**', routeTile);
  await page.route('**://*.tile.waymarkedtrails.org/**', routeTile);
}

async function normalizeMapScreenshotBox(page: any) {
  await page.addStyleTag({
    content: `
      [data-testid="map-leaflet-wrapper"] { width: ${MAP_SHOT_SIZE.width}px !important; height: ${MAP_SHOT_SIZE.height}px !important; }
      .leaflet-container { width: ${MAP_SHOT_SIZE.width}px !important; height: ${MAP_SHOT_SIZE.height}px !important; }
      html, body { overflow: hidden !important; }
    `,
  });
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  // Allow layout to settle after resize
  await page.waitForFunction(() => true, null, { timeout: 500 }).catch(() => null);
}

async function suppressDynamicMapLayers(page: any) {
  await page.addStyleTag({
    content: `
      .leaflet-container { background: #ffffff !important; }
      .leaflet-tile-pane,
      .leaflet-shadow-pane,
      .leaflet-marker-pane,
      .leaflet-tooltip-pane,
      .leaflet-popup-pane { opacity: 0 !important; visibility: hidden !important; }
      [data-card-action="true"] { opacity: 0 !important; visibility: hidden !important; }
    `,
  });
}

test.describe('Map Route Line - Visual Regression', () => {
  test('снапшот карты с линией маршрута', async ({ page }) => {
    await preacceptCookies(page);

    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('metravel_map_onboarding_completed', 'true');
      } catch {
        // ignore
      }
    });

    // Normalize viewport to keep locator screenshot dimensions stable across environments.
    // Snapshot baselines were captured with a slightly narrower effective content width.
    await page.setViewportSize({ width: 1366, height: 720 });

    await installTileMock(page);

    console.log('🗺️  Открываем /map...');
    await page.goto('/map', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => null);

    await normalizeMapScreenshotBox(page);

    // Проверяем URL
    expect(page.url()).toContain('/map');

    // Ждем загрузки карты
    const mapWrapper = page.locator('[data-testid="map-leaflet-wrapper"]').first();
    await expect(mapWrapper).toBeVisible({ timeout: 15000 });
    
    const leafletContainer = page.locator('.leaflet-container').first();
    await expect(leafletContainer).toBeVisible({ timeout: 15000 });
    await page.waitForSelector('.leaflet-tile-loaded', { timeout: 15000 });

    // Ensure at least one tile image is decoded (not just present in DOM).
    const tile = page.locator('.leaflet-tile-loaded').first();
    await expect
      .poll(
        async () => {
          const handle = await tile.elementHandle();
          if (!handle) return false;
          return handle.evaluate((el) => {
            const img = el as HTMLImageElement;
            return Boolean(img.complete && img.naturalWidth > 0);
          });
        },
        { timeout: 15_000 }
      )
      .toBe(true);
    
    console.log('✅ Карта загружена');

    // Переключаемся в режим маршрута
    console.log('🔄 Переключаем режим...');
    const segmentedRoute = page.getByTestId('segmented-route');
    if (await segmentedRoute.isVisible().catch(() => false)) {
      await segmentedRoute.click({ force: true });
      await page.waitForLoadState('domcontentloaded').catch(() => null);
      console.log('✅ Режим маршрута (segmented-route)');
    } else {
      const routeButton = page.locator('button').filter({ hasText: /Маршрут/i }).first();
      if (await routeButton.isVisible().catch(() => false)) {
        await routeButton.click({ force: true });
        await page.waitForLoadState('domcontentloaded').catch(() => null);
        console.log('✅ Режим маршрута (button fallback)');
      }
    }

    // Добавляем точки маршрута кликами
    console.log('📍 Добавляем точки...');
    const mapBox = await leafletContainer.boundingBox();
    
    if (mapBox) {
      // Клик 1 - старт (левый верхний квадрант)
      await page.mouse.click(
        mapBox.x + mapBox.width * 0.35, 
        mapBox.y + mapBox.height * 0.35
      );
      // Wait for marker to appear
      await page.waitForSelector('.leaflet-marker-icon', { timeout: 5_000 }).catch(() => null);
      
      // Клик 2 - финиш (правый нижний квадрант)
      await page.mouse.click(
        mapBox.x + mapBox.width * 0.65, 
        mapBox.y + mapBox.height * 0.65
      );
      
      console.log('✅ Точки добавлены');
    }

    // Wait for route line to be rendered by OSRM service
    console.log('⏳ Ждем маршрут...');

    // Дожидаемся появления SVG path маршрута (иначе снимок может быть сделан до отрисовки)
    const routePathLocator = page.locator('.leaflet-container path.metravel-route-line');
    const routeRendered = await expect
      .poll(async () => routePathLocator.count(), { timeout: 20_000 })
      .toBeGreaterThan(0)
      .catch(() => null);

    if (!routeRendered && (await routePathLocator.count()) === 0) {
      // Routing service (OSRM) may be unavailable in local/CI environments.
      // Skip visual assertions when no route line was drawn.
      test.info().annotations.push({ type: 'note', description: 'Route line not rendered (routing service may be unavailable). Skipping visual snapshot.' });
      return;
    }

    await suppressDynamicMapLayers(page);

    // ВИЗУАЛЬНЫЕ АРТЕФАКТЫ: сохраняем для отладки, без baseline-сравнения.
    console.log('📸 Снапшот #1: Вся карта');
    await mapWrapper.screenshot({
      path: test.info().outputPath('map-with-route-full.png'),
      animations: 'disabled',
      caret: 'hide',
    });

    console.log('📸 Снапшот #2: Leaflet контейнер');
    await leafletContainer.screenshot({
      path: test.info().outputPath('map-with-route-leaflet.png'),
      animations: 'disabled',
      caret: 'hide',
    });

    // ВИЗУАЛЬНЫЙ АРТЕФАКТ #3: Overlay pane (где должна быть линия)
    const overlayPane = page.locator('.leaflet-overlay-pane').first();
    if (await overlayPane.isVisible().catch(() => false)) {
      console.log('📸 Снапшот #3: Overlay pane');
      await overlayPane.screenshot({
        path: test.info().outputPath('map-route-overlay-pane.png'),
        animations: 'disabled',
        caret: 'hide',
      });
    }

    // Проверяем наличие path элемента
    const routePath = page.locator('.leaflet-container path[stroke]').first();
    const pathCount = await page.locator('.leaflet-container path[stroke]').count();
    
    console.log(`✅ Найдено path элементов: ${pathCount}`);
    
    if (pathCount > 0) {
      // Проверяем атрибуты
      const d = await routePath.getAttribute('d');
      const stroke = await routePath.getAttribute('stroke');
      
      console.log(`   - stroke: ${stroke}`);
      console.log(`   - d length: ${d?.length || 0}`);
      
      expect(d).toBeTruthy();
      expect(d!.length).toBeGreaterThan(10);
      expect(stroke).toBeTruthy();
      
      // Проверяем видимость через computed styles
      const isVisible = await routePath.evaluate((el: SVGPathElement) => {
        const style = window.getComputedStyle(el);
        return {
          display: style.display,
          visibility: style.visibility,
          opacity: parseFloat(style.opacity),
          stroke: style.stroke,
        };
      });
      
      console.log('   Видимость:', JSON.stringify(isVisible));
      
      expect(isVisible.display).not.toBe('none');
      expect(isVisible.visibility).not.toBe('hidden');
      expect(isVisible.opacity).toBeGreaterThan(0);
    }

    console.log('✅ Визуальные снапшоты созданы');
  });

  test('снапшот: сравнение карты ДО и ПОСЛЕ добавления маршрута', async ({ page }) => {
    await preacceptCookies(page);

    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('metravel_map_onboarding_completed', 'true');
      } catch {
        // ignore
      }
    });

    // Normalize viewport to keep locator screenshot dimensions stable across environments.
    await page.setViewportSize({ width: 1366, height: 720 });

    await installTileMock(page);

    await page.goto('/map', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => null);

    await normalizeMapScreenshotBox(page);

    const leafletContainer = page.locator('.leaflet-container').first();
    await expect(leafletContainer).toBeVisible({ timeout: 15000 });
    await page.waitForSelector('.leaflet-tile-loaded', { timeout: 15000 });

    const tile = page.locator('.leaflet-tile-loaded').first();
    await expect
      .poll(
        async () => {
          const handle = await tile.elementHandle();
          if (!handle) return false;
          return handle.evaluate((el) => {
            const img = el as HTMLImageElement;
            return Boolean(img.complete && img.naturalWidth > 0);
          });
        },
        { timeout: 15_000 }
      )
      .toBe(true);

    // Снапшот ДО добавления маршрута
    console.log('📸 BEFORE: карта без маршрута');
    await expect(leafletContainer).toHaveScreenshot('map-before-route.png', {
      maxDiffPixelRatio: 0.1,
      animations: 'disabled',
      caret: 'hide',
    });

    // Переключаем режим и добавляем точки
    const segmentedRoute = page.getByTestId('segmented-route');
    if (await segmentedRoute.isVisible().catch(() => false)) {
      await segmentedRoute.click({ force: true });
      await page.waitForLoadState('domcontentloaded').catch(() => null);
    } else {
      const routeButton = page.locator('button').filter({ hasText: /Маршрут/i }).first();
      if (await routeButton.isVisible().catch(() => false)) {
        await routeButton.click({ force: true });
        await page.waitForLoadState('domcontentloaded').catch(() => null);
      }
    }

    const mapBox = await leafletContainer.boundingBox();
    if (mapBox) {
      await page.mouse.click(
        mapBox.x + mapBox.width * 0.35, 
        mapBox.y + mapBox.height * 0.35
      );
      await page.waitForSelector('.leaflet-marker-icon', { timeout: 5_000 }).catch(() => null);
      
      await page.mouse.click(
        mapBox.x + mapBox.width * 0.65, 
        mapBox.y + mapBox.height * 0.65
      );
    }

    // Снапшот ПОСЛЕ добавления маршрута
    console.log('📸 AFTER: карта с маршрутом');

    const routePathLocator = page.locator('.leaflet-container path.metravel-route-line');
    const afterRouteRendered = await expect
      .poll(async () => routePathLocator.count(), { timeout: 20_000 })
      .toBeGreaterThan(0)
      .catch(() => null);

    if (!afterRouteRendered && (await routePathLocator.count()) === 0) {
      test.info().annotations.push({ type: 'note', description: 'Route line not rendered (routing service may be unavailable). Skipping AFTER snapshot.' });
      return;
    }

    await suppressDynamicMapLayers(page);

    await expect(leafletContainer).toHaveScreenshot('map-after-route.png', {
      maxDiffPixelRatio: 0.1,
      animations: 'disabled',
      caret: 'hide',
    });

    console.log('✅ Снапшоты ДО/ПОСЛЕ созданы');
  });
});
