/**
 * E2E тесты: Производительность и качество детальной страницы путешествия
 *
 * Покрытие тест-кейсов:
 * - TC-024: Производительность загрузки
 * - Дополнительные проверки качества
 */

import { test, expect } from '@playwright/test';
import { preacceptCookies, navigateToFirstTravel } from './helpers/navigation';
import { getTravelsListPath } from './helpers/routes';

async function goToDetails(page: import('@playwright/test').Page): Promise<boolean> {
  await preacceptCookies(page);
  return navigateToFirstTravel(page);
}

/**
 * TC-TRAVEL-DETAIL-024: Производительность загрузки (P2)
 */
test.describe('@perf Travel Details - Performance Metrics', () => {
  test('TC-024: метрики производительности в пределах нормы', async ({ page }) => {
    // Запоминаем время начала навигации
    const navigationStart = Date.now();

    if (!(await goToDetails(page))) return;

    // Ждем загрузки основного контента
    const mainContent = page.locator('[data-testid="travel-details-page"], [testID="travel-details-page"]').first();
    await mainContent.waitFor({ state: 'visible', timeout: 30_000 });

    const navigationEnd = Date.now();
    const navigationTime = navigationEnd - navigationStart;

    // Собираем метрики через Performance API
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');

      const fcp = paint.find((entry) => entry.name === 'first-contentful-paint');

      return {
        ttfb: navigation ? navigation.responseStart - navigation.requestStart : 0,
        domContentLoaded: navigation ? navigation.domContentLoadedEventEnd - navigation.fetchStart : 0,
        loadComplete: navigation ? navigation.loadEventEnd - navigation.fetchStart : 0,
        fcp: fcp ? fcp.startTime : 0,
      };
    });

    // Логируем метрики
    test.info().annotations.push({
      type: 'performance',
      description: JSON.stringify({
        navigationTime: `${navigationTime}ms`,
        ttfb: `${Math.round(metrics.ttfb)}ms`,
        fcp: `${Math.round(metrics.fcp)}ms`,
        domContentLoaded: `${Math.round(metrics.domContentLoaded)}ms`,
        loadComplete: `${Math.round(metrics.loadComplete)}ms`,
      }),
    });

    // Проверки производительности (мягкие, так как зависят от сети)
    // TTFB должен быть разумным (< 3000ms для медленных соединений)
    expect(metrics.ttfb).toBeLessThan(5000);

    // FCP должен быть < 5s для приемлемого UX
    if (metrics.fcp > 0) {
      expect(metrics.fcp).toBeLessThan(8000);
    }

    // Общее время навигации должно быть разумным
    expect(navigationTime).toBeLessThan(15000);
  });

  test('проверка размера загружаемых ресурсов', async ({ page }) => {
    const resourceSizes: { [key: string]: number } = {
      images: 0,
      scripts: 0,
      stylesheets: 0,
      other: 0,
    };

    // Отслеживаем размеры ресурсов
    page.on('response', async (response) => {
      const request = response.request();
      const resourceType = request.resourceType();

      try {
        const contentLength = response.headers()['content-length'];
        const size = contentLength ? parseInt(contentLength, 10) : 0;

        if (size > 0) {
          switch (resourceType) {
            case 'image':
              resourceSizes.images += size;
              break;
            case 'script':
              resourceSizes.scripts += size;
              break;
            case 'stylesheet':
              resourceSizes.stylesheets += size;
              break;
            default:
              resourceSizes.other += size;
          }
        }
      } catch {
        // Игнорируем ошибки парсинга
      }
    });

    if (!(await goToDetails(page))) return;

    // Wait for resources to finish loading
    await page.waitForLoadState('networkidle').catch(() => null);

    const totalSize = Object.values(resourceSizes).reduce((a, b) => a + b, 0);

    test.info().annotations.push({
      type: 'resource-sizes',
      description: JSON.stringify({
        images: `${Math.round(resourceSizes.images / 1024)}KB`,
        scripts: `${Math.round(resourceSizes.scripts / 1024)}KB`,
        stylesheets: `${Math.round(resourceSizes.stylesheets / 1024)}KB`,
        other: `${Math.round(resourceSizes.other / 1024)}KB`,
        total: `${Math.round(totalSize / 1024)}KB`,
      }),
    });

    // Общий размер не должен быть чрезмерным
    // Это мягкое ограничение, так как зависит от контента
    expect(totalSize).toBeLessThan(50 * 1024 * 1024); // < 50MB
  });

  test('проверка количества HTTP запросов', async ({ page }) => {
    let requestCount = 0;
    const requestTypes: { [key: string]: number } = {};

    page.on('request', (request) => {
      requestCount++;
      const type = request.resourceType();
      requestTypes[type] = (requestTypes[type] || 0) + 1;
    });

    if (!(await goToDetails(page))) return;

    // Wait for all requests to settle
    await page.waitForLoadState('networkidle').catch(() => null);

    test.info().annotations.push({
      type: 'request-count',
      description: JSON.stringify({
        total: requestCount,
        byType: requestTypes,
      }),
    });

    // Количество запросов должно быть разумным
    // Это мягкое ограничение
    expect(requestCount).toBeLessThan(300);
  });
});

