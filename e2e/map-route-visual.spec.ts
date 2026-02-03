/**
 * Visual Regression Test: Линия маршрута на странице /map
 * Этот тест создает снапшоты карты с линией маршрута для визуального сравнения
 */

import { test, expect } from './fixtures';
import { seedNecessaryConsent, hideRecommendationsBanner } from './helpers/storage';

test.describe('Map Route Line - Visual Regression', () => {
  test('снапшот карты с линией маршрута', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.addInitScript(hideRecommendationsBanner);

    console.log('🗺️  Открываем /map...');
    await page.goto('/map', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Проверяем URL
    expect(page.url()).toContain('/map');

    // Ждем загрузки карты
    const mapWrapper = page.locator('[data-testid="map-leaflet-wrapper"]').first();
    await expect(mapWrapper).toBeVisible({ timeout: 15000 });
    
    const leafletContainer = page.locator('.leaflet-container').first();
    await expect(leafletContainer).toBeVisible({ timeout: 15000 });
    await page.waitForSelector('.leaflet-tile-loaded', { timeout: 15000 });
    
    console.log('✅ Карта загружена');

    // Переключаемся в режим маршрута
    console.log('🔄 Переключаем режим...');
    const routeButton = page.locator('button').filter({ hasText: /Маршрут/i }).first();
    
    if (await routeButton.isVisible().catch(() => false)) {
      await routeButton.click();
      await page.waitForTimeout(1000);
      console.log('✅ Режим маршрута');
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
      await page.waitForTimeout(500);
      
      // Клик 2 - финиш (правый нижний квадрант)
      await page.mouse.click(
        mapBox.x + mapBox.width * 0.65, 
        mapBox.y + mapBox.height * 0.65
      );
      await page.waitForTimeout(1000);
      
      console.log('✅ Точки добавлены');
    }

    // Ждем построения маршрута
    console.log('⏳ Ждем маршрут...');
    await page.waitForTimeout(5000);
    
    // Дополнительно ждем отрисовки
    await page.waitForTimeout(2000);

    // ВИЗУАЛЬНЫЙ СНАПШОТ #1: Вся карта с маршрутом
    console.log('📸 Снапшот #1: Вся карта');
    await expect(mapWrapper).toHaveScreenshot('map-with-route-full.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });

    // ВИЗУАЛЬНЫЙ СНАПШОТ #2: Только Leaflet контейнер
    console.log('📸 Снапшот #2: Leaflet контейнер');
    await expect(leafletContainer).toHaveScreenshot('map-with-route-leaflet.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });

    // ВИЗУАЛЬНЫЙ СНАПШОТ #3: Overlay pane (где должна быть линия)
    const overlayPane = page.locator('.leaflet-overlay-pane').first();
    if (await overlayPane.isVisible().catch(() => false)) {
      console.log('📸 Снапшот #3: Overlay pane');
      await expect(overlayPane).toHaveScreenshot('map-route-overlay-pane.png', {
        maxDiffPixels: 50,
        threshold: 0.2,
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
    await page.addInitScript(seedNecessaryConsent);
    await page.addInitScript(hideRecommendationsBanner);

    await page.goto('/map', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const leafletContainer = page.locator('.leaflet-container').first();
    await expect(leafletContainer).toBeVisible({ timeout: 15000 });
    await page.waitForSelector('.leaflet-tile-loaded', { timeout: 15000 });

    // Снапшот ДО добавления маршрута
    console.log('📸 BEFORE: карта без маршрута');
    await expect(leafletContainer).toHaveScreenshot('map-before-route.png', {
      maxDiffPixels: 100,
    });

    // Переключаем режим и добавляем точки
    const routeButton = page.locator('button').filter({ hasText: /Маршрут/i }).first();
    if (await routeButton.isVisible().catch(() => false)) {
      await routeButton.click();
      await page.waitForTimeout(1000);
    }

    const mapBox = await leafletContainer.boundingBox();
    if (mapBox) {
      await page.mouse.click(
        mapBox.x + mapBox.width * 0.35, 
        mapBox.y + mapBox.height * 0.35
      );
      await page.waitForTimeout(500);
      
      await page.mouse.click(
        mapBox.x + mapBox.width * 0.65, 
        mapBox.y + mapBox.height * 0.65
      );
      await page.waitForTimeout(3000);
    }

    // Снапшот ПОСЛЕ добавления маршрута
    console.log('📸 AFTER: карта с маршрутом');
    await expect(leafletContainer).toHaveScreenshot('map-after-route.png', {
      maxDiffPixels: 100,
    });

    console.log('✅ Снапшоты ДО/ПОСЛЕ созданы');
  });
});
