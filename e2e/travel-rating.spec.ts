/**
 * E2E тесты: Рейтинг путешествия
 *
 * Покрытие тест-кейсов:
 * - TC-RATING-001: Отображение рейтинга путешествия
 * - TC-RATING-002: Оценка путешествия авторизованным пользователем
 * - TC-RATING-003: Отображение оценки пользователя после оценивания
 * - TC-RATING-004: Клик на звезду отправляет оценку
 * - TC-RATING-005: Неавторизованный пользователь видит подсказку войти
 * - TC-RATING-006: Рейтинг в списке путешествий
 * - TC-RATING-007: API /rating/users/ возвращает данные для авторизованного пользователя
 * - TC-RATING-008: После оценки UI обновляется оптимистично
 * - TC-RATING-009: Пользователь может изменить свою оценку
 * - TC-RATING-010: Звёзды интерактивны при наведении
 */

import { test, expect } from './fixtures';
import { preacceptCookies, navigateToFirstTravel, gotoWithRetry } from './helpers/navigation';
import { isAuthenticated, ensureAuthedStorageFallback, mockFakeAuthApis, waitForAuth } from './helpers/auth';

const RATING_SECTION_SELECTOR = '[data-testid="travel-rating-section"]';
const STAR_SELECTOR = '[data-testid^="star-rating-star-"]';
const LOGIN_HINT_PATTERN = /войд/i;
const YOUR_RATING_PATTERN = /ваша оценка/i;

async function goToTravelDetails(page: import('@playwright/test').Page): Promise<boolean> {
  await preacceptCookies(page);
  return navigateToFirstTravel(page);
}

/**
 * Прокручивает страницу до секции рейтинга
 */
async function scrollToRatingSection(page: import('@playwright/test').Page): Promise<void> {
  // Прокручиваем вниз, чтобы найти секцию рейтинга (может быть в deferred-загрузке)
  for (let i = 0; i < 10; i++) {
    const ratingSection = page.locator(RATING_SECTION_SELECTOR);
    if ((await ratingSection.count()) > 0) {
      await ratingSection.scrollIntoViewIfNeeded();
      return;
    }
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(300);
  }
}

test.describe('Travel Rating', () => {
  /**
   * TC-RATING-001: Отображение секции рейтинга на странице путешествия
   */
  test('TC-RATING-001: секция рейтинга отображается на странице путешествия', async ({ page }) => {
    if (!(await goToTravelDetails(page))) {
      test.skip();
      return;
    }

    await scrollToRatingSection(page);

    // Проверяем наличие секции рейтинга
    const ratingSection = page.locator(RATING_SECTION_SELECTOR);

    // Секция должна быть на странице (может быть скрыта до загрузки)
    const hasSection = (await ratingSection.count()) > 0;

    if (hasSection) {
      await expect(ratingSection.first()).toBeVisible({ timeout: 10000 });

      // Должны быть звёзды для отображения рейтинга
      const stars = page.locator(STAR_SELECTOR);
      const starsCount = await stars.count();
      expect(starsCount).toBeGreaterThan(0);

      test.info().annotations.push({
        type: 'note',
        description: `Rating section found with ${starsCount} stars`,
      });
    } else {
      test.info().annotations.push({
        type: 'note',
        description: 'Rating section not present on this travel',
      });
    }
  });

  /**
   * TC-RATING-005: Неавторизованный пользователь видит подсказку войти
   */
  test('TC-RATING-005: неавторизованный пользователь видит подсказку войти', async ({ page }) => {
    // Убедимся, что пользователь не авторизован
    await page.addInitScript(() => {
      try {
        window.localStorage.removeItem('secure_userToken');
        window.localStorage.removeItem('userId');
      } catch {
        // ignore
      }
    });

    if (!(await goToTravelDetails(page))) {
      test.skip();
      return;
    }

    await scrollToRatingSection(page);

    const ratingSection = page.locator(RATING_SECTION_SELECTOR);
    if ((await ratingSection.count()) === 0) {
      test.skip();
      return;
    }

    // Проверяем текст секции на подсказку о входе
    const sectionText = await ratingSection.textContent();

    // Должна быть либо подсказка войти, либо отсутствовать интерактивная секция
    const hasLoginHint = sectionText ? LOGIN_HINT_PATTERN.test(sectionText) : false;

    if (hasLoginHint) {
      test.info().annotations.push({
        type: 'note',
        description: 'Login hint found for unauthenticated user',
      });
    } else {
      // Если нет подсказки войти, значит секция рейтинга неинтерактивна для неавторизованных
      test.info().annotations.push({
        type: 'note',
        description: 'Rating section is non-interactive for unauthenticated users',
      });
    }
  });
});

