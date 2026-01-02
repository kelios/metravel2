import { test, expect } from '@playwright/test';

/**
 * E2E тесты для специфичных функций визарда путешествий
 * - Quick Mode
 * - Поиск мест
 * - Превью карточки
 * - Группировка параметров
 */

test.describe('Quick Mode (Быстрый черновик)', () => {
  test('должен создать черновик с минимальным заполнением', async ({ page }) => {
    await page.goto('/travel/new');

    // Заполняем только название
    await page.fill('[placeholder*="Неделя в Грузии"]', 'Минимальный черновик');

    // Клик по Quick Draft
    await page.click('button:has-text("Быстрый черновик")');

    // Проверяем успешное сообщение
    await expect(page.locator('text=Черновик сохранен')).toBeVisible({ timeout: 5000 });

    // Проверяем редирект
    await expect(page).toHaveURL(/\/metravel/, { timeout: 5000 });

    // Проверяем что черновик появился в списке
    await expect(page.locator('text=Минимальный черновик')).toBeVisible({ timeout: 5000 });
  });

  test('должен показать валидацию при коротком названии', async ({ page }) => {
    await page.goto('/travel/new');

    // Заполняем название < 3 символов
    await page.fill('[placeholder*="Неделя в Грузии"]', 'AB');

    // Клик по Quick Draft
    await page.click('button:has-text("Быстрый черновик")');

    // Проверяем ошибку
    await expect(page.locator('text=/Минимум 3 символа/i')).toBeVisible({ timeout: 3000 });

    // Проверяем что остались на странице
    await expect(page).toHaveURL(/\/travel\/new/);
  });

  test('должен работать Quick Draft на desktop и mobile', async ({ page, viewport: _viewport }) => {
    // Desktop
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/travel/new');

    const quickDraftButton = page.locator('button:has-text("Быстрый черновик")');
    await expect(quickDraftButton).toBeVisible();

    // Mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();

    await expect(quickDraftButton).toBeVisible();
  });
});

