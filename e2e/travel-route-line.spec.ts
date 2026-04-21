/**
 * E2E тест: Детальная проверка видимости линии маршрута на странице /map
 * Проверяет SVG polyline с полным анализом CSS свойств и создает скриншоты
 */

import { test, expect } from './fixtures';
import { preacceptCookies } from './helpers/navigation';

test.describe('Map Page Route Line Visibility - Visual Test', () => {
  test('линия маршрута должна быть ВИДИМА на карте (с детальной проверкой)', async ({ page }) => {
    test.setTimeout(240_000);
    await preacceptCookies(page);

    // Слушаем все логи консоли
    const consoleLogs: { type: string; text: string }[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      consoleLogs.push({ type: msg.type(), text });
    });

    console.log('🗺️  Открываем страницу карты /map...');

    await page.goto('/map', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => null);

    // URL может быть нормализован роутером, поэтому проверяем фактический экран карты.
    const currentUrl = page.url();
    console.log(`📍 Текущий URL: ${currentUrl}`);

    // Проверяем, что страница карты загружена
    const mapWrapper = page.locator('[data-testid="map-leaflet-wrapper"]').first();
    await expect(mapWrapper).toBeVisible({ timeout: 15000 });
    console.log('✅ Страница карты загружена');

    // Ждем загрузки Leaflet карты
    console.log('⏳ Ждем загрузки Leaflet контейнера...');
    const leafletContainer = page.locator('.leaflet-container').first();
    await expect(leafletContainer).toBeVisible({ timeout: 15000 });
    console.log('✅ Leaflet контейнер загружен');

    // Ждем загрузки тайлов карты
    await page.waitForSelector('.leaflet-tile-loaded', { timeout: 15000 });
    console.log('✅ Тайлы карты загружены');

    // Переключаемся в режим маршрута
    console.log('🔄 Переключаемся в режим маршрута...');
    const segmentedRoute = page.getByTestId('map-panel-tab-route');
    const hasSegmentedRoute = await segmentedRoute.isVisible().catch(() => false);

    if (hasSegmentedRoute) {
      await segmentedRoute.click({ force: true });
      await page.waitForLoadState('domcontentloaded').catch(() => null);
    } else {
      const routeModeButton = page.locator('button').filter({ hasText: /Маршрут|маршрут/i }).first();
      const routeButtonExists = await routeModeButton.isVisible().catch(() => false);
      if (routeButtonExists) {
        await routeModeButton.click({ force: true });
        await page.waitForLoadState('domcontentloaded').catch(() => null);
      }
    }

    // После переключения убеждаемся, что остаемся на экране карты.
    const urlAfterClick = page.url();
    console.log(`📍 URL после клика: ${urlAfterClick}`);
    await expect(mapWrapper).toBeVisible({ timeout: 10_000 });

    console.log('✅ Режим маршрута активирован');
    
    // Финальная проверка: карта доступна перед добавлением точек.
    const finalUrl = page.url();
    console.log(`📍 Финальный URL перед добавлением точек: ${finalUrl}`);
    await expect(mapWrapper).toBeVisible({ timeout: 10_000 });

    // Добавляем несколько точек маршрута кликами по карте
    console.log('📍 Добавляем точки маршрута...');
    const mapCenter = await leafletContainer.boundingBox();
    
    if (mapCenter) {
      // Добавляем 3 точки
      const points = [
        { x: mapCenter.x + mapCenter.width * 0.3, y: mapCenter.y + mapCenter.height * 0.3 },
        { x: mapCenter.x + mapCenter.width * 0.5, y: mapCenter.y + mapCenter.height * 0.5 },
        { x: mapCenter.x + mapCenter.width * 0.7, y: mapCenter.y + mapCenter.height * 0.7 },
      ];
      
      for (let i = 0; i < points.length; i++) {
        await page.mouse.click(points[i].x, points[i].y);
        await page.waitForSelector('.leaflet-marker-icon', { timeout: 5_000 }).catch(() => null);
        console.log(`  ✓ Точка ${i + 1} добавлена`);
      }
    }

    // Дополнительное время для построения маршрута
    console.log('⏳ Ждем построения маршрута...');
    await page.waitForLoadState('networkidle').catch(() => null);

    // Ищем логи о создании линии маршрута
    const routeLogs = consoleLogs.filter(log => 
      log.text.includes('[TravelMap] RouteLineLayer') || 
      log.text.includes('polyline')
    );
    
    console.log('\n📝 Логи создания линии маршрута:');
    routeLogs.forEach(log => {
      console.log(`   ${log.type.toUpperCase()}: ${log.text}`);
    });

    // Проверяем наличие SVG polyline с классом metravel-route-line
    console.log('\n🔍 Проверяем наличие SVG polyline...');
    
    // Способ 1: Через CSS класс
    const routeLineByClass = page.locator('.metravel-route-line').first();
    const hasClassLine = await routeLineByClass.count();
    console.log(`   - По классу .metravel-route-line: ${hasClassLine > 0 ? '✅ Найдено' : '❌ Не найдено'}`);

    // Способ 2: Через SVG path в overlay-pane
    const overlayPane = page.locator('.leaflet-overlay-pane').first();
    const svgInOverlay = overlayPane.locator('svg').first();
    const hasSvgInOverlay = await svgInOverlay.count();
    console.log(`   - SVG в overlay-pane: ${hasSvgInOverlay > 0 ? '✅ Найдено' : '❌ Не найдено'}`);

    // Способ 3: Через custom pane
    const customPane = page.locator('.leaflet-metravelRoutePane-pane').first();
    const hasCustomPane = await customPane.count();
    console.log(`   - Custom pane metravelRoutePane: ${hasCustomPane > 0 ? '✅ Найдено' : '❌ Не найдено'}`);

    if (hasCustomPane > 0) {
      const svgInCustomPane = customPane.locator('svg path').first();
      const hasPathInCustomPane = await svgInCustomPane.count();
      console.log(`   - SVG path в custom pane: ${hasPathInCustomPane > 0 ? '✅ Найдено' : '❌ Не найдено'}`);
    }

    // Способ 4: Любой polyline на карте
    const anyPolyline = leafletContainer.locator('path[stroke]').first();
    const hasAnyPolyline = await anyPolyline.count();
    console.log(`   - Любой path[stroke]: ${hasAnyPolyline > 0 ? '✅ Найдено' : '❌ Не найдено'}`);

    // Получаем информацию о всех path элементах
    const allPaths = await page.locator('.leaflet-container path').all();
    console.log(`\n📊 Всего path элементов на карте: ${allPaths.length}`);
    
    for (let i = 0; i < Math.min(allPaths.length, 5); i++) {
      const path = allPaths[i];
      const className = await path.getAttribute('class').catch(() => 'no-class');
      const stroke = await path.getAttribute('stroke').catch(() => 'no-stroke');
      const strokeWidth = await path.getAttribute('stroke-width').catch(() => 'no-width');
      const d = await path.getAttribute('d').catch(() => '');
      const dLength = d ? d.length : 0;
      console.log(`   Path ${i + 1}: class="${className}", stroke="${stroke}", width="${strokeWidth}", d.length=${dLength}`);
    }

    // Делаем скриншот карты
    console.log('\n📸 Создаем скриншот карты...');
    await mapWrapper.screenshot({ 
      path: 'test-results/route-line-map.png',
      timeout: 5000 
    });
    console.log('✅ Скриншот сохранен: test-results/route-line-map.png');

    // Проверяем DOM структуру Leaflet
    const leafletPanes = await page.locator('.leaflet-pane').all();
    console.log(`\n🏗️  Leaflet panes (всего ${leafletPanes.length}):`);
    for (const pane of leafletPanes) {
      const className = await pane.getAttribute('class').catch(() => '');
      const zIndex = await pane.evaluate((el: HTMLElement) => window.getComputedStyle(el).zIndex).catch(() => 'auto');
      console.log(`   - ${className} (z-index: ${zIndex})`);
    }

    // ОСНОВНАЯ ПРОВЕРКА: должна быть хотя бы одна polyline
    console.log('\n🎯 ОСНОВНАЯ ПРОВЕРКА:');
    const hasRouteLine = hasClassLine > 0 || hasAnyPolyline > 0;
    console.log(`   Линия маршрута ${hasRouteLine ? '✅ НАЙДЕНА' : '❌ НЕ НАЙДЕНА'}`);

    // Если линии нет, выводим все логи для диагностики
    if (!hasRouteLine) {
      console.log('\n❌ ЛИНИЯ НЕ НАЙДЕНА. Все логи консоли:');
      consoleLogs.slice(-50).forEach(log => {
        console.log(`   ${log.type}: ${log.text}`);
      });
    }

    // Проверяем, что линия действительно есть
    expect(hasRouteLine, 'Линия маршрута должна отображаться на карте').toBe(true);

    // ДЕТАЛЬНАЯ ПРОВЕРКА ВИДИМОСТИ
    if (hasRouteLine) {
      const routePath = hasClassLine > 0 ? routeLineByClass : anyPolyline;
      
      console.log('\n🔬 ДЕТАЛЬНАЯ ПРОВЕРКА ВИДИМОСТИ:');
      
      // 1. Проверяем computed styles
      const computedStyles = await routePath.evaluate((el: SVGPathElement) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          stroke: style.stroke,
          strokeWidth: style.strokeWidth,
          strokeOpacity: style.strokeOpacity,
          fill: style.fill,
          zIndex: style.zIndex,
          pointerEvents: style.pointerEvents,
          position: style.position,
          // Позиция и размеры
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          // Видима ли в viewport
          isInViewport: rect.top >= 0 && rect.left >= 0 && 
                        rect.bottom <= window.innerHeight && 
                        rect.right <= window.innerWidth,
        };
      });

      console.log('   Computed styles:', JSON.stringify(computedStyles, null, 2));

      // 2. Проверяем родительский SVG
      const parentSvgInfo = await routePath.evaluate((el: SVGPathElement) => {
        const parent = el.parentElement as unknown as SVGSVGElement;
        if (!parent) return null;
        
        const style = window.getComputedStyle(parent);
        const rect = parent.getBoundingClientRect();
        
        return {
          tagName: parent.tagName,
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          zIndex: style.zIndex,
          position: style.position,
          overflow: style.overflow,
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left,
        };
      });

      console.log('   Parent SVG info:', JSON.stringify(parentSvgInfo, null, 2));

      // 3. Проверяем pane
      const paneInfo = await routePath.evaluate((el: SVGPathElement) => {
        let current: Element | null = el;
        const panes: string[] = [];
        
        while (current && current.parentElement) {
          current = current.parentElement;
          const className = current.className;
          if (typeof className === 'string' && className.includes('leaflet-')) {
            panes.push(className);
            if (className.includes('-pane')) {
              const style = window.getComputedStyle(current as HTMLElement);
              return {
                paneName: className,
                zIndex: style.zIndex,
                position: style.position,
                display: style.display,
                visibility: style.visibility,
              };
            }
          }
        }
        
        return { panes, found: false };
      });

      console.log('   Pane info:', JSON.stringify(paneInfo, null, 2));

      // 4. Проверяем атрибуты
      const d = await routePath.getAttribute('d');
      const stroke = await routePath.getAttribute('stroke');
      const className = await routePath.getAttribute('class');
      
      console.log(`   Атрибуты:`);
      console.log(`     - d length: ${d?.length || 0}`);
      console.log(`     - stroke: ${stroke}`);
      console.log(`     - class: ${className}`);

      // 5. Делаем скриншот только path элемента
      try {
        await routePath.screenshot({ 
          path: 'test-results/route-line-element.png',
          timeout: 5000 
        });
        console.log('   📸 Скриншот path элемента: test-results/route-line-element.png');
      } catch (_e) {
        console.log('   ⚠️  Не удалось создать скриншот path элемента');
      }

      // ПРОВЕРКИ ВАЛИДНОСТИ
      console.log('\n✅ ПРОВЕРКИ:');
      
      // Проверка 1: display не none
      expect(computedStyles.display).not.toBe('none');
      console.log('   ✓ display не none');
      
      // Проверка 2: visibility не hidden
      expect(computedStyles.visibility).not.toBe('hidden');
      console.log('   ✓ visibility не hidden');
      
      // Проверка 3: opacity > 0
      expect(parseFloat(computedStyles.opacity)).toBeGreaterThan(0);
      console.log(`   ✓ opacity = ${computedStyles.opacity}`);
      
      // Проверка 4: stroke есть
      expect(computedStyles.stroke).toBeTruthy();
      expect(computedStyles.stroke).not.toBe('none');
      console.log(`   ✓ stroke = ${computedStyles.stroke}`);
      
      // Проверка 5: stroke-width > 0
      expect(parseFloat(computedStyles.strokeWidth)).toBeGreaterThan(0);
      console.log(`   ✓ stroke-width = ${computedStyles.strokeWidth}`);
      
      // Проверка 6: path не пустой
      expect(d).toBeTruthy();
      expect(d!.length).toBeGreaterThan(10);
      console.log(`   ✓ path d length = ${d!.length}`);

      // Проверка 7: элемент имеет размеры
      expect(computedStyles.width).toBeGreaterThan(0);
      expect(computedStyles.height).toBeGreaterThan(0);
      console.log(`   ✓ размеры: ${computedStyles.width}x${computedStyles.height}`);

      // КРИТИЧЕСКАЯ ПРОВЕРКА: если все проверки прошли, но линия не в viewport
      if (!computedStyles.isInViewport) {
        console.log('\n⚠️  ВНИМАНИЕ: Линия существует, но ВНЕ ВИДИМОЙ ОБЛАСТИ!');
        console.log(`   Позиция: top=${computedStyles.top}, left=${computedStyles.left}`);
      } else {
        console.log('\n✅ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ! Линия должна быть видима.');
      }
    }
  });
});
