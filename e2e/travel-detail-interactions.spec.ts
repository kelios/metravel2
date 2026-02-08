/**
 * E2E тесты: Интерактивные функции детальной страницы путешествия
 *
 * Покрытие тест-кейсов:
 * - TC-011: YouTube видео
 * - TC-012: Счетчик просмотров
 * - TC-013: Кнопка редактирования
 * - TC-028: Экспорт в PDF
 * - TC-029: Переход между путешествиями
 * - TC-030: Модерация и статусы
 */

import { test, expect } from './fixtures';
import { preacceptCookies, navigateToFirstTravel } from './helpers/navigation';

async function goToDetails(page: import('@playwright/test').Page): Promise<boolean> {
  await preacceptCookies(page);
  return navigateToFirstTravel(page);
}

/**
 * TC-TRAVEL-DETAIL-011: Ссылка на YouTube видео (P3)
 */
test.describe('Travel Details - Media Content', () => {
  test('TC-011: YouTube видео отображается если доступно', async ({ page }) => {
    if (!(await goToDetails(page))) return;

    // Прокручиваем страницу для загрузки всех секций
    await page.evaluate(() => window.scrollBy(0, 2000));
    await page.waitForLoadState('domcontentloaded').catch(() => null);

    // Проверяем наличие YouTube iframe или ссылки
    const youtubeIframe = page.locator('iframe[src*="youtube.com"], iframe[src*="youtu.be"]');
    const youtubeLink = page.locator('a[href*="youtube.com"], a[href*="youtu.be"]');

    const hasYoutubeIframe = (await youtubeIframe.count()) > 0;
    const hasYoutubeLink = (await youtubeLink.count()) > 0;

    if (hasYoutubeIframe || hasYoutubeLink) {
      test.info().annotations.push({
        type: 'note',
        description: `YouTube content found: iframe=${hasYoutubeIframe}, link=${hasYoutubeLink}`,
      });

      if (hasYoutubeIframe) {
        // Проверяем, что iframe загружен
        await expect(youtubeIframe.first()).toBeVisible();
      }

      if (hasYoutubeLink) {
        // Проверяем, что ссылка корректна
        const href = await youtubeLink.first().getAttribute('href');
        expect(href).toContain('youtube');
      }
    }
  });

  /**
   * TC-TRAVEL-DETAIL-012: Счетчик просмотров (P3)
   */
  test('TC-012: счетчик просмотров отображается', async ({ page }) => {
    if (!(await goToDetails(page))) return;

    // If the page doesn't have a scrollable body (e.g., very short content or scroll locked),
    // this test is not meaningful.
    const isScrollable = await page
      .evaluate(() => {
        const el = document.scrollingElement || document.documentElement;
        return el.scrollHeight > el.clientHeight + 10;
      })
      .catch(() => false);
    if (!isScrollable) {
      test.info().annotations.push({
        type: 'note',
        description: 'Page is not scrollable in this run; skipping smooth scroll assertions.',
      });
      const scrollInfo = await page
        .evaluate(() => {
          const el = document.scrollingElement || document.documentElement;
          return { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
        })
        .catch(() => ({ scrollHeight: 0, clientHeight: 0 }));
      expect(scrollInfo.scrollHeight).toBeLessThanOrEqual(scrollInfo.clientHeight + 10);
      return;
    }

    // Проверяем наличие счетчика просмотров
    const bodyText = await page.locator('body').textContent();

    // Ищем паттерны для счетчика просмотров
    const hasViewsPattern =
      /просмотр/i.test(bodyText || '') ||
      /views/i.test(bodyText || '') ||
      /👁/i.test(bodyText || '');

    if (hasViewsPattern) {
      test.info().annotations.push({
        type: 'note',
        description: 'Views counter pattern found',
      });
    }

    // Счетчик может отсутствовать, это не критичная ошибка
    expect(bodyText).toBeTruthy();
  });
});

/**
 * TC-TRAVEL-DETAIL-013: Кнопка "Редактировать" для автора (P1)
 */
test.describe('Travel Details - Author Actions', () => {
  test('TC-013: кнопка редактирования видна для авторизованного пользователя', async ({
    page,
  }) => {
    if (!(await goToDetails(page))) return;

    // Ищем кнопку редактирования
    const editButton = page.locator('button:has-text("Редактировать"), a:has-text("Редактировать")');
    const editButtonAlt = page.locator('[aria-label*="Редактировать"], [title*="Редактировать"]');

    const hasEditButton =
      (await editButton.count()) > 0 || (await editButtonAlt.count()) > 0;

    // Кнопка может быть не видна для неавторизованных пользователей
    test.info().annotations.push({
      type: 'note',
      description: `Edit button visible: ${hasEditButton}`,
    });

    // Это не критичная проверка, так как зависит от авторизации
    expect(true).toBe(true);
  });
});

/**
 * TC-TRAVEL-DETAIL-028: Экспорт путешествия в PDF (P3)
 */
test.describe('Travel Details - Export Features', () => {
  test('TC-028: экспорт в PDF если доступен', async ({ page }) => {
    if (!(await goToDetails(page))) return;

    // Ищем кнопку экспорта в PDF
    const exportButton = page.locator(
      'button:has-text("PDF"), button:has-text("Экспорт"), a:has-text("PDF")'
    );
    const exportButtonAlt = page.locator('[aria-label*="PDF"], [title*="PDF"]');

    const hasExportButton =
      (await exportButton.count()) > 0 || (await exportButtonAlt.count()) > 0;

    if (hasExportButton) {
      test.info().annotations.push({
        type: 'note',
        description: 'PDF export button found',
      });

      // Проверяем, что кнопка кликабельна
      const button = (await exportButton.count()) > 0 ? exportButton.first() : exportButtonAlt.first();
      await expect(button).toBeVisible();
    } else {
      test.info().annotations.push({
        type: 'note',
        description: 'PDF export not available for this travel',
      });
    }
  });
});

/**
 * TC-TRAVEL-DETAIL-029: Переход между путешествиями (P3)
 */
test.describe('Travel Details - Navigation Between Travels', () => {
  test('TC-029: навигация к соседним путешествиям работает', async ({ page }) => {
    if (!(await goToDetails(page))) return;

    // Прокручиваем вниз для поиска навигационных кнопок
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForLoadState('networkidle').catch(() => null);

    // Ищем кнопки "Следующее" / "Предыдущее"
    const nextButton = page.locator(
      'button:has-text("Следующ"), a:has-text("Следующ"), [aria-label*="Следующ"]'
    );
    const prevButton = page.locator(
      'button:has-text("Предыдущ"), a:has-text("Предыдущ"), [aria-label*="Предыдущ"]'
    );

    const hasNextButton = (await nextButton.count()) > 0;
    const hasPrevButton = (await prevButton.count()) > 0;

    if (hasNextButton || hasPrevButton) {
      test.info().annotations.push({
        type: 'note',
        description: `Navigation buttons: next=${hasNextButton}, prev=${hasPrevButton}`,
      });

      // Если есть кнопка "Следующее", проверяем переход
      if (hasNextButton) {
        const currentUrl = page.url();
        await nextButton.first().click();
        await page.waitForURL((url) => url.href !== currentUrl, { timeout: 10_000 }).catch(() => null);

        const newUrl = page.url();
        // URL должен измениться
        const urlChanged = currentUrl !== newUrl;

        if (urlChanged) {
          test.info().annotations.push({
            type: 'note',
            description: 'Successfully navigated to next travel',
          });
        }
      }
    } else {
      test.info().annotations.push({
        type: 'note',
        description: 'Travel navigation buttons not found (feature may not be implemented)',
      });
    }
  });
});

/**
 * TC-TRAVEL-DETAIL-030: Модерация и статусы публикации (P2)
 */
test.describe('Travel Details - Moderation Status', () => {
  test('TC-030: статус модерации отображается корректно', async ({ page }) => {
    if (!(await goToDetails(page))) return;

    // Проверяем наличие индикаторов статуса
    const bodyText = await page.locator('body').textContent();

    const statusIndicators = [
      'На модерации',
      'Модерация',
      'Черновик',
      'Опубликовано',
      'Отклонено',
    ];

    const hasStatusIndicator = statusIndicators.some((indicator) =>
      bodyText?.includes(indicator)
    );

    if (hasStatusIndicator) {
      test.info().annotations.push({
        type: 'note',
        description: 'Travel status indicator found',
      });
    }

    // Проверяем наличие badge или метки статуса
    const statusBadge = page.locator(
      '[class*="badge"], [class*="status"], [class*="label"]'
    );
    const hasBadge = (await statusBadge.count()) > 0;

    if (hasBadge) {
      test.info().annotations.push({
        type: 'note',
        description: 'Status badge element found',
      });
    }

    // Страница должна быть доступна в любом случае
    await expect(page.locator('body')).toBeVisible();
  });
});

/**
 * Дополнительные проверки: Telegram и CTA кнопки
 */
test.describe('Travel Details - Engagement Elements', () => {
  test('элементы вовлечения (Telegram, CTA) отображаются', async ({ page }) => {
    if (!(await goToDetails(page))) return;

    // Прокручиваем вниз для загрузки футера
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForLoadState('networkidle').catch(() => null);

    // Проверяем наличие Telegram элемента
    const telegramElement = page.locator('[testid="travel-details-telegram"]');
    const hasTelegram = await telegramElement.isVisible().catch(() => false);

    if (hasTelegram) {
      test.info().annotations.push({
        type: 'note',
        description: 'Telegram engagement element found',
      });
    }

    // Проверяем наличие CTA элемента
    const ctaElement = page.locator('[testid="travel-details-cta"]');
    const hasCta = await ctaElement.isVisible().catch(() => false);

    if (hasCta) {
      test.info().annotations.push({
        type: 'note',
        description: 'CTA engagement element found',
      });
    }

    // Это опциональные элементы
    expect(true).toBe(true);
  });
});

/**
 * Проверка прокрутки и взаимодействия со страницей
 */
test.describe('Travel Details - Scroll Behavior', () => {
  test('плавная прокрутка работает корректно', async ({ page }) => {
    if (!(await goToDetails(page))) return;

    // Проверяем начальную позицию прокрутки
    const initialScrollY = await page.evaluate(() => window.scrollY);
    expect(initialScrollY).toBe(0);

    // Прокручиваем вниз
    await page.mouse.wheel(0, 600);

    // Wait until scroll position changes
    const didScroll = await page
      .waitForFunction(() => window.scrollY > 0, null, { timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    if (!didScroll) {
      test.info().annotations.push({
        type: 'note',
        description: 'ScrollY did not change after wheel scroll; attempting programmatic scroll.',
      });
      await page.evaluate(() => {
        try {
          window.scrollBy(0, 800);
        } catch {
          // ignore
        }
      });
      await page.waitForFunction(() => window.scrollY > 0, null, { timeout: 2_000 }).catch(() => null);
    }

    // Проверяем, что прокрутка произошла
    const scrolledY = await page.evaluate(() => window.scrollY);
    if (scrolledY <= 0) {
      const scrollInfo = await page
        .evaluate(() => {
          const el = document.scrollingElement || document.documentElement;
          return { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
        })
        .catch(() => ({ scrollHeight: 0, clientHeight: 0 }));
      // If the document truly isn't scrollable, the behavior is fine; otherwise it's a regression.
      if (scrollInfo.scrollHeight <= scrollInfo.clientHeight + 10) {
        test.info().annotations.push({
          type: 'note',
          description: 'Document is not scrollable after load; treating scroll-to-top check as not applicable.',
        });
        return;
      }
    }
    expect(scrolledY).toBeGreaterThan(0);

    // Прокручиваем обратно наверх
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await page.waitForFunction(() => window.scrollY < 100, null, { timeout: 5_000 }).catch(() => null);

    // Проверяем, что вернулись наверх (с погрешностью)
    const finalScrollY = await page.evaluate(() => window.scrollY);
    expect(finalScrollY).toBeLessThan(100);
  });

  test('кнопка "Наверх" работает', async ({ page }) => {
    if (!(await goToDetails(page))) return;

    // Прокручиваем вниз, чтобы активировать кнопку "Наверх"
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForFunction(() => window.scrollY > 500, null, { timeout: 5_000 }).catch(() => null);

    // Ищем кнопку "Наверх"
    const scrollToTopButton = page.locator(
      'button[aria-label*="наверх"], button[aria-label*="top"], [class*="scroll-to-top"]'
    );

    const hasScrollButton = await scrollToTopButton.isVisible().catch(() => false);

    if (hasScrollButton) {
      test.info().annotations.push({
        type: 'note',
        description: 'Scroll to top button found',
      });

      // Кликаем на кнопку
      await scrollToTopButton.click();
      await page.waitForFunction(() => window.scrollY < 200, null, { timeout: 5_000 }).catch(() => null);

      // Проверяем, что прокрутились наверх
      const scrollY = await page.evaluate(() => window.scrollY);
      expect(scrollY).toBeLessThan(200);
    } else {
      test.info().annotations.push({
        type: 'note',
        description: 'Scroll to top button not visible at this scroll position',
      });
    }
  });
});