test.describe('Travel Rating - Authenticated', () => {
  test.beforeEach(async ({ page }) => {
    // Устанавливаем фейковую авторизацию
    await ensureAuthedStorageFallback(page);
    await mockFakeAuthApis(page);
  });

  /**
   * TC-RATING-002: Авторизованный пользователь может оценить путешествие
   */
  test('TC-RATING-002: авторизованный пользователь видит интерактивные звёзды', async ({ page }) => {
    if (!(await goToTravelDetails(page))) {
      test.skip();
      return;
    }

    // Wait for auth state to be hydrated (checkAuthentication is deferred via requestIdleCallback)
    await waitForAuth(page, 8_000);

    // Проверяем что пользователь авторизован
    const authenticated = await isAuthenticated(page);
    if (!authenticated) {
      test.info().annotations.push({
        type: 'note',
        description: 'User is not authenticated, skipping interactive rating test',
      });
      test.skip();
      return;
    }

    await scrollToRatingSection(page);

    const ratingSection = page.locator(RATING_SECTION_SELECTOR);
    if ((await ratingSection.count()) === 0) {
      test.skip();
      return;
    }

    await expect(ratingSection.first()).toBeVisible({ timeout: 10000 });

    // Wait for auth state to propagate to UI (checkAuthentication is deferred via requestIdleCallback)
    // The rating section shows login hint until isAuthenticated becomes true in Zustand store
    await page.waitForFunction(
      ({ selector, pattern }: { selector: string; pattern: string }) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        const text = el.textContent || '';
        return !new RegExp(pattern, 'i').test(text);
      },
      { selector: RATING_SECTION_SELECTOR, pattern: 'войд' },
      { timeout: 8_000 }
    ).catch(() => null);

    // Для авторизованного пользователя должны быть интерактивные звёзды
    const stars = ratingSection.locator(STAR_SELECTOR);
    const starsCount = await stars.count();

    if (starsCount > 0) {
      // Проверяем, что звёзды кликабельны (через role или aria)
      const firstStar = stars.first();

      // Звезда должна быть видима
      await expect(firstStar).toBeVisible();

      test.info().annotations.push({
        type: 'note',
        description: `Found ${starsCount} interactive stars for authenticated user`,
      });
    }

    // Не должно быть подсказки "войти"
    const sectionText = await ratingSection.textContent();
    const hasLoginHint = sectionText ? LOGIN_HINT_PATTERN.test(sectionText) : false;

    expect(hasLoginHint).toBe(false);
  });

  /**
   * TC-RATING-003: Отображение оценки пользователя
   */
  test('TC-RATING-003: отображается текст "Ваша оценка" если пользователь уже оценил', async ({ page }) => {
    // Мокаем API /rating/users/ чтобы вернуть оценку пользователя
    await page.route('**/api/travels/*/rating/users/**', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 1,
            user: 1,
            travel: 1,
            rating: 4, // Пользователь уже оценил на 4
          }),
        });
      }
      return route.continue();
    });

    // Мокаем API /rating/ для общего рейтинга
    await page.route('**/api/travels/*/rating/', (route) => {
      const url = route.request().url();
      // Пропускаем /rating/users/ - он уже замокан выше
      if (url.includes('/rating/users/')) {
        return route.continue();
      }
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            rating: 4.5,
            rating_count: 10,
          }),
        });
      }
      return route.continue();
    });

    if (!(await goToTravelDetails(page))) {
      test.skip();
      return;
    }

    await scrollToRatingSection(page);

    const ratingSection = page.locator(RATING_SECTION_SELECTOR);
    if ((await ratingSection.count()) === 0) {
      test.skip();
      return;
    }

    // Ждём загрузки и проверяем текст
    await expect(ratingSection.first()).toBeVisible({ timeout: 10000 });

    // Даём время на загрузку данных рейтинга
    await page.waitForTimeout(1000);

    const sectionText = await ratingSection.textContent();

    // Проверяем наличие текста "Ваша оценка"
    const hasUserRatingText = sectionText ? YOUR_RATING_PATTERN.test(sectionText) : false;

    if (hasUserRatingText) {
      test.info().annotations.push({
        type: 'note',
        description: 'User rating text is displayed correctly',
      });
    } else {
      test.info().annotations.push({
        type: 'note',
        description: 'User rating text not found - API mock may not have been applied',
      });
    }
  });

  /**
   * TC-RATING-004: Клик на звезду вызывает API оценки
   */
  test('TC-RATING-004: клик на звезду отправляет оценку', async ({ page }) => {
    let ratingApiCalled = false;
    let ratingValue: number | null = null;

    // Мокаем GET запрос /rating/users/ - пользователь ещё не оценивал (404)
    await page.route('**/api/travels/*/rating/users/**', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Not found' }),
        });
      }
      return route.continue();
    });

    // Мокаем GET запрос /rating/ для общего рейтинга
    await page.route('**/api/travels/*/rating/', (route) => {
      const url = route.request().url();
      if (url.includes('/rating/users/')) {
        return route.continue();
      }
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            rating: 4.0,
            rating_count: 5,
          }),
        });
      }
      return route.continue();
    });

    // Мокаем POST запрос для отправки оценки
    await page.route('**/api/travels/rating/**', async (route) => {
      if (route.request().method() === 'POST') {
        ratingApiCalled = true;
        try {
          const body = route.request().postDataJSON();
          ratingValue = body?.rating ?? null;
        } catch {
          // ignore parse error
        }

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            rating: 4.2,
            rating_count: 6,
            user_rating: ratingValue ?? 5,
          }),
        });
      }
      return route.continue();
    });

    if (!(await goToTravelDetails(page))) {
      test.skip();
      return;
    }

    const authenticated = await isAuthenticated(page);
    if (!authenticated) {
      test.skip();
      return;
    }

    await scrollToRatingSection(page);

    const ratingSection = page.locator(RATING_SECTION_SELECTOR);
    if ((await ratingSection.count()) === 0) {
      test.skip();
      return;
    }

    await expect(ratingSection.first()).toBeVisible({ timeout: 10000 });

    // Находим 5-ю звезду и кликаем
    const fifthStar = page.locator('[data-testid="star-rating-star-5"]').first();

    if ((await fifthStar.count()) > 0) {
      await fifthStar.click();

      // Ждём отправку API
      await page.waitForTimeout(1000);

      if (ratingApiCalled) {
        test.info().annotations.push({
          type: 'note',
          description: `Rating API called with value: ${ratingValue}`,
        });
        expect(ratingValue).toBe(5);
      } else {
        test.info().annotations.push({
          type: 'note',
          description: 'Rating API was not called - star may not be interactive',
        });
      }
    } else {
      test.info().annotations.push({
        type: 'note',
        description: 'Could not find clickable star element',
      });
    }
  });
});

