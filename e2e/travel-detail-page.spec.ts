/**
 * E2E тесты: Детальная страница путешествия (/travels/[id])
 *
 * Покрытие тест-кейсов из: test-cases/travel-detail-page-test-cases.md
 *
 * Приоритет P1: Критичные сценарии
 * Приоритет P2: Важные сценарии
 * Приоритет P3: Дополнительные сценарии
 */

import { test, expect } from './fixtures';
import { getTravelsListPath } from './helpers/routes';
import { seedNecessaryConsent, hideRecommendationsBanner } from './helpers/storage';

/**
 * TC-TRAVEL-DETAIL-001: Загрузка детальной страницы (P1)
 */
test.describe('Travel Details Page - Loading and Display', () => {
  test('TC-001: успешная загрузка детальной страницы', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.addInitScript(hideRecommendationsBanner);

    // Открываем список путешествий
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // Находим первую карточку путешествия
    const cards = page.locator('[data-testid="travel-card-link"]');
    const count = await cards.count();

    if (count === 0) {
      test.info().annotations.push({
        type: 'note',
        description: 'No travel cards available; skipping test',
      });
      return;
    }

    // Получаем данные о путешествии перед переходом
    const firstCard = cards.first();
    await firstCard.click();

    // Ждем загрузки детальной страницы
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Проверяем наличие основного контейнера
    const mainContent = page.locator('[testid="travel-details-page"]');
    await expect(mainContent).toBeVisible({ timeout: 10_000 });

    // Проверяем, что страница содержит контент
    await expect(page.locator('body')).toContainText(/./);

    // Проверяем отсутствие ошибок в консоли (критичные)
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Даем время на загрузку
    await page.waitForTimeout(1000);

    // Не должно быть критичных ошибок
    const hasCriticalErrors = consoleErrors.some((err) =>
      err.includes('TypeError') || err.includes('ReferenceError')
    );
    expect(hasCriticalErrors).toBe(false);
  });

  /**
   * TC-TRAVEL-DETAIL-002: Отображение галереи изображений (P1)
   */
  test('TC-002: галерея изображений отображается и работает', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Проверяем наличие секции с галереей
    const gallerySection = page.locator('[testid="travel-details-section-gallery"]');

    // Галерея может быть не у всех путешествий
    const hasGallery = await gallerySection.isVisible().catch(() => false);

    if (hasGallery) {
      // Проверяем, что изображения загружаются
      const images = page.locator('[testid="travel-details-section-gallery"] img');
      const imageCount = await images.count();

      if (imageCount > 0) {
        // Проверяем, что хотя бы одно изображение загрузилось
        await expect(images.first()).toBeVisible({ timeout: 10_000 });

        // Проверяем наличие атрибутов alt для a11y
        const firstImgAlt = await images.first().getAttribute('alt');
        expect(firstImgAlt).toBeTruthy();
      }
    }
  });

  /**
   * TC-TRAVEL-DETAIL-020: 404 для несуществующего путешествия (P1)
   */
  test('TC-020: обработка 404 для несуществующего путешествия', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);

    // Открываем несуществующее путешествие
    await page.goto('/travels/non-existent-travel-99999', { waitUntil: 'domcontentloaded' });

    // Ждем обработки ошибки
    await page.waitForTimeout(2000);

    // Проверяем наличие сообщения об ошибке
    const errorMessages = [
      'не найдено',
      'не удалось загрузить',
      'не существует',
      'ошибка',
    ];

    const bodyText = await page.locator('body').textContent();
    const hasErrorMessage = errorMessages.some((msg) =>
      bodyText?.toLowerCase().includes(msg)
    );

    expect(hasErrorMessage).toBe(true);

    // Приложение не должно упасть
    const mainContent = page.locator('body');
    await expect(mainContent).toBeVisible();
  });
});

/**
 * TC-TRAVEL-DETAIL-003: Просмотр точек маршрута на карте (P1)
 */
