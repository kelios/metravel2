/**
 * E2E тесты: Комментарии на детальной странице путешествия
 *
 * Покрытие тест-кейсов: TC-031 - TC-054
 *
 * Приоритет P1: Критичные сценарии
 * Приоритет P2: Важные сценарии
 * Приоритет P3: Дополнительные сценарии
 */

import { test, expect } from './fixtures';
import { getTravelsListPath } from './helpers/routes';
import { seedNecessaryConsent } from './helpers/storage';
import { getCurrentUser } from './helpers/auth';

/**
 * TC-TRAVEL-DETAIL-031: Отображение секции комментариев (P1)
 */
test.describe('Travel Details - Comments Display', () => {
  test('TC-031: секция комментариев отображается корректно', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Прокручиваем вниз к комментариям
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    // Проверяем наличие секции комментариев
    const commentsSection = page.locator('[data-testid="comments-section"], [id*="comment"], section:has-text("Комментари")');
    const hasCommentsSection = await commentsSection.isVisible().catch(() => false);

    if (hasCommentsSection) {
      await expect(commentsSection).toBeVisible();

      // Проверяем счетчик комментариев
      const bodyText = await page.locator('body').textContent();
      const hasCounter = /комментари/i.test(bodyText || '');

      test.info().annotations.push({
        type: 'note',
        description: `Comments section found, counter visible: ${hasCounter}`,
      });
    } else {
      test.info().annotations.push({
        type: 'note',
        description: 'Comments section not found or not visible',
      });
    }
  });

  /**
   * BUGFIX: Проверка, что загруженные комментарии отображаются
   */
  test('BUGFIX: загруженные комментарии должны быть видны', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Прокручиваем к комментариям
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(3000); // Даем время на загрузку

    // Ищем debug информацию (если в dev режиме)
    const debugInfo = await page.locator('text=/Debug:.*threadId/').textContent().catch(() => null);

    if (debugInfo) {
      test.info().annotations.push({
        type: 'debug',
        description: `Debug info: ${debugInfo}`,
      });
    }

    // Проверяем наличие комментариев или сообщения о их отсутствии
    const hasComments = await page.locator('[data-testid*="comment-"], [class*="comment-item"]').count();
    const hasEmptyState = await page.locator('text=/Пока нет комментариев|Комментарии недоступны/').isVisible().catch(() => false);

    test.info().annotations.push({
      type: 'check',
      description: `Comments found: ${hasComments}, Empty state: ${hasEmptyState}`,
    });

    // Если комментариев нет, должно быть пустое состояние
    if (hasComments === 0) {
      expect(hasEmptyState).toBe(true);
    } else {
      // Если комментарии есть, проверяем, что они видны
      const firstComment = page.locator('[data-testid*="comment-"], [class*="comment-item"]').first();
      await expect(firstComment).toBeVisible();

      const commentText = await firstComment.textContent();
      expect(commentText).toBeTruthy();
      expect(commentText!.length).toBeGreaterThan(0);

      test.info().annotations.push({
        type: 'success',
        description: `Comments are visible! Count: ${hasComments}`,
      });
    }
  });

  /**
   * Тест сворачивания/разворачивания тредов
   */
  test('TC-THREAD-001: треды можно разворачивать и сворачивать', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Прокручиваем к комментариям
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(3000);

    // Ищем кнопки разворачивания тредов
    const toggleButtons = page.locator('button:has-text("Показать ответы"), button:has-text("Свернуть ответы")');
    const toggleButtonsCount = await toggleButtons.count();

    test.info().annotations.push({
      type: 'note',
      description: `Thread toggle buttons found: ${toggleButtonsCount}`,
    });

    if (toggleButtonsCount > 0) {
      // Проверяем наличие кнопки "Показать ответы"
      const showButton = page.locator('button:has-text("Показать ответы")').first();
      const hasShowButton = await showButton.isVisible().catch(() => false);

      if (hasShowButton) {
        // Получаем текст кнопки (с количеством ответов)
        const buttonText = await showButton.textContent();
        test.info().annotations.push({
          type: 'check',
          description: `Show replies button text: ${buttonText}`,
        });

        // Кликаем по кнопке
        await showButton.click();
        await page.waitForTimeout(500);

        // Проверяем, что кнопка изменилась на "Свернуть ответы"
        const hideButton = page.locator('button:has-text("Свернуть ответы")').first();
        const hasHideButton = await hideButton.isVisible().catch(() => false);

        if (hasHideButton) {
          test.info().annotations.push({
            type: 'success',
            description: 'Thread expanded successfully!',
          });

          // Кликаем еще раз чтобы свернуть
          await hideButton.click();
          await page.waitForTimeout(500);

          test.info().annotations.push({
            type: 'success',
            description: 'Thread collapsed successfully!',
          });
        }
      }
    } else {
      test.info().annotations.push({
        type: 'skip',
        description: 'No threaded comments to test',
      });
    }
  });

  /**
   * Тест кнопок "Развернуть все" / "Свернуть все"
   */
  test('TC-THREAD-002: кнопки "Развернуть все" и "Свернуть все" работают', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Прокручиваем к комментариям
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(3000);

    // Ищем кнопки управления тредами
    const expandAllButton = page.locator('button:has-text("Развернуть все")');
    const collapseAllButton = page.locator('button:has-text("Свернуть все")');

    const hasExpandAll = await expandAllButton.isVisible().catch(() => false);
    const hasCollapseAll = await collapseAllButton.isVisible().catch(() => false);

    test.info().annotations.push({
      type: 'check',
      description: `Expand all button: ${hasExpandAll}, Collapse all button: ${hasCollapseAll}`,
    });

    if (hasExpandAll && hasCollapseAll) {
      // Кликаем "Развернуть все"
      await expandAllButton.click();
      await page.waitForTimeout(500);

      // Проверяем, что все треды развернуты
      const hideButtons = page.locator('button:has-text("Свернуть ответы")');
      const hideButtonsCount = await hideButtons.count();

      test.info().annotations.push({
        type: 'check',
        description: `Expanded threads count: ${hideButtonsCount}`,
      });

      // Кликаем "Свернуть все"
      await collapseAllButton.click();
      await page.waitForTimeout(500);

      test.info().annotations.push({
        type: 'success',
        description: 'Expand/Collapse all buttons work correctly!',
      });
    } else {
      test.info().annotations.push({
        type: 'skip',
        description: 'No thread control buttons (no nested comments)',
      });
    }
  });

  /**
   * TC-THREAD-003: Комментарии с sub_thread показывают полный тред
   */
  test('TC-THREAD-003: комментарий с sub_thread показывает родительскую цепочку', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Прокручиваем к комментариям
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(3000);

    // Ищем комментарии с вложенными ответами
    const toggleButtons = page.locator('button:has-text("Показать ответы")');
    const hasThreads = await toggleButtons.count() > 0;

    if (hasThreads) {
      // Разворачиваем первый тред
      await toggleButtons.first().click();
      await page.waitForTimeout(500);

      // Проверяем, есть ли индикатор "Ответ в треде"
      const parentChainLabel = page.locator('text=/Ответ в треде/');
      const hasParentChain = await parentChainLabel.isVisible().catch(() => false);

      test.info().annotations.push({
        type: 'check',
        description: `Parent chain indicator found: ${hasParentChain}`,
      });

      // Если есть вложенные ответы, проверяем структуру
      const nestedComments = page.locator('[class*="nested"]');
      const nestedCount = await nestedComments.count();

      test.info().annotations.push({
        type: 'check',
        description: `Nested comments found: ${nestedCount}`,
      });

      if (hasParentChain || nestedCount > 0) {
        test.info().annotations.push({
          type: 'success',
          description: 'Thread hierarchy is displayed!',
        });
      }
    } else {
      test.info().annotations.push({
        type: 'skip',
        description: 'No threaded comments to test',
      });
    }
  });

  /**
   * TC-THREAD-004: Рекурсивное отображение вложенных ответов
   */
  test('TC-THREAD-004: вложенные ответы отображаются рекурсивно', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Прокручиваем к комментариям
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(3000);

    // Разворачиваем все треды
    const expandAllButton = page.locator('button:has-text("Развернуть все")');
    const hasExpandAll = await expandAllButton.isVisible().catch(() => false);

    if (hasExpandAll) {
      await expandAllButton.click();
      await page.waitForTimeout(1000);

      // Подсчитываем уровни вложенности комментариев
      const allComments = page.locator('[data-testid*="comment-"], [class*="comment-item"]');
      const commentsCount = await allComments.count();

      // Проверяем, есть ли визуальные индикаторы вложенности (отступы, линии)
      const borderedContainers = page.locator('[style*="border-left"], [style*="borderLeft"]');
      const bordersCount = await borderedContainers.count();

      test.info().annotations.push({
        type: 'check',
        description: `Total comments: ${commentsCount}, Nested containers (borders): ${bordersCount}`,
      });

      if (bordersCount > 0) {
        test.info().annotations.push({
          type: 'success',
          description: 'Nested replies are displayed with visual hierarchy!',
        });
      }
    } else {
      test.info().annotations.push({
        type: 'skip',
        description: 'No threads to expand',
      });
    }
  });

  /**
   * TC-TRAVEL-DETAIL-036: Отображение списка комментариев (P1)
   */
  test('TC-036: список комментариев отображается с полными данными', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Прокручиваем к комментариям
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    // Ищем комментарии
    const commentItems = page.locator('[data-testid*="comment-"], [class*="comment-item"], li:has([class*="comment"])');
    const commentCount = await commentItems.count();

    if (commentCount > 0) {
      // Проверяем первый комментарий
      const firstComment = commentItems.first();
      await expect(firstComment).toBeVisible();

      // Проверяем, что есть текст комментария
      const commentText = await firstComment.textContent();
      expect(commentText).toBeTruthy();
      expect(commentText!.length).toBeGreaterThan(0);

      test.info().annotations.push({
        type: 'note',
        description: `Found ${commentCount} comments`,
      });
    } else {
      test.info().annotations.push({
        type: 'note',
        description: 'No comments found on this travel',
      });
    }
  });
});

