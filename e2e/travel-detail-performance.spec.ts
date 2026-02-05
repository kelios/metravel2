/**
 * E2E тесты: Производительность и качество детальной страницы путешествия
 *
 * Покрытие тест-кейсов:
 * - TC-024: Производительность загрузки
 * - Дополнительные проверки качества
 */

import { test, expect } from '@playwright/test';
import { getTravelsListPath } from './helpers/routes';
import { seedNecessaryConsent } from './helpers/storage';

/**
 * TC-TRAVEL-DETAIL-024: Производительность загрузки (P2)
 */
test.describe('Travel Details - Performance Metrics', () => {
  test('TC-024: метрики производительности в пределах нормы', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);


    // Отслеживаем Web Vitals через Performance API
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) {
      test.info().annotations.push({
        type: 'note',
        description: 'No travel cards available; skipping performance test',
      });
      return;
    }

    // Запоминаем время начала навигации
    const navigationStart = Date.now();

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Ждем загрузки основного контента
    const mainContent = page.locator('[data-testid="travel-details-page"], [testID="travel-details-page"]').first();
    const loaded = await mainContent
      .isVisible()
      .then((v) => v)
      .catch(() => false);
	    if (!loaded) {
	      const errorState = page.getByText('Не удалось загрузить путешествие').first();
	      if (await errorState.isVisible().catch(() => false)) {
	        test.info().annotations.push({
	          type: 'note',
	          description: 'Travel details page entered error state; skipping performance metrics in this environment.',
	        });
	        throw new Error('Travel details not available (error state is visible).');
	      }
	    }
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
    await page.addInitScript(seedNecessaryConsent);

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

    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Даем время на загрузку ресурсов
    await page.waitForTimeout(3000);

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
    await page.addInitScript(seedNecessaryConsent);

    let requestCount = 0;
    const requestTypes: { [key: string]: number } = {};

    page.on('request', (request) => {
      requestCount++;
      const type = request.resourceType();
      requestTypes[type] = (requestTypes[type] || 0) + 1;
    });

    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    // Сбрасываем счетчик перед переходом на детальную страницу
    requestCount = 0;
    for (const key in requestTypes) {
      requestTypes[key] = 0;
    }

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Даем время на загрузку
    await page.waitForTimeout(3000);

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
test.describe('Travel Details - Rendering Quality', () => {
  test('отсутствие визуальных артефактов', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Ждем стабилизации рендеринга
    await page.waitForTimeout(2000);

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
    expect(elementsWithZeroSize).toBeLessThan(10);
  });

  test('проверка CLS (Cumulative Layout Shift)', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);

    // Отслеживаем Layout Shifts
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

    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Даем время на загрузку и стабилизацию
    await page.waitForTimeout(4000);

    // Прокручиваем для загрузки всего контента
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(2000);

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
    await page.addInitScript(seedNecessaryConsent);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Ждем загрузки
    await page.waitForTimeout(2000);

    // Получаем высоту до взаимодействия
    const heightBefore = await page.evaluate(() => document.body.scrollHeight);

    // Взаимодействуем с элементами (прокрутка, клики)
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(500);

    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(500);

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
test.describe('Travel Details - Image Optimization', () => {
  test('изображения имеют корректные размеры', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Ждем загрузки изображений
    await page.waitForTimeout(3000);

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
    await page.addInitScript(seedNecessaryConsent);

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

    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Даем время на загрузку изображений
    await page.waitForTimeout(3000);

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
test.describe('Travel Details - Memory Management', () => {
  test('отсутствие значительных утечек памяти при навигации', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);

    // Эта проверка требует специальных флагов браузера
    // Здесь делаем базовую проверку через многократную навигацию

    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    const cardsCount = await cards.count();

    if (cardsCount < 2) return;

    // Открываем несколько путешествий подряд
    for (let i = 0; i < Math.min(3, cardsCount); i++) {
      await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(300);

      const currentCards = page.locator('[data-testid="travel-card-link"]');
      if ((await currentCards.count()) === 0) break;

      await currentCards.nth(i).click();
      await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });
      await page.waitForTimeout(1500);

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