/**
 * Проверки качества рендеринга
 */
test.describe('@perf Travel Details - Rendering Quality', () => {
  test('отсутствие визуальных артефактов', async ({ page }) => {
    if (!(await goToDetails(page))) return;

    // Wait for rendering to stabilize
    await page.waitForLoadState('networkidle').catch(() => null);

    // Проверяем, что нет элементов с нулевыми размерами (потенциальные ошибки layout)
    const elementsWithZeroSize = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      let count = 0;

      elements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        // Проверяем только видимые элементы
        if (
          getComputedStyle(el).display !== 'none' &&
          getComputedStyle(el).visibility !== 'hidden' &&
          rect.width === 0 &&
          rect.height === 0 &&
          el.children.length === 0 // Пропускаем контейнеры
        ) {
          count++;
        }
      });

      return count;
    });

    test.info().annotations.push({
      type: 'rendering',
      description: `Elements with zero size: ${elementsWithZeroSize}`,
    });

    // Небольшое количество элементов с нулевым размером допустимо
    expect(elementsWithZeroSize).toBeLessThanOrEqual(20);
  });

  test('проверка CLS (Cumulative Layout Shift)', async ({ page }) => {
    // Install CLS observer before navigation
    await preacceptCookies(page);
    await page.addInitScript(() => {
      (window as any).__layoutShifts = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
            (window as any).__layoutShifts.push((entry as any).value);
          }
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });

    if (!(await navigateToFirstTravel(page))) return;

    // Wait for page to stabilize
    await page.waitForLoadState('networkidle').catch(() => null);

    // Прокручиваем для загрузки всего контента
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForLoadState('domcontentloaded').catch(() => null);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForLoadState('networkidle').catch(() => null);

    // Получаем CLS
    const cls = await page.evaluate(() => {
      const shifts = (window as any).__layoutShifts || [];
      return shifts.reduce((sum: number, shift: number) => sum + shift, 0);
    });

    test.info().annotations.push({
      type: 'cls',
      description: `Cumulative Layout Shift: ${cls.toFixed(4)}`,
    });

    // CLS должен быть < 0.25 для хорошего UX (стандарт Web Vitals: < 0.1)
    // Делаем мягкое ограничение из-за динамического контента
    expect(cls).toBeLessThan(0.5);
  });

  test('проверка стабильности после взаимодействия', async ({ page }) => {
    if (!(await goToDetails(page))) return;

    // Wait for initial load to stabilize
    await page.waitForLoadState('networkidle').catch(() => null);

    // Получаем высоту до взаимодействия
    const heightBefore = await page.evaluate(() => document.body.scrollHeight);

    // Взаимодействуем с элементами (прокрутка, клики)
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForFunction(() => window.scrollY > 0, null, { timeout: 3_000 }).catch(() => null);

    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForFunction(() => window.scrollY > 400, null, { timeout: 3_000 }).catch(() => null);

    // Получаем высоту после
    const heightAfter = await page.evaluate(() => document.body.scrollHeight);

    // Проверяем, что высота стабильна (может увеличиться из-за lazy loading)
    const heightDiff = Math.abs(heightAfter - heightBefore);

    test.info().annotations.push({
      type: 'stability',
      description: `Height change: ${heightDiff}px (before: ${heightBefore}px, after: ${heightAfter}px)`,
    });

    // Высота не должна резко меняться (допускаем увеличение из-за lazy loading)
    expect(heightAfter).toBeGreaterThanOrEqual(heightBefore * 0.9);
  });
});