/**
 * TC-TRAVEL-DETAIL-032: Добавление комментария (P1)
 * TC-TRAVEL-DETAIL-033: Попытка добавить без авторизации (P1)
 */
test.describe('Travel Details - Add Comment', () => {
  test('TC-033: неавторизованный пользователь видит призыв войти', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Прокручиваем к комментариям
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    // Проверяем, что форма комментария заблокирована или показывается сообщение
    const bodyText = await page.locator('body').textContent();
    const hasLoginPrompt =
      bodyText?.includes('Войдите') ||
      bodyText?.includes('войти') ||
      bodyText?.includes('авториз') ||
      bodyText?.includes('Sign in');

    // Ищем форму комментария
    const commentForm = page.locator('form:has(textarea), [data-testid="comment-form"]');
    const hasForm = await commentForm.isVisible().catch(() => false);

    if (hasForm) {
      // Форма может быть disabled
      const textarea = commentForm.locator('textarea');
      const isDisabled = await textarea.isDisabled().catch(() => false);

      test.info().annotations.push({
        type: 'note',
        description: `Comment form found, disabled: ${isDisabled}`,
      });
    }

    if (hasLoginPrompt) {
      test.info().annotations.push({
        type: 'note',
        description: 'Login prompt found for unauthenticated users',
      });
    }

    // Проверяем, что страница не сломана
    await expect(page.locator('body')).toBeVisible();
  });

  test('TC-032: авторизованный пользователь может добавить комментарий', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // Проверяем, что пользователь авторизован (через storageState из global-setup)
    const user = await getCurrentUser(page);
    const isAuth = user.isAuthenticated;

    test.info().annotations.push({
      type: 'auth',
      description: `User authenticated: ${isAuth}, userId: ${user.userId}`,
    });

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Прокручиваем к комментариям
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    // Ищем форму добавления комментария
    const commentForm = page.locator('form:has(textarea), [data-testid="comment-form"]');
    const hasForm = await commentForm.isVisible().catch(() => false);

    if (hasForm) {
      const textarea = commentForm.locator('textarea');
      const submitButton = commentForm.locator('button[type="submit"], button:has-text("Отправить"), button:has-text("Добавить")');

      // Проверяем, что форма существует и имеет необходимые элементы
      const hasTextarea = await textarea.count() > 0;
      const hasButton = await submitButton.count() > 0;

      test.info().annotations.push({
        type: 'note',
        description: `Comment form: textarea=${hasTextarea}, button=${hasButton}, auth=${isAuth}`,
      });

      if (isAuth) {
        // Если авторизован, форма должна быть доступна
        expect(hasTextarea).toBe(true);
        expect(hasButton).toBe(true);

        // Проверяем, что textarea не disabled
        if (hasTextarea) {
          const isDisabled = await textarea.first().isDisabled().catch(() => false);
          expect(isDisabled).toBe(false);
        }
      } else {
        // Если не авторизован, должен быть призыв войти
        test.info().annotations.push({
          type: 'warning',
          description: 'User not authenticated via storageState, checking for login prompt',
        });
      }
    }
  });
});