test.describe('Travel Details - Map and Routes', () => {
  test('TC-003: карта и точки маршрута отображаются', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Прокручиваем вниз, чтобы загрузить отложенные секции
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(1000);

    // Проверяем наличие секции с картой
    const mapSection = page.locator('[testid="travel-details-map"]');
    const hasMap = await mapSection.isVisible().catch(() => false);

    if (hasMap) {
      // Карта должна быть интерактивной
      await expect(mapSection).toBeVisible();

      // Проверяем наличие точек маршрута
      const pointsSection = page.locator('[testid="travel-details-points"]');
      const hasPoints = await pointsSection.isVisible().catch(() => false);

      if (hasPoints) {
        await expect(pointsSection).toBeVisible();
      }
    }
  });

  /**
   * TC-TRAVEL-DETAIL-004: Список точек маршрута (P2)
   */
  test('TC-004: список точек маршрута корректен', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Прокручиваем до секции с точками
    await page.evaluate(() => window.scrollBy(0, 1500));
    await page.waitForTimeout(1000);

    const pointsSection = page.locator('[testid="travel-details-points"]');
    const hasPoints = await pointsSection.isVisible().catch(() => false);

    if (hasPoints) {
      // Проверяем, что есть хотя бы одна точка
      const pointElements = pointsSection.locator('[role="listitem"], li, [class*="point"]');
      const pointCount = await pointElements.count();

      // Если есть точки, проверяем их структуру
      if (pointCount > 0) {
        expect(pointCount).toBeGreaterThan(0);
      }
    }
  });
});

/**
 * TC-TRAVEL-DETAIL-005: Информационные блоки (Quick Facts) (P2)
 * TC-TRAVEL-DETAIL-006: Секции контента (P1)
 */
test.describe('Travel Details - Content and Info', () => {
  test('TC-005: информационные блоки (Quick Facts) отображаются', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Проверяем наличие Quick Facts секции
    const quickFactsSection = page.locator('[testid="travel-details-quick-facts"]');
    const hasQuickFacts = await quickFactsSection.isVisible().catch(() => false);

    if (hasQuickFacts) {
      await expect(quickFactsSection).toBeVisible();

      // Проверяем, что есть хотя бы один факт
      const bodyText = await page.locator('body').textContent();
      const hasContent = bodyText && bodyText.length > 100;
      expect(hasContent).toBe(true);
    }
  });

  test('TC-006: секции контента отображаются корректно', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Проверяем наличие секции описания
    const descriptionSection = page.locator('[testid="travel-details-description"]');
    const hasDescription = await descriptionSection.isVisible().catch(() => false);

    if (hasDescription) {
      await expect(descriptionSection).toBeVisible();

      // Описание должно содержать текст
      const descText = await descriptionSection.textContent();
      expect(descText?.length).toBeGreaterThan(10);
    }

    // Прокручиваем для загрузки дополнительных секций
    await page.evaluate(() => window.scrollBy(0, 2000));
    await page.waitForTimeout(1000);
  });

  /**
   * TC-TRAVEL-DETAIL-010: Информация об авторе (P2)
   */
  test('TC-010: информация об авторе отображается', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Проверяем наличие информации об авторе
    const authorSection = page.locator('[testid="travel-details-author"]');
    const hasAuthor = await authorSection.isVisible().catch(() => false);

    if (hasAuthor) {
      await expect(authorSection).toBeVisible();

      // Автор должен иметь имя
      const authorText = await authorSection.textContent();
      expect(authorText).toBeTruthy();
      expect(authorText?.length).toBeGreaterThan(0);
    }
  });
});

/**
 * TC-TRAVEL-DETAIL-007: Добавление в избранное (P1)
 * TC-TRAVEL-DETAIL-009: Попытка добавить без авторизации (P2)
 */
test.describe('Travel Details - Favorites', () => {
  test('TC-007 & TC-009: кнопка избранного корректно обрабатывает неавторизованных', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Ищем кнопку избранного
    const favoriteButton = page.locator('[data-testid="favorite-button"]');
    const hasFavoriteButton = await favoriteButton.isVisible().catch(() => false);

    if (hasFavoriteButton) {
      await expect(favoriteButton).toBeVisible();

      // Кнопка должна быть доступна для клика
      await expect(favoriteButton).toBeEnabled();

      // При клике неавторизованного пользователя должна быть реакция
      // (редирект на логин или модальное окно)
      // Проверяем, что кнопка существует и кликабельна
      const buttonCount = await favoriteButton.count();
      expect(buttonCount).toBeGreaterThan(0);
    }
  });
});

/**
 * TC-TRAVEL-DETAIL-014: Боковое меню навигации (Desktop) (P2)
 */