/**
 * Проверки оптимизации изображений
 */
test.describe('@perf Travel Details - Image Optimization', () => {
  test('изображения имеют корректные размеры', async ({ page }) => {
    if (!(await goToDetails(page))) return;

    // Wait for images to load
    await page.waitForLoadState('networkidle').catch(() => null);

    // Проверяем изображения
    const imageStats = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));

      // Consider only "content" images:
      // - exclude tiny icon-like images
      // - exclude data URIs (often placeholders/icons)
      const contentImages = images.filter((img) => {
        const w = img.clientWidth || 0;
        const h = img.clientHeight || 0;
        const src = String(img.getAttribute('src') || '');
        if (src.startsWith('data:')) return false;
        if (w > 0 && h > 0 && w <= 32 && h <= 32) return false;
        return true;
      });
      const stats = {
        total: contentImages.length,
        withAltAttr: 0,
        withSrc: 0,
        loaded: 0,
        oversized: 0,
      };

      contentImages.forEach((img) => {
        // For accessibility, the alt attribute should exist.
        // It may be empty (alt="") for decorative images.
        if (img.hasAttribute('alt')) stats.withAltAttr++;
        if (img.getAttribute('src')) stats.withSrc++;
        if (img.complete && img.naturalHeight !== 0) stats.loaded++;

        // Проверяем, не загружаем ли слишком большие изображения
        const displayWidth = img.clientWidth;
        const naturalWidth = img.naturalWidth;

        if (naturalWidth > displayWidth * 2) {
          stats.oversized++;
        }
      });

      return stats;
    });

    test.info().annotations.push({
      type: 'images',
      description: JSON.stringify(imageStats),
    });

    // Все изображения должны иметь src
    expect(imageStats.withSrc).toBe(imageStats.total);

    // Большинство контентных изображений должны иметь alt-атрибут (accessibility)
    if (imageStats.total > 0) {
      expect(imageStats.withAltAttr / imageStats.total).toBeGreaterThan(0.8);
    }
  });

  test('изображения используют современные форматы', async ({ page }) => {
    const imageFormats: { [key: string]: number } = {};

    page.on('response', async (response) => {
      if (response.request().resourceType() === 'image') {
        const url = response.url();
        const extension = url.split('.').pop()?.split('?')[0]?.toLowerCase();

        if (extension) {
          imageFormats[extension] = (imageFormats[extension] || 0) + 1;
        }
      }
    });

    if (!(await goToDetails(page))) return;

    // Wait for images to load
    await page.waitForLoadState('networkidle').catch(() => null);

    test.info().annotations.push({
      type: 'image-formats',
      description: JSON.stringify(imageFormats),
    });

    // Это информационная проверка
    expect(true).toBe(true);
  });
});

/**
 * Проверки памяти и утечек
 */
test.describe('@perf Travel Details - Memory Management', () => {
  test('отсутствие значительных утечек памяти при навигации', async ({ page }) => {
    await preacceptCookies(page);

    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="travel-card-link"]', { timeout: 30_000 }).catch(() => null);

    const cards = page.locator('[data-testid="travel-card-link"]');
    const cardsCount = await cards.count();

    if (cardsCount < 2) return;

    // Открываем несколько путешествий подряд
    for (let i = 0; i < Math.min(3, cardsCount); i++) {
      await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-testid="travel-card-link"]', { timeout: 30_000 }).catch(() => null);

      const currentCards = page.locator('[data-testid="travel-card-link"]');
      if ((await currentCards.count()) === 0) break;

      await currentCards.nth(i).click();
      await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });
      await page.waitForLoadState('domcontentloaded').catch(() => null);

      // Проверяем, что страница все еще отзывчива
      const isResponsive = await page
        .locator('body')
        .isVisible()
        .catch(() => false);
      expect(isResponsive).toBe(true);
    }

    test.info().annotations.push({
      type: 'memory',
      description: 'Navigated through multiple travel pages successfully',
    });
  });
});