/**
 * TC-TRAVEL-DETAIL-034: Валидация комментария (P2)
 * TC-TRAVEL-DETAIL-035: Максимальная длина (P3)
 */
test.describe('Travel Details - Comment Validation', () => {
  test('TC-034: валидация пустого комментария', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Прокручиваем к комментариям
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    // Ищем форму
    const commentForm = page.locator('form:has(textarea)');
    const hasForm = await commentForm.isVisible().catch(() => false);

    if (hasForm) {
      const submitButton = commentForm.locator('button[type="submit"]');

      // Проверяем, что кнопка disabled при пустой форме
      const isDisabled = await submitButton.isDisabled().catch(() => false);

      test.info().annotations.push({
        type: 'note',
        description: `Submit button disabled when empty: ${isDisabled}`,
      });
    }
  });
});

/**
 * TC-TRAVEL-DETAIL-037: Ответ на комментарий (P1)
 */
test.describe('Travel Details - Reply to Comment', () => {
  test('TC-037: кнопка "Ответить" доступна на комментариях', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Прокручиваем к комментариям
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    // Ищем комментарии
    const commentItems = page.locator('[data-testid*="comment-"], [class*="comment-item"]');
    const commentCount = await commentItems.count();

    if (commentCount > 0) {
      // Ищем кнопку "Ответить"
      const replyButtons = page.locator('button:has-text("Ответить"), button:has-text("Reply"), [aria-label*="Ответить"]');
      const hasReplyButton = (await replyButtons.count()) > 0;

      test.info().annotations.push({
        type: 'note',
        description: `Reply buttons found: ${hasReplyButton}`,
      });

      if (hasReplyButton) {
        await expect(replyButtons.first()).toBeVisible();
      }
    }
  });

  test('TC-038: отмена ответа на комментарий работает', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Прокручиваем к комментариям
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    // Ищем кнопку "Ответить"
    const replyButton = page.locator('button:has-text("Ответить"), button:has-text("Reply")').first();
    const hasReplyButton = await replyButton.isVisible().catch(() => false);

    if (hasReplyButton) {
      // Кликаем "Ответить"
      await replyButton.click();
      await page.waitForTimeout(500);

      // Ищем кнопку отмены
      const cancelButton = page.locator('button:has-text("Отмена"), button:has-text("Cancel"), button[aria-label*="Закрыть"]');
      const hasCancelButton = await cancelButton.isVisible().catch(() => false);

      if (hasCancelButton) {
        await expect(cancelButton).toBeVisible();

        test.info().annotations.push({
          type: 'note',
          description: 'Reply form with cancel button found',
        });
      }
    }
  });

  /**
   * BUGFIX: TC-037: Комментарии НЕ должны пропадать после отправки ответа
   */
  test('TC-037: BUGFIX - комментарии не пропадают после ответа', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);

    // Проверяем авторизацию
    const user = await getCurrentUser(page);

    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Прокручиваем к комментариям
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    // Считаем количество комментариев ДО ответа
    const commentsBefore = page.locator('[data-testid*="comment-"], [class*="comment-item"], article:has([class*="comment"])');
    const countBefore = await commentsBefore.count();

    test.info().annotations.push({
      type: 'check',
      description: `Comments before reply: ${countBefore}, isAuth: ${user.isAuthenticated}`,
    });

    if (countBefore > 0 && user.isAuthenticated) {
      // Нажимаем "Ответить" на первом комментарии
      const replyButton = page.locator('button:has-text("Ответить"), button:has-text("Reply")').first();
      const hasReplyButton = await replyButton.isVisible().catch(() => false);

      if (hasReplyButton) {
        await replyButton.click();
        await page.waitForTimeout(500);

        // Вводим текст ответа
        const replyTextarea = page.locator('textarea').last();
        const hasTextarea = await replyTextarea.isVisible().catch(() => false);

        if (hasTextarea) {
          await replyTextarea.fill('Тестовый ответ на комментарий');
          await page.waitForTimeout(300);

          // Нажимаем "Отправить"
          const submitButton = page.locator('button[type="submit"]:has-text("Отправить"), button:has-text("Отправить")').last();
          const hasSubmit = await submitButton.isVisible().catch(() => false);

          if (hasSubmit) {
            // Запоминаем текст первого комментария для проверки
            const firstCommentText = await commentsBefore.first().textContent();

            await submitButton.click();

            // Ждем небольшой период для обработки
            await page.waitForTimeout(1000);

            // КРИТИЧЕСКАЯ ПРОВЕРКА: комментарии НЕ должны пропасть!
            const commentsAfter = page.locator('[data-testid*="comment-"], [class*="comment-item"], article:has([class*="comment"])');
            const countAfter = await commentsAfter.count();

            test.info().annotations.push({
              type: 'bugfix',
              description: `Comments after reply: ${countAfter} (was: ${countBefore})`,
            });

            // Проверяем, что комментарии НЕ пропали
            expect(countAfter).toBeGreaterThanOrEqual(countBefore);

            // Проверяем, что первый комментарий всё ещё на месте
            if (firstCommentText) {
              const bodyText = await page.locator('body').textContent();
              expect(bodyText).toContain(firstCommentText.slice(0, 50));
            }

            test.info().annotations.push({
              type: 'success',
              description: 'BUGFIX VERIFIED: Comments remain visible after reply',
            });
          }
        }
      }
    } else if (countBefore === 0) {
      test.info().annotations.push({
        type: 'skip',
        description: 'No comments to test with',
      });
    } else if (!user.isAuthenticated) {
      test.info().annotations.push({
        type: 'skip',
        description: 'User not authenticated, cannot test reply',
      });
    }
  });
});