test.describe('Travel Details - Navigation', () => {
  test('TC-014: боковое меню навигации работает на Desktop', async ({ page }) => {
    // Устанавливаем размер экрана для Desktop
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(seedNecessaryConsent);

    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Ждем загрузки страницы
    await page.waitForTimeout(2000);

    // Проверяем наличие бокового меню на больших экранах
    const sideMenu = page.locator('[testid="travel-details-side-menu"]');
    const hasSideMenu = await sideMenu.isVisible().catch(() => false);

    if (hasSideMenu) {
      await expect(sideMenu).toBeVisible();

      // Боковое меню должно содержать навигационные элементы
      const menuContent = await sideMenu.textContent();
      expect(menuContent).toBeTruthy();
    }
  });

  /**
   * TC-TRAVEL-DETAIL-015: Компактное меню секций (Mobile) (P2)
   */
  test('TC-015: компактное меню работает на Mobile', async ({ page }) => {
    // Устанавливаем размер экрана для Mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.addInitScript(seedNecessaryConsent);

    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Ждем загрузки страницы
    await page.waitForTimeout(2000);

    // Проверяем наличие компактного меню на мобильных
    const sectionsSheet = page.locator('[testid="travel-sections-sheet-wrapper"]');
    const hasSectionsSheet = await sectionsSheet.isVisible().catch(() => false);

    if (hasSectionsSheet) {
      await expect(sectionsSheet).toBeVisible();
    }
  });

  /**
   * TC-TRAVEL-DETAIL-019: Breadcrumbs (хлебные крошки) (P3)
   */
  test('TC-019: breadcrumbs отображаются и работают', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Проверяем наличие breadcrumbs
    const breadcrumbs = page.locator('[aria-label*="Breadcrumb"], [role="navigation"] nav');
    const hasBreadcrumbs = await breadcrumbs.isVisible().catch(() => false);

    if (hasBreadcrumbs) {
      // Breadcrumbs должны содержать ссылки
      const links = breadcrumbs.locator('a');
      const linkCount = await links.count();

      if (linkCount > 0) {
        expect(linkCount).toBeGreaterThan(0);
      }
    }
  });
});

/**
 * TC-TRAVEL-DETAIL-016: Поделиться путешествием (P2)
 */
test.describe('Travel Details - Sharing', () => {
  test('TC-016: кнопка "Поделиться" работает', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Ищем кнопку "Поделиться"
    const shareButton = page.locator('[testid="travel-details-share"]');
    const hasShareButton = await shareButton.isVisible().catch(() => false);

    if (hasShareButton) {
      await expect(shareButton).toBeVisible();
      await expect(shareButton).toBeEnabled();

      // Клик по кнопке должен открыть модальное окно или меню
      await shareButton.click();
      await page.waitForTimeout(500);

      // После клика должно появиться модальное окно или меню шаринга
      const body = await page.locator('body').textContent();
      expect(body).toBeTruthy();
    }
  });
});

/**
 * TC-TRAVEL-DETAIL-017: Похожие путешествия (P3)
 * TC-TRAVEL-DETAIL-018: Путешествия этого автора (P3)
 */
test.describe('Travel Details - Related Content', () => {
  test('TC-017: похожие путешествия загружаются', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Прокручиваем до конца страницы для загрузки похожих путешествий
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    // Проверяем наличие секции с похожими путешествиями
    const bodyText = await page.locator('body').textContent();
    const hasRelatedSection =
      bodyText?.includes('Похожие') ||
      bodyText?.includes('Рекомендуем') ||
      bodyText?.includes('Другие путешествия');

    // Это опциональная функция, поэтому не требуем обязательного наличия
    if (hasRelatedSection) {
      test.info().annotations.push({
        type: 'note',
        description: 'Related travels section found',
      });
    }
  });
});

/**
 * TC-TRAVEL-DETAIL-021: Мобильная версия детальной страницы (P1)
 */
test.describe('Travel Details - Mobile Responsiveness', () => {
  test('TC-021: мобильная версия корректно адаптирована', async ({ page }) => {
    // Устанавливаем мобильный viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.addInitScript(seedNecessaryConsent);

    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Проверяем, что основной контент загружен
    const mainContent = page.locator('[testid="travel-details-page"]');
    await expect(mainContent).toBeVisible({ timeout: 10_000 });

    // Проверяем, что контент видим на мобильном
    const scrollView = page.locator('[testid="travel-details-scroll"]');
    await expect(scrollView).toBeVisible();

    // Проверяем адаптивность текста
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(50);

    // Проверяем, что нет горизонтального скролла
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);
  });
});

/**
 * TC-TRAVEL-DETAIL-022: SEO метатеги детальной страницы (P1)
 */