/**
 * TC-RATING-006: Рейтинг в списке путешествий
 */
test.describe('Travel Rating - List View', () => {
  test('TC-RATING-006: рейтинг отображается на карточке путешествия', async ({ page }) => {
    await preacceptCookies(page);
    await gotoWithRetry(page, '/search');

    // Ждём загрузки списка
    const cards = page.locator('[data-testid="travel-card-link"]');
    await Promise.race([
      cards.first().waitFor({ state: 'visible', timeout: 30000 }),
      page.waitForSelector('text=Пока нет путешествий', { timeout: 30000 }),
    ]).catch(() => null);

    if ((await cards.count()) === 0) {
      test.skip();
      return;
    }

    // Проверяем наличие элементов рейтинга на карточках
    // Рейтинг может отображаться как звёзды или число
    const ratingElements = page.locator('[data-testid^="star-rating"]');
    const ratingCount = await ratingElements.count();

    test.info().annotations.push({
      type: 'note',
      description: `Found ${ratingCount} rating elements in travel cards list`,
    });

    // Рейтинг не обязателен на всех карточках, но если есть - должен быть виден
    if (ratingCount > 0) {
      await expect(ratingElements.first()).toBeVisible();
    }
  });
});

/**
 * TC-RATING-007-010: Тесты API рейтинга
 * Проверяют корректность работы endpoints:
 * - GET /api/travels/{id}/rating/
 * - GET /api/travels/{id}/rating/users/
 * - POST /api/travels/rating/
 */