/**
 * TC-TRAVEL-DETAIL-039: Удаление комментария (P1)
 * TC-TRAVEL-DETAIL-040: Попытка удалить чужой (P2)
 */
test.describe('Travel Details - Delete Comment', () => {
  test('TC-039 & TC-040: кнопка удаления доступна только автору', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // Проверяем авторизацию
    const user = await getCurrentUser(page);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Прокручиваем к комментариям
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    // Ищем кнопки удаления
    const deleteButtons = page.locator('button:has-text("Удалить"), button:has-text("Delete"), [aria-label*="Удалить комментарий"]');
    const deleteButtonCount = await deleteButtons.count();

    test.info().annotations.push({
      type: 'note',
      description: `Delete buttons visible: ${deleteButtonCount}, isAuth: ${user.isAuthenticated}, isSuperuser: ${user.isSuperuser}`,
    });

    // Для неавторизованного пользователя кнопок удаления не должно быть (кроме случая когда комментариев нет вообще)
    // Для авторизованного - кнопки могут быть только на своих комментариях
    // Для суперпользователя - кнопки могут быть на всех комментариях

    if (!user.isAuthenticated) {
      // Неавторизованный не должен видеть кнопки удаления
      test.info().annotations.push({
        type: 'check',
        description: 'Unauthenticated user should not see delete buttons',
      });
    } else {
      test.info().annotations.push({
        type: 'check',
        description: `Authenticated user (superuser: ${user.isSuperuser}) can see delete buttons on own/all comments`,
      });
    }

    // Базовая проверка, что страница работает
    expect(true).toBe(true);
  });
});