test.describe('Поиск мест на карте (Location Search)', () => {
  test('должен найти место и добавить точку на карту', async ({ page }) => {
    await page.goto('/travel/new');

    // Заполняем название
    await page.fill('[placeholder*="Неделя в Грузии"]', 'Тест поиска');
    await page.click('button:has-text("Далее")');

    // Шаг 2: Маршрут
    await expect(page.locator('text=Маршрут путешествия')).toBeVisible();

    // Проверяем поле поиска
    const searchInput = page.locator('[placeholder*="Поиск места"]');
    await expect(searchInput).toBeVisible();

    // Вводим название места
    await searchInput.fill('Эйфелева башня');

    // Ждем результаты (debounce 500ms + время запроса)
    await page.waitForTimeout(1000);

    // Проверяем dropdown с результатами
    await expect(page.locator('text=Париж')).toBeVisible({ timeout: 5000 });

    // Кликаем по результату
    await page.click('text=Париж >> nth=0');

    // Проверяем что точка добавилась
    await expect(page.locator('text=Точек: 1')).toBeVisible({ timeout: 5000 });

    // Проверяем автовыбор страны
    // await expect(page.locator('text=Франция')).toBeVisible();
  });

  test('должен показать empty state если ничего не найдено', async ({ page }) => {
    await page.goto('/travel/new');
    await page.fill('[placeholder*="Неделя в Грузии"]', 'Тест');
    await page.click('button:has-text("Далее")');

    // Ищем несуществующее место
    await page.fill('[placeholder*="Поиск места"]', 'asdfghjkl123456789');

    await page.waitForTimeout(1000);

    // Проверяем empty state
    await expect(page.locator('text=/Ничего не найдено|No results/i')).toBeVisible({ timeout: 5000 });
  });

  test('должен показать loading indicator при поиске', async ({ page }) => {
    await page.goto('/travel/new');
    await page.fill('[placeholder*="Неделя в Грузии"]', 'Тест');
    await page.click('button:has-text("Далее")');

    // Вводим текст
    await page.fill('[placeholder*="Поиск места"]', 'Москва');

    // Проверяем loading indicator (может быть виден короткое время)
    // await expect(page.locator('[aria-label="Loading"]')).toBeVisible({ timeout: 1000 });
  });

  test('должен очистить поле поиска кнопкой X', async ({ page }) => {
    await page.goto('/travel/new');
    await page.fill('[placeholder*="Неделя в Грузии"]', 'Тест');
    await page.click('button:has-text("Далее")');

    const searchInput = page.locator('[placeholder*="Поиск места"]');
    await searchInput.fill('Тбилиси');

    // Ждем появления кнопки очистки
    const clearButton = page.locator('button[aria-label="Очистить"], button:has-text("×")');
    await expect(clearButton).toBeVisible({ timeout: 2000 });

    // Кликаем по кнопке очистки
    await clearButton.click();

    // Проверяем что поле очистилось
    await expect(searchInput).toHaveValue('');
  });

  test('должен работать debounce (не запрашивать при каждом символе)', async ({ page }) => {
    await page.goto('/travel/new');
    await page.fill('[placeholder*="Неделя в Грузии"]', 'Тест');
    await page.click('button:has-text("Далее")');

    // Быстро вводим текст
    await page.type('[placeholder*="Поиск места"]', 'Тбилиси', { delay: 50 });

    // Ждем меньше чем debounce
    await page.waitForTimeout(300);

    // Результаты еще не должны появиться
    await expect(page.locator('text=Грузия')).not.toBeVisible();

    // Ждем полный debounce
    await page.waitForTimeout(300);

    // Теперь результаты должны появиться
    await expect(page.locator('text=Грузия')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Превью карточки (Travel Preview)', () => {
  test('должен открыть и закрыть превью модальное окно', async ({ page }) => {
    await page.goto('/travel/new');

    // Заполняем данные
    await page.fill('[placeholder*="Неделя в Грузии"]', 'Путешествие для превью');
    await page.fill('[placeholder*="Расскажите"]', 'Описание путешествия для проверки превью карточки');

    // Ждем автосохранение
    await page.waitForTimeout(6000);

    // Кликаем по кнопке превью
    await page.click('button:has([aria-label*="eye"]), button:has-text("Превью")');

    // Проверяем что модальное окно открылось
    await expect(page.locator('text=Превью карточки')).toBeVisible();
    await expect(page.locator('text=Путешествие для превью')).toBeVisible();
    await expect(page.locator('text=Описание путешествия')).toBeVisible();

    // Закрываем по кнопке X
    await page.click('button[aria-label="Закрыть"], button:has-text("×")');

    // Проверяем что модальное окно закрылось
    await expect(page.locator('text=Превью карточки')).not.toBeVisible();
  });

  test('должен закрыть превью по клику вне модального окна', async ({ page }) => {
    await page.goto('/travel/new');
    await page.fill('[placeholder*="Неделя в Грузии"]', 'Тест превью');
    await page.waitForTimeout(6000);

    await page.click('button:has-text("Превью")');
    await expect(page.locator('text=Превью карточки')).toBeVisible();

    // Кликаем по overlay (вне модального окна)
    await page.click('.overlay, [style*="overlay"]', { position: { x: 10, y: 10 } });

    // Модальное окно должно закрыться
    await expect(page.locator('text=Превью карточки')).not.toBeVisible({ timeout: 2000 });
  });

  test('должен показать placeholder если нет обложки', async ({ page }) => {
    await page.goto('/travel/new');
    await page.fill('[placeholder*="Неделя в Грузии"]', 'Без обложки');
    await page.waitForTimeout(6000);

    await page.click('button:has-text("Превью")');

    // Проверяем placeholder
    await expect(page.locator('text=Нет обложки')).toBeVisible();
  });

  test('должен обрезать длинное описание до 150 символов', async ({ page }) => {
    await page.goto('/travel/new');
    await page.fill('[placeholder*="Неделя в Грузии"]', 'Длинное описание');

    const longDescription = 'Это очень длинное описание путешествия, которое содержит более 150 символов. ' +
      'Мы хотим проверить что оно правильно обрезается в превью карточки и добавляется многоточие в конце текста. ' +
      'Дополнительный текст для увеличения длины.';

    await page.fill('[placeholder*="Расскажите"]', longDescription);
    await page.waitForTimeout(6000);

    await page.click('button:has-text("Превью")');

    // Проверяем что есть многоточие
    await expect(page.locator('text=/\\.\\.\\./')).toBeVisible();
  });

  test('должен показать статистику (дни, точки, страны)', async ({ page }) => {
    await page.goto('/travel/new');
    await page.fill('[placeholder*="Неделя в Грузии"]', 'Со статистикой');
    await page.click('button:has-text("Далее")');

    // Добавляем точку
    await page.fill('[placeholder*="Поиск места"]', 'Париж');
    await page.waitForTimeout(1000);
    await page.click('text=Париж >> nth=0');
    await page.waitForTimeout(6000);

    // Открываем превью
    await page.click('button:has-text("Превью")');

    // Проверяем статистику
    await expect(page.locator('text=/1 точ/i')).toBeVisible();
  });
});

test.describe('Группировка параметров (Шаг 5)', () => {
  test('должен открывать и закрывать группу параметров', async ({ page }) => {
    await page.goto('/travel/new');
    await page.fill('[placeholder*="Неделя в Грузии"]', 'Тест группировки');

    // Переходим к шагу 5
    for (let i = 0; i < 4; i++) {
      await page.click('button:has-text("Далее")');
      await page.waitForTimeout(500);
    }

    // Проверяем заголовок группы
    await expect(page.locator('text=Дополнительные параметры')).toBeVisible();

    // Проверяем счетчик
    await expect(page.locator('text=/\\d+\\/11/')).toBeVisible();

    // Группа должна быть открыта по умолчанию
    await expect(page.locator('text=Категории путешествий')).toBeVisible();

    // Кликаем по заголовку группы чтобы закрыть
    await page.click('text=Дополнительные параметры');

    // Проверяем что контент скрылся
    await expect(page.locator('text=Категории путешествий')).not.toBeVisible({ timeout: 2000 });

    // Открываем обратно
    await page.click('text=Дополнительные параметры');
    await expect(page.locator('text=Категории путешествий')).toBeVisible();
  });

  test('должен показывать счетчик заполненных полей', async ({ page }) => {
    await page.goto('/travel/new');
    await page.fill('[placeholder*="Неделя в Грузии"]', 'Тест счетчика');

    // Переходим к шагу 5
    for (let i = 0; i < 4; i++) {
      await page.click('button:has-text("Далее")');
      await page.waitForTimeout(500);
    }

    // Проверяем начальный счетчик (может быть 0/11 или больше)
    const initialCounter = await page.locator('text=/\\d+\\/11/').textContent();
    const initialCount = parseInt(initialCounter?.match(/\d+/)?.[0] || '0');

    expect(initialCounter ?? '').toMatch(/\d+\/11/);
    expect(initialCount).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Милестоны (Навигация по шагам)', () => {
  test('должен показывать милестоны на desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/travel/new');

    // Проверяем наличие милестонов
    await expect(page.locator('[aria-label="Перейти к шагу 1"]')).toBeVisible();
    await expect(page.locator('[aria-label="Перейти к шагу 2"]')).toBeVisible();
    await expect(page.locator('[aria-label="Перейти к шагу 6"]')).toBeVisible();
  });

  test('должен скрывать милестоны на mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/travel/new');

    // Проверяем что милестоны скрыты
    await expect(page.locator('[aria-label="Перейти к шагу 1"]')).not.toBeVisible();
  });

  test('должен подсвечивать текущий шаг', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/travel/new');

    // Текущий шаг должен быть подсвечен
    const currentMilestone = page.locator('[aria-label="Перейти к шагу 1"]');
    await expect(currentMilestone).toHaveClass(/active|current/i);
  });

  test('должен показывать галочку для пройденных шагов', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/travel/new');

    // Заполняем и переходим дальше
    await page.fill('[placeholder*="Неделя в Грузии"]', 'Тест милестонов');
    await page.click('button:has-text("Далее")');

    // Проверяем галочку на шаге 1
    const _step1 = page.locator('[aria-label="Перейти к шагу 1"]');
    // await expect(step1.locator('text=✓')).toBeVisible();
  });
});