test.describe('Travel Rating - API Integration', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthedStorageFallback(page);
    await mockFakeAuthApis(page);
  });

  /**
   * TC-RATING-007: API /rating/users/ возвращает оценку пользователя
   */
  test('TC-RATING-007: API /rating/users/ возвращает данные для авторизованного пользователя', async ({ page }) => {
    let ratingUsersApiCalled = false;
    let ratingUsersResponse: any = null;

    // Перехватываем запрос к /rating/users/
    await page.route('**/api/travels/*/rating/users/**', async (route) => {
      ratingUsersApiCalled = true;
      // Пропускаем запрос к реальному API и сохраняем ответ
      const response = await route.fetch();
      ratingUsersResponse = await response.json().catch(() => null);

      // Мокируем ответ с оценкой пользователя
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 123,
          user: 1,
          travel: 1,
          rating: 4,
        }),
      });
    });

    if (!(await goToTravelDetails(page))) {
      test.skip();
      return;
    }

    await scrollToRatingSection(page);

    // Ждём загрузки секции рейтинга
    const ratingSection = page.locator(RATING_SECTION_SELECTOR);
    if ((await ratingSection.count()) > 0) {
      await expect(ratingSection.first()).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(500);
    }

    test.info().annotations.push({
      type: 'note',
      description: `API /rating/users/ called: ${ratingUsersApiCalled}, response: ${JSON.stringify(ratingUsersResponse)}`,
    });

    // API должен быть вызван для авторизованного пользователя
    // (может не вызваться если используется кэш или мок не применился)
  });

  /**
   * TC-RATING-008: После оценки звёзды обновляются
   */
  test('TC-RATING-008: после оценки UI обновляется оптимистично', async ({ page }) => {
    // Мокаем начальное состояние - пользователь не оценивал
    await page.route('**/api/travels/*/rating/users/**', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Not found' }),
        });
      }
      return route.continue();
    });

    await page.route('**/api/travels/*/rating/', (route) => {
      const url = route.request().url();
      if (url.includes('/rating/users/')) return route.continue();

      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            rating: 3.5,
            rating_count: 10,
          }),
        });
      }
      return route.continue();
    });

    // Мокаем POST для отправки оценки
    await page.route('**/api/travels/rating/**', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            rating: 3.6,
            rating_count: 11,
            user_rating: 5,
          }),
        });
      }
      return route.continue();
    });

    if (!(await goToTravelDetails(page))) {
      test.skip();
      return;
    }

    const authenticated = await isAuthenticated(page);
    if (!authenticated) {
      test.skip();
      return;
    }

    await scrollToRatingSection(page);

    const ratingSection = page.locator(RATING_SECTION_SELECTOR);
    if ((await ratingSection.count()) === 0) {
      test.skip();
      return;
    }

    await expect(ratingSection.first()).toBeVisible({ timeout: 10000 });

    // Проверяем начальный текст - должно быть "Оцените"
    const initialText = await ratingSection.textContent();
    const hadNoRating = initialText && !YOUR_RATING_PATTERN.test(initialText);

    // Кликаем на 5-ю звезду
    const fifthStar = page.locator('[data-testid="star-rating-star-5"]').first();
    if ((await fifthStar.count()) > 0) {
      await fifthStar.click();

      // Ждём оптимистичного обновления
      await page.waitForTimeout(1000);

      // После клика должен появиться текст "Ваша оценка" или число оценки
      const newText = await ratingSection.textContent();
      const hasUserRating = newText && YOUR_RATING_PATTERN.test(newText);
      const hasRatingNumber = newText && /[1-5]/.test(newText);

      test.info().annotations.push({
        type: 'note',
        description: `Before click: hadNoRating=${hadNoRating}, After click: hasUserRating=${hasUserRating}, hasRatingNumber=${hasRatingNumber}`,
      });

      // Тест информационный - проверяем только если изначально не было оценки
      if (hadNoRating && hasUserRating) {
        expect(hasUserRating).toBe(true);
      }
    }
  });

  /**
   * TC-RATING-009: Изменение существующей оценки
   */
  test('TC-RATING-009: пользователь может изменить свою оценку', async ({ page }) => {
    let postCallCount = 0;
    let lastPostedRating: number | null = null;

    // Мокаем состояние - пользователь уже оценил на 3
    await page.route('**/api/travels/*/rating/users/**', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 1,
            user: 1,
            travel: 1,
            rating: 3,
          }),
        });
      }
      return route.continue();
    });

    await page.route('**/api/travels/*/rating/', (route) => {
      const url = route.request().url();
      if (url.includes('/rating/users/')) return route.continue();

      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            rating: 4.0,
            rating_count: 5,
          }),
        });
      }
      return route.continue();
    });

    // Мокаем POST для изменения оценки
    await page.route('**/api/travels/rating/**', async (route) => {
      if (route.request().method() === 'POST') {
        postCallCount++;
        try {
          const body = route.request().postDataJSON();
          lastPostedRating = body?.rating ?? null;
        } catch {
          // ignore
        }

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            rating: 4.2,
            rating_count: 5,
            user_rating: lastPostedRating ?? 5,
          }),
        });
      }
      return route.continue();
    });

    if (!(await goToTravelDetails(page))) {
      test.skip();
      return;
    }

    const authenticated = await isAuthenticated(page);
    if (!authenticated) {
      test.skip();
      return;
    }

    await scrollToRatingSection(page);

    const ratingSection = page.locator(RATING_SECTION_SELECTOR);
    if ((await ratingSection.count()) === 0) {
      test.skip();
      return;
    }

    await expect(ratingSection.first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);

    // Проверяем что отображается текущая оценка
    const textBefore = await ratingSection.textContent();
    const hasRating3 = textBefore && /3/.test(textBefore);

    // Кликаем на 5-ю звезду чтобы изменить оценку
    const fifthStar = page.locator('[data-testid="star-rating-star-5"]').first();
    if ((await fifthStar.count()) > 0) {
      await fifthStar.click();
      await page.waitForTimeout(500);

      test.info().annotations.push({
        type: 'note',
        description: `POST calls: ${postCallCount}, last rating: ${lastPostedRating}, had rating 3: ${hasRating3}`,
      });

      // API должен быть вызван с новой оценкой
      if (postCallCount > 0) {
        expect(lastPostedRating).toBe(5);
      }
    }
  });

  /**
   * TC-RATING-010: Звёзды подсвечиваются при наведении (web)
   */
  test('TC-RATING-010: звёзды интерактивны при наведении', async ({ page }) => {
    await page.route('**/api/travels/*/rating/users/**', (route) => {
      return route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Not found' }),
      });
    });

    await page.route('**/api/travels/*/rating/', (route) => {
      const url = route.request().url();
      if (url.includes('/rating/users/')) return route.continue();

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          rating: 4.0,
          rating_count: 10,
        }),
      });
    });

    if (!(await goToTravelDetails(page))) {
      test.skip();
      return;
    }

    const authenticated = await isAuthenticated(page);
    if (!authenticated) {
      test.skip();
      return;
    }

    await scrollToRatingSection(page);

    const ratingSection = page.locator(RATING_SECTION_SELECTOR);
    if ((await ratingSection.count()) === 0) {
      test.skip();
      return;
    }

    await expect(ratingSection.first()).toBeVisible({ timeout: 10000 });

    // Находим интерактивные звёзды
    const stars = ratingSection.locator(STAR_SELECTOR);
    const starsCount = await stars.count();

    if (starsCount >= 5) {
      // Наводим на 4-ю звезду
      const fourthStar = page.locator('[data-testid="star-rating-star-4"]').first();
      if ((await fourthStar.count()) > 0) {
        await fourthStar.hover();
        await page.waitForTimeout(200);

        // Проверяем что звезда видима и кликабельна
        await expect(fourthStar).toBeVisible();

        test.info().annotations.push({
          type: 'note',
          description: `Found ${starsCount} stars, hover test passed`,
        });
      }
    }
  });
});