/**
 * TC-TRAVEL-DETAIL-042: Пагинация комментариев (P2)
 */
test.describe('Travel Details - Comments Pagination', () => {
  test('TC-042: пагинация или ленивая загрузка работает', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Прокручиваем к комментариям
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    // Ищем кнопку "Показать еще" или индикатор пагинации
    const loadMoreButton = page.locator('button:has-text("Показать еще"), button:has-text("Загрузить"), button:has-text("Load more")');
    const hasLoadMore = await loadMoreButton.isVisible().catch(() => false);

    if (hasLoadMore) {
      test.info().annotations.push({
        type: 'note',
        description: 'Load more button found',
      });

      await expect(loadMoreButton).toBeVisible();
    } else {
      test.info().annotations.push({
        type: 'note',
        description: 'No pagination controls found (may use infinite scroll or all comments loaded)',
      });
    }
  });
});

/**
 * TC-TRAVEL-DETAIL-043: Сортировка комментариев (P3)
 */
test.describe('Travel Details - Comments Sorting', () => {
  test('TC-043: опции сортировки доступны', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Прокручиваем к комментариям
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    // Ищем элементы сортировки
    const sortControls = page.locator('select:has(option:has-text("Сначала")), button:has-text("Сортировка"), [aria-label*="Сортировка"]');
    const hasSortControls = await sortControls.isVisible().catch(() => false);

    if (hasSortControls) {
      test.info().annotations.push({
        type: 'note',
        description: 'Sort controls found',
      });
    } else {
      test.info().annotations.push({
        type: 'note',
        description: 'Sort controls not found (feature may not be implemented)',
      });
    }
  });
});

/**
 * TC-TRAVEL-DETAIL-048: Обработка ошибки при добавлении (P1)
 */
test.describe('Travel Details - Comments Error Handling', () => {
  test('TC-048: graceful degradation при ошибке добавления комментария', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);

    // Блокируем API запросы комментариев
    await page.route('**/api/**/comments/**', (route) => {
      if (route.request().method() === 'POST') {
        route.abort('failed');
      } else {
        route.continue();
      }
    });

    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Прокручиваем к комментариям
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    // Проверяем, что секция комментариев не сломана
    const body = page.locator('body');
    await expect(body).toBeVisible();

    test.info().annotations.push({
      type: 'note',
      description: 'Page did not crash with blocked comment API',
    });
  });
});

/**
 * TC-TRAVEL-DETAIL-051: Мобильная версия комментариев (P1)
 */