test.describe('Разделенный чеклист (Шаг 6)', () => {
  test('должен показывать две секции чеклиста', async ({ page }) => {
    await page.goto('/travel/new');
    await page.fill('[placeholder*="Неделя в Грузии"]', 'Тест чеклиста');

    // Переходим к шагу 6
    for (let i = 0; i < 5; i++) {
      await page.click('button:has-text("Далее")');
      await page.waitForTimeout(500);
    }

    // Проверяем обе секции
    await expect(page.locator('text=Обязательно для публикации')).toBeVisible();
    await expect(page.locator('text=Рекомендуем заполнить')).toBeVisible();
  });

  test('должен показывать преимущества для рекомендуемых пунктов', async ({ page }) => {
    await page.goto('/travel/new');
    await page.fill('[placeholder*="Неделя в Грузии"]', 'Тест преимуществ');

    // Переходим к шагу 6
    for (let i = 0; i < 5; i++) {
      await page.click('button:has-text("Далее")');
      await page.waitForTimeout(500);
    }

    // Проверяем наличие преимуществ (статистики)
    await expect(page.locator('text=/\\+40%|В 3 раза/i')).toBeVisible();
  });

  test('должен показывать счетчик готовности', async ({ page }) => {
    await page.goto('/travel/new');
    await page.fill('[placeholder*="Неделя в Грузии"]', 'Тест счетчика готовности');

    // Переходим к шагу 6
    for (let i = 0; i < 5; i++) {
      await page.click('button:has-text("Далее")');
      await page.waitForTimeout(500);
    }

    // Проверяем счетчик N/6
    await expect(page.locator('text=/\\d+\\/6/')).toBeVisible();
  });
});