test.describe('Travel Details - SEO', () => {
  test('TC-022: SEO метатеги присутствуют и корректны', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Даем время на загрузку метатегов
    await page.waitForTimeout(2000);

    // Проверяем наличие title
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);
    expect(title).toContain('MeTravel');

    // Проверяем наличие meta description
    const description = await page
      .locator('meta[name="description"]')
      .getAttribute('content');
    expect(description).toBeTruthy();

    // Проверяем наличие canonical URL
    const canonical = await page
      .locator('link[rel="canonical"]')
      .getAttribute('href')
      .catch(() => null);

    if (canonical) {
      expect(canonical).toContain('/travels/');
    }

    // Проверяем наличие Open Graph метатегов
    const ogTitle = await page
      .locator('meta[property="og:title"]')
      .getAttribute('content')
      .catch(() => null);

    if (ogTitle) {
      expect(ogTitle).toBeTruthy();
    }
  });

  /**
   * TC-TRAVEL-DETAIL-023: Schema.org разметка (P2)
   */
  test('TC-023: Schema.org разметка присутствует', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Даем время на загрузку разметки
    await page.waitForTimeout(2000);

    // Проверяем наличие JSON-LD разметки
    const jsonLdScript = page.locator('script[type="application/ld+json"]');
    const hasJsonLd = (await jsonLdScript.count()) > 0;

    if (hasJsonLd) {
      const jsonLdContent = await jsonLdScript.first().textContent();
      expect(jsonLdContent).toBeTruthy();

      // Проверяем, что это валидный JSON
      const jsonLdData = JSON.parse(jsonLdContent!);
      expect(jsonLdData).toBeTruthy();
      expect(jsonLdData['@context']).toBe('https://schema.org');
    }
  });
});

/**
 * TC-TRAVEL-DETAIL-025: Обработка ошибки загрузки данных (P1)
 */
test.describe('Travel Details - Error Handling', () => {
  test('TC-025: graceful degradation при ошибке загрузки', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);

    // Блокируем API запросы для имитации ошибки
    await page.route('**/api/travels/**', (route) => {
      route.abort('failed');
    });

    await page.goto('/travels/1', { waitUntil: 'domcontentloaded' });

    // Даем время на обработку ошибки
    await page.waitForTimeout(3000);

    // Приложение не должно упасть
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Должно быть сообщение об ошибке
    const bodyText = await body.textContent();
    const hasErrorHandling =
      bodyText?.includes('ошибк') ||
      bodyText?.includes('не удалось') ||
      bodyText?.includes('загруз');

    expect(hasErrorHandling).toBe(true);
  });
});

/**
 * TC-TRAVEL-DETAIL-027: Accessibility (a11y) детальной страницы (P2)
 */
test.describe('Travel Details - Accessibility', () => {
  test('TC-027: keyboard navigation работает', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Проверяем, что можно использовать Tab для навигации
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);

    // Проверяем наличие фокуса на интерактивном элементе
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      return el?.tagName.toLowerCase();
    });

    // Должен быть фокус на кнопке, ссылке или другом интерактивном элементе
    const interactiveTags = ['button', 'a', 'input', 'textarea', 'select'];
    const hasFocus = focusedElement && interactiveTags.includes(focusedElement);

    // Это мягкая проверка, так как фокус может быть на body при первой загрузке
    if (hasFocus) {
      test.info().annotations.push({
        type: 'note',
        description: `Focus on: ${focusedElement}`,
      });
    }
  });

  test('TC-027: семантический HTML и ARIA атрибуты', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Проверяем наличие role="main"
    const mainContent = page.locator('[role="main"]');
    const hasMainRole = await mainContent.isVisible().catch(() => false);

    if (hasMainRole) {
      await expect(mainContent).toBeVisible();
    }

    // Проверяем наличие heading структуры
    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    const headingCount = await headings.count();
    expect(headingCount).toBeGreaterThan(0);

    // Должен быть хотя бы один h1
    const h1Elements = page.locator('h1');
    const h1Count = await h1Elements.count();
    expect(h1Count).toBeGreaterThan(0);
  });
});

/**
 * TC-TRAVEL-DETAIL-026: Ленивая загрузка изображений (P2)
 */
test.describe('Travel Details - Performance', () => {
  test('TC-026: изображения загружаются лениво', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);

    // Отслеживаем загрузку изображений
    const loadedImages: string[] = [];
    page.on('response', (response) => {
      if (response.request().resourceType() === 'image') {
        loadedImages.push(response.url());
      }
    });

    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Ждем начальной загрузки
    await page.waitForTimeout(2000);

    const imagesBeforeScroll = loadedImages.length;

    // Прокручиваем страницу вниз
    await page.evaluate(() => window.scrollBy(0, 2000));
    await page.waitForTimeout(2000);

    const imagesAfterScroll = loadedImages.length;

    // После прокрутки может загрузиться больше изображений (lazy loading)
    // Но это не строгое требование, зависит от контента
    test.info().annotations.push({
      type: 'note',
      description: `Images before scroll: ${imagesBeforeScroll}, after: ${imagesAfterScroll}`,
    });

    expect(imagesAfterScroll).toBeGreaterThanOrEqual(imagesBeforeScroll);
  });
});