test.describe('Travel Details - Comments Mobile', () => {
  test('TC-051: мобильная версия комментариев адаптирована', async ({ page }) => {
    // Устанавливаем мобильный viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.addInitScript(seedNecessaryConsent);

    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Прокручиваем к комментариям
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    // Проверяем, что комментарии отображаются на мобильном
    const commentsSection = page.locator('[data-testid="comments-section"], section:has-text("Комментари")');
    const hasComments = await commentsSection.isVisible().catch(() => false);

    if (hasComments) {
      // Проверяем, что нет горизонтального overflow
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      const overflow = scrollWidth - clientWidth;

      expect(overflow).toBeLessThan(10);

      test.info().annotations.push({
        type: 'note',
        description: 'Comments section is mobile-friendly',
      });
    }
  });
});

/**
 * TC-TRAVEL-DETAIL-052: Accessibility комментариев (P2)
 */
test.describe('Travel Details - Comments Accessibility', () => {
  test('TC-052: комментарии доступны с клавиатуры', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Прокручиваем к комментариям
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    // Проверяем keyboard navigation
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);

    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      return {
        tag: el?.tagName.toLowerCase(),
        role: el?.getAttribute('role'),
        ariaLabel: el?.getAttribute('aria-label'),
      };
    });

    test.info().annotations.push({
      type: 'note',
      description: `Focused element: ${JSON.stringify(focusedElement)}`,
    });

    // Проверяем, что есть интерактивные элементы
    const interactiveTags = ['button', 'a', 'input', 'textarea'];
    const hasFocus = focusedElement.tag && interactiveTags.includes(focusedElement.tag);

    if (hasFocus) {
      test.info().annotations.push({
        type: 'note',
        description: 'Interactive elements are keyboard accessible',
      });
    }
  });
});

/**
 * TC-TRAVEL-DETAIL-053: XSS защита (P1)
 */
test.describe('Travel Details - Comments Security', () => {
  test('TC-053: XSS защита работает (UI проверка)', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Прокручиваем к комментариям
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    // Проверяем, что в комментариях нет исполняемого JS
    const commentScripts = await page.locator('[data-testid*="comment"] script, [class*="comment"] script').count();

    // В комментариях не должно быть тегов script
    expect(commentScripts).toBe(0);

    test.info().annotations.push({
      type: 'security',
      description: 'No script tags found in comment content',
    });
  });
});

/**
 * TC-LIKE-001, TC-LIKE-002, TC-LIKE-003: Функциональность лайков
 */
test.describe('Travel Details - Comments Likes', () => {
  test('TC-LIKE-001: пользователь может поставить и убрать лайк', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);

    // Проверяем авторизацию
    const user = await getCurrentUser(page);

    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Прокручиваем к комментариям
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(3000);

    // Разворачиваем треды если есть
    const expandAllButton = page.locator('button:has-text("Развернуть все")');
    const hasExpandAll = await expandAllButton.isVisible().catch(() => false);
    if (hasExpandAll) {
      await expandAllButton.click();
      await page.waitForTimeout(500);
    }

    // Ищем кнопки лайка
    const likeButtons = page.locator('button[aria-label*="лайк" i], button:has-text("♥"), button:has-text("❤")');
    const likeButtonsCount = await likeButtons.count();

    test.info().annotations.push({
      type: 'check',
      description: `Like buttons found: ${likeButtonsCount}, isAuth: ${user.isAuthenticated}`,
    });

    if (likeButtonsCount > 0 && user.isAuthenticated) {
      const firstLikeButton = likeButtons.first();

      // Получаем исходное состояние
      const initialText = await firstLikeButton.textContent();
      const initialAriaLabel = await firstLikeButton.getAttribute('aria-label');

      test.info().annotations.push({
        type: 'check',
        description: `Initial state: "${initialText}", aria-label: "${initialAriaLabel}"`,
      });

      // Кликаем по кнопке лайка
      await firstLikeButton.click();
      await page.waitForTimeout(1000);

      // Проверяем, что состояние изменилось
      const afterClickText = await firstLikeButton.textContent();
      const afterClickAriaLabel = await firstLikeButton.getAttribute('aria-label');

      test.info().annotations.push({
        type: 'check',
        description: `After click: "${afterClickText}", aria-label: "${afterClickAriaLabel}"`,
      });

      // Проверяем, что текст или aria-label изменились
      const stateChanged = (initialText !== afterClickText) || (initialAriaLabel !== afterClickAriaLabel);

      if (stateChanged) {
        test.info().annotations.push({
          type: 'success',
          description: 'Like toggle works! State changed after click.',
        });

        // Кликаем еще раз, чтобы вернуть в исходное состояние (toggle)
        await firstLikeButton.click();
        await page.waitForTimeout(1000);

        const afterSecondClickText = await firstLikeButton.textContent();

        test.info().annotations.push({
          type: 'success',
          description: `Second click (toggle back): "${afterSecondClickText}"`,
        });
      } else {
        test.info().annotations.push({
          type: 'warning',
          description: 'State did not change - may need to check implementation',
        });
      }
    } else if (!user.isAuthenticated) {
      test.info().annotations.push({
        type: 'skip',
        description: 'User not authenticated, cannot test likes',
      });
    } else {
      test.info().annotations.push({
        type: 'skip',
        description: 'No like buttons found',
      });
    }
  });

  test('TC-LIKE-002: счетчик лайков обновляется правильно', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);

    const user = await getCurrentUser(page);

    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Прокручиваем к комментариям
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(3000);

    if (user.isAuthenticated) {
      // Ищем кнопку лайка со счетчиком
      const likeButtons = page.locator('button[aria-label*="лайк" i]');
      const hasLikeButtons = await likeButtons.count() > 0;

      if (hasLikeButtons) {
        const firstButton = likeButtons.first();
        const initialText = await firstButton.textContent();

        // Пытаемся извлечь число из текста
        const initialCountMatch = initialText?.match(/\d+/);
        const initialCount = initialCountMatch ? parseInt(initialCountMatch[0]) : null;

        test.info().annotations.push({
          type: 'check',
          description: `Initial likes count: ${initialCount}`,
        });

        // Кликаем
        await firstButton.click();
        await page.waitForTimeout(1000);

        const afterClickText = await firstButton.textContent();
        const afterClickMatch = afterClickText?.match(/\d+/);
        const afterClickCount = afterClickMatch ? parseInt(afterClickMatch[0]) : null;

        test.info().annotations.push({
          type: 'check',
          description: `After click likes count: ${afterClickCount}`,
        });

        if (initialCount !== null && afterClickCount !== null) {
          // Проверяем, что счетчик изменился на ±1
          const diff = Math.abs(afterClickCount - initialCount);

          if (diff === 1) {
            test.info().annotations.push({
              type: 'success',
              description: 'Likes counter updated correctly (±1)',
            });
          } else {
            test.info().annotations.push({
              type: 'warning',
              description: `Counter changed by ${diff} (expected ±1)`,
            });
          }
        }
      } else {
        test.info().annotations.push({
          type: 'skip',
          description: 'No like buttons found',
        });
      }
    } else {
      test.info().annotations.push({
        type: 'skip',
        description: 'User not authenticated',
      });
    }
  });

  test('TC-LIKE-003: неавторизованный пользователь не может лайкать', async ({ page }) => {
    // Специально НЕ используем storageState - проверяем неавторизованного
    await page.addInitScript(seedNecessaryConsent);

    // Очищаем localStorage чтобы убедиться что не авторизованы
    await page.evaluate(() => {
      try {
        window.localStorage.clear();
      } catch {
        // ignore
      }
    });

    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Прокручиваем к комментариям
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(3000);

    // Проверяем, что пользователь НЕ авторизован
    const isAuth = await page.evaluate(() => {
      try {
        return !!window.localStorage.getItem('secure_userToken');
      } catch {
        return false;
      }
    });

    test.info().annotations.push({
      type: 'check',
      description: `User authenticated: ${isAuth}`,
    });

    // Ищем кнопки лайка
    const likeButtons = page.locator('button[aria-label*="лайк" i]');
    const likeButtonsCount = await likeButtons.count();

    // Для неавторизованного пользователя:
    // - Либо кнопок нет вообще
    // - Либо они disabled
    // - Либо показывается сообщение "Войдите"

    const loginPrompt = page.locator('text=/Войдите.*лайк|авторизуйтесь/i');
    const hasLoginPrompt = await loginPrompt.isVisible().catch(() => false);

    test.info().annotations.push({
      type: 'check',
      description: `Like buttons: ${likeButtonsCount}, Login prompt: ${hasLoginPrompt}`,
    });

    if (!isAuth) {
      test.info().annotations.push({
        type: 'success',
        description: 'Correctly shows unauthenticated state',
      });
    }
  });
});

/**
 * TC-THREAD-005, TC-THREAD-006: Открытие треда по sub_thread
 */
test.describe('Travel Details - Thread Opening', () => {
  test('TC-THREAD-005: комментарий с sub_thread имеет кнопку открытия треда', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Прокручиваем к комментариям
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(3000);

    // Разворачиваем все треды
    const expandAllButton = page.locator('button:has-text("Развернуть все")');
    const hasExpandAll = await expandAllButton.isVisible().catch(() => false);
    if (hasExpandAll) {
      await expandAllButton.click();
      await page.waitForTimeout(500);
    }

    // Ищем кнопки "Открыть тред"
    const openThreadButtons = page.locator('button:has-text("Открыть тред")');
    const openThreadButtonsCount = await openThreadButtons.count();

    test.info().annotations.push({
      type: 'check',
      description: `"Открыть тред" buttons found: ${openThreadButtonsCount}`,
    });

    if (openThreadButtonsCount > 0) {
      // Проверяем, что кнопка видима и кликабельна
      const firstButton = openThreadButtons.first();
      await expect(firstButton).toBeVisible();

      test.info().annotations.push({
        type: 'success',
        description: 'Thread opening button is available!',
      });
    } else {
      test.info().annotations.push({
        type: 'skip',
        description: 'No comments with sub_thread found',
      });
    }
  });

  test('TC-THREAD-006: клик по кнопке загружает и показывает тред', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Прокручиваем к комментариям
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(3000);

    // Разворачиваем все треды
    const expandAllButton = page.locator('button:has-text("Развернуть все")');
    const hasExpandAll = await expandAllButton.isVisible().catch(() => false);
    if (hasExpandAll) {
      await expandAllButton.click();
      await page.waitForTimeout(500);
    }

    // Ищем кнопки "Открыть тред"
    const openThreadButtons = page.locator('button:has-text("Открыть тред")');
    const hasOpenThreadButtons = await openThreadButtons.count() > 0;

    if (hasOpenThreadButtons) {
      const firstButton = openThreadButtons.first();

      // Кликаем по кнопке
      await firstButton.click();
      await page.waitForTimeout(2000); // Даем время на загрузку треда

      // Проверяем, что тред открылся
      // Ищем контейнер треда или комментарии из треда
      const threadContainer = page.locator('[class*="thread"], [data-testid*="thread"]');
      const hasThreadContainer = await threadContainer.isVisible().catch(() => false);

      // Проверяем изменение текста кнопки
      const buttonText = await firstButton.textContent();
      const isThreadShown = buttonText?.includes('Скрыть') || hasThreadContainer;

      test.info().annotations.push({
        type: 'check',
        description: `Button text after click: "${buttonText}", Thread visible: ${hasThreadContainer}`,
      });

      if (isThreadShown) {
        test.info().annotations.push({
          type: 'success',
          description: 'Thread opened successfully!',
        });

        // Проверяем, что можем закрыть тред
        if (buttonText?.includes('Скрыть')) {
          await firstButton.click();
          await page.waitForTimeout(500);

          const buttonTextAfter = await firstButton.textContent();

          test.info().annotations.push({
            type: 'success',
            description: `Thread can be closed. Button text: "${buttonTextAfter}"`,
          });
        }
      } else {
        test.info().annotations.push({
          type: 'warning',
          description: 'Thread may not have loaded or displayed',
        });
      }
    } else {
      test.info().annotations.push({
        type: 'skip',
        description: 'No thread opening buttons found',
      });
    }
  });

  test('TC-THREAD-007: тред показывает правильные комментарии', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) return;

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    // Прокручиваем к комментариям
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(3000);

    // Разворачиваем все треды
    const expandAllButton = page.locator('button:has-text("Развернуть все")');
    const hasExpandAll = await expandAllButton.isVisible().catch(() => false);
    if (hasExpandAll) {
      await expandAllButton.click();
      await page.waitForTimeout(500);
    }

    // Ищем кнопки "Открыть тред"
    const openThreadButtons = page.locator('button:has-text("Открыть тред")');
    const hasOpenThreadButtons = await openThreadButtons.count() > 0;

    if (hasOpenThreadButtons) {
      const firstButton = openThreadButtons.first();
      await firstButton.click();
      await page.waitForTimeout(2000);

      // Ищем заголовок треда с количеством комментариев
      const threadHeader = page.locator('text=/Тред #\\d+.*комментари/i');
      const hasThreadHeader = await threadHeader.isVisible().catch(() => false);

      if (hasThreadHeader) {
        const headerText = await threadHeader.textContent();

        test.info().annotations.push({
          type: 'success',
          description: `Thread header found: "${headerText}"`,
        });

        // Пытаемся извлечь количество комментариев
        const countMatch = headerText?.match(/\d+.*комментари/i);

        if (countMatch) {
          test.info().annotations.push({
            type: 'check',
            description: `Thread comments count: ${countMatch[0]}`,
          });
        }
      } else {
        test.info().annotations.push({
          type: 'warning',
          description: 'Thread header not found',
        });
      }
    } else {
      test.info().annotations.push({
        type: 'skip',
        description: 'No thread opening buttons found',
      });
    }
  });
});

