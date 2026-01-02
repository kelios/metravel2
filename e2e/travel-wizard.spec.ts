import { test, expect } from '@playwright/test';

/**
 * E2E тесты для создания путешествия
 * Проверяют полный flow от создания до публикации
 */

test.describe('Создание путешествия - Полный flow', () => {
  test.beforeEach(async ({ page }) => {
    // Авторизация пользователя (если требуется)
    await page.goto('/');
    // TODO: Добавить логин если нужно
    // await page.click('[data-testid="login-button"]');
    // await page.fill('[data-testid="email"]', 'test@example.com');
    // await page.fill('[data-testid="password"]', 'password123');
    // await page.click('[data-testid="submit-login"]');
  });

  test('должен создать полное путешествие через все шаги', async ({ page }) => {
    // Шаг 0: Переход к созданию
    await page.goto('/travel/new');
    await expect(page).toHaveURL(/\/travel\/new/);

    // Шаг 1: Основная информация
    await test.step('Шаг 1: Заполнение названия и описания', async () => {
      await expect(page.locator('text=Основная информация')).toBeVisible();

      // Заполняем название
      await page.fill('[placeholder*="Неделя в Грузии"]', 'Тестовое путешествие по Грузии');

      // Заполняем описание
      await page.fill('[placeholder*="Расскажите"]', 'Это тестовое описание путешествия по красивой Грузии. ' +
        'Мы посетим Тбилиси, горы и попробуем вино.');

      // Проверяем автосохранение
      await page.waitForSelector('text=Сохранено', { timeout: 10000 });

      // Переход к следующему шагу
      await page.click('button:has-text("Далее")');
    });

    // Шаг 2: Маршрут
    await test.step('Шаг 2: Добавление точек маршрута через поиск', async () => {
      await expect(page.locator('text=Маршрут путешествия')).toBeVisible();

      // Проверяем наличие поля поиска
      await expect(page.locator('[placeholder*="Поиск места"]')).toBeVisible();

      // Ищем Тбилиси через поиск
      await page.fill('[placeholder*="Поиск места"]', 'Тбилиси');

      // Ждем результаты поиска
      await page.waitForSelector('text=Тбилиси', { timeout: 5000 });

      // Кликаем по первому результату
      await page.click('text=Тбилиси >> nth=0');

      // Проверяем что точка добавилась
      await expect(page.locator('text=Точек: 1')).toBeVisible({ timeout: 5000 });

      // Добавляем еще одну точку через поиск
      await page.fill('[placeholder*="Поиск места"]', 'Казбеги');
      await page.waitForSelector('text=Казбеги', { timeout: 5000 });
      await page.click('text=Казбеги >> nth=0');

      // Проверяем счетчик точек
      await expect(page.locator('text=Точек: 2')).toBeVisible({ timeout: 5000 });

      // Переход к следующему шагу
      await page.click('button:has-text("К медиа")');
    });

    // Шаг 3: Медиа
    await test.step('Шаг 3: Медиа (пропускаем загрузку)', async () => {
      await expect(page.locator('text=Медиа путешествия')).toBeVisible();

      // Проверяем наличие советов по загрузке
      await expect(page.locator('text=Совет по обложке')).toBeVisible();
      await expect(page.locator('text=Лучший формат: горизонтальный 16:9')).toBeVisible();

      // Пропускаем загрузку и идем дальше
      await page.click('button:has-text("К деталям")');
    });

    // Шаг 4: Детали
    await test.step('Шаг 4: Детали путешествия', async () => {
      await expect(page.locator('text=Детали путешествия')).toBeVisible();

      // Можем добавить детали здесь если нужно

      // Переход дальше
      await page.click('button:has-text("Далее")');
    });

    // Шаг 5: Дополнительные параметры
    await test.step('Шаг 5: Дополнительные параметры', async () => {
      await expect(page.locator('text=Дополнительные параметры')).toBeVisible();

      // Проверяем группировку
      await expect(page.locator('text=Дополнительные параметры')).toBeVisible();
      await expect(page.locator('text=/\\d+\\/11/')).toBeVisible(); // Счетчик N/11

      // Выбираем категории (если группа открыта)
      const categoriesLabel = page.locator('text=Категории путешествий');
      if (await categoriesLabel.isVisible()) {
        // Можем выбрать категории здесь
      }

      // Переход дальше
      await page.click('button:has-text("Далее")');
    });

    // Шаг 6: Публикация
    await test.step('Шаг 6: Публикация', async () => {
      await expect(page.locator('text=Публикация')).toBeVisible();

      // Проверяем разделенный чеклист
      await expect(page.locator('text=Обязательно для публикации')).toBeVisible();
      await expect(page.locator('text=Рекомендуем заполнить')).toBeVisible();

      // Проверяем что обязательные пункты выполнены
      await expect(page.locator('text=Название маршрута')).toBeVisible();
      await expect(page.locator('text=Описание маршрута')).toBeVisible();
      await expect(page.locator('text=Маршрут на карте')).toBeVisible();

      // Выбираем "Сохранить как черновик"
      await page.click('text=Сохранить как черновик');

      // Публикуем (сохраняем)
      await page.click('button:has-text("Опубликовать")');

      // Проверяем редирект или успешное сообщение
      await expect(page).toHaveURL(/\/metravel|\/travels\//, { timeout: 10000 });
    });
  });

  test('должен создать быстрый черновик (Quick Mode)', async ({ page }) => {
    await page.goto('/travel/new');

    // Шаг 1: Только название
    await expect(page.locator('text=Основная информация')).toBeVisible();

    // Заполняем только название
    await page.fill('[placeholder*="Неделя в Грузии"]', 'Быстрый черновик');

    // Проверяем наличие кнопки Quick Draft
    await expect(page.locator('button:has-text("Быстрый черновик")')).toBeVisible();

    // Кликаем по Quick Draft
    await page.click('button:has-text("Быстрый черновик")');

    // Проверяем Toast сообщение
    await expect(page.locator('text=Черновик сохранен')).toBeVisible({ timeout: 5000 });

    // Проверяем редирект в /metravel
    await expect(page).toHaveURL(/\/metravel/, { timeout: 5000 });
  });

  test('должен показать ошибку при Quick Draft без названия', async ({ page }) => {
    await page.goto('/travel/new');

    // Не заполняем название
    await page.click('button:has-text("Быстрый черновик")');

    // Проверяем ошибку
    await expect(page.locator('text=Заполните название')).toBeVisible({ timeout: 3000 });
  });

  test('должен показать превью карточки', async ({ page }) => {
    await page.goto('/travel/new');

    // Заполняем название
    await page.fill('[placeholder*="Неделя в Грузии"]', 'Тестовое путешествие');

    // Заполняем описание
    await page.fill('[placeholder*="Расскажите"]', 'Описание для превью карточки путешествия');

    // Ждем автосохранение
    await page.waitForTimeout(6000);

    // Кликаем по кнопке превью в header
    const previewButton = page.locator('button:has-text("Превью"), button[aria-label="Показать превью"]');
    await expect(previewButton).toBeVisible();
    await previewButton.click();

    // Проверяем что модальное окно открылось
    await expect(page.locator('text=Превью карточки')).toBeVisible();
    await expect(page.locator('text=Тестовое путешествие')).toBeVisible();
    await expect(page.locator('text=Описание для превью')).toBeVisible();

    // Закрываем модальное окно
    await page.click('[aria-label="Закрыть превью"], button:has-text("×")');

    // Проверяем что модальное окно закрылось
    await expect(page.locator('text=Превью карточки')).not.toBeVisible();
  });

  test('должен использовать милестоны для навигации (desktop)', async ({ page, viewport: _viewport }) => {
    // Устанавливаем desktop размер
    await page.setViewportSize({ width: 1280, height: 720 });

    await page.goto('/travel/new');

    // Заполняем название чтобы можно было перейти дальше
    await page.fill('[placeholder*="Неделя в Грузии"]', 'Тест милестонов');
    await page.click('button:has-text("Далее")');

    // Ждем шаг 2
    await expect(page.locator('text=Маршрут путешествия')).toBeVisible();

    // Проверяем наличие милестонов
    await expect(page.locator('[aria-label="Перейти к шагу 1"]')).toBeVisible();
    await expect(page.locator('[aria-label="Перейти к шагу 2"]')).toBeVisible();

    // Кликаем по шагу 1 через милестон
    await page.click('[aria-label="Перейти к шагу 1"]');

    // Проверяем что вернулись на шаг 1
    await expect(page.locator('text=Основная информация')).toBeVisible();
  });

  test('должен автосохранять изменения', async ({ page }) => {
    await page.goto('/travel/new');

    // Заполняем название
    await page.fill('[placeholder*="Неделя в Грузии"]', 'Тест автосохранения');

    // Ждем автосохранение (5 секунд)
    await page.waitForSelector('text=Сохранено', { timeout: 10000 });

    // Обновляем страницу
    await page.reload();

    // Проверяем что данные сохранились
    await expect(page.locator('[placeholder*="Неделя в Грузии"]')).toHaveValue('Тест автосохранения');
  });
});

test.describe('Редактирование путешествия', () => {
  test.beforeEach(async ({ page }) => {
    // TODO: Создать тестовое путешествие через API или UI
    await page.goto('/');
  });

  test('должен открыть существующее путешествие для редактирования', async ({ page }) => {
    // Переходим в список путешествий
    await page.goto('/metravel');

    // Находим первое путешествие и кликаем "Редактировать"
    const editButton = page.locator('button:has-text("Редактировать"), a[href*="/travel/edit"]').first();

    if (await editButton.isVisible()) {
      await editButton.click();

      // Проверяем что открылся визард редактирования
      await expect(page).toHaveURL(/\/travel\/(edit|new)/);
      await expect(page.locator('[placeholder*="Неделя в Грузии"]')).not.toBeEmpty();
    }
  });

  test('должен изменить название и сохранить', async ({ page }) => {
    // TODO: Открыть существующее путешествие
    await page.goto('/travel/edit/123'); // Замените на реальный ID

    // Изменяем название
    const nameInput = page.locator('[placeholder*="Неделя в Грузии"]');
    await nameInput.clear();
    await nameInput.fill('Измененное название путешествия');

    // Ждем автосохранение
    await page.waitForSelector('text=Сохранено', { timeout: 10000 });

    // Переходим к публикации
    await page.click('[aria-label="Перейти к шагу 6"]');

    // Сохраняем изменения
    await page.click('button:has-text("Сохранить")');

    // Проверяем успешное сохранение
    await expect(page).toHaveURL(/\/metravel|\/travels\//, { timeout: 10000 });
  });

  test('должен добавить новую точку к существующему маршруту', async ({ page }) => {
    // TODO: Открыть существующее путешествие
    await page.goto('/travel/edit/123');

    // Переходим к шагу 2
    await page.click('[aria-label="Перейти к шагу 2"]');

    // Проверяем текущее количество точек
    const pointsText = await page.locator('text=/Точек: \\d+/').textContent();
    const currentPoints = parseInt(pointsText?.match(/\\d+/)?.[0] || '0');

    // Добавляем новую точку через поиск
    await page.fill('[placeholder*="Поиск места"]', 'Батуми');
    await page.waitForSelector('text=Батуми', { timeout: 5000 });
    await page.click('text=Батуми >> nth=0');

    // Проверяем что точка добавилась
    await expect(page.locator(`text=Точек: ${currentPoints + 1}`)).toBeVisible({ timeout: 5000 });

    // Ждем автосохранение
    await page.waitForSelector('text=Сохранено', { timeout: 10000 });
  });
});

test.describe('Валидация и ошибки', () => {
  test('должен показать ошибку при попытке сохранить без названия', async ({ page }) => {
    await page.goto('/travel/new');

    // Не заполняем название, пытаемся перейти дальше
    await page.click('button:has-text("Далее")');

    // Проверяем что остались на том же шаге
    await expect(page.locator('text=Основная информация')).toBeVisible();

    // Проверяем сообщение об ошибке
    await expect(page.locator('text=/название.*обязательн|заполните название/i')).toBeVisible();
  });

  test('должен показать предупреждения на шаге публикации', async ({ page }) => {
    await page.goto('/travel/new');

    // Минимально заполняем
    await page.fill('[placeholder*="Неделя в Грузии"]', 'Тест');

    // Переходим сразу к публикации (если возможно)
    for (let i = 0; i < 5; i++) {
      await page.click('button:has-text("Далее"), button:has-text("К медиа"), button:has-text("К деталям")');
      await page.waitForTimeout(500);
    }

    // Проверяем предупреждения
    await expect(page.locator('text=/предупреждени|warning/i')).toBeVisible();
  });

  test('должен сохранить точку без фото (автосохранение v2)', async ({ page }) => {
    await page.goto('/travel/new');

    // Заполняем название
    await page.fill('[placeholder*="Неделя в Грузии"]', 'Тест без фото');
    await page.click('button:has-text("Далее")');

    // Добавляем точку без фото через поиск
    await page.fill('[placeholder*="Поиск места"]', 'Тбилиси');
    await page.waitForSelector('text=Тбилиси', { timeout: 5000 });
    await page.click('text=Тбилиси >> nth=0');

    // Ждем автосохранение
    await page.waitForSelector('text=Сохранено', { timeout: 10000 });

    // Проверяем что нет ошибки "field may not be blank"
    await expect(page.locator('text=/field may not be blank|поле не может быть пустым/i')).not.toBeVisible();
  });
});

test.describe('Адаптивность (Mobile)', () => {
  test('должен работать на мобильных устройствах', async ({ page }) => {
    // Устанавливаем mobile размер
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/travel/new');

    // Проверяем что милестоны скрыты на mobile
    await expect(page.locator('[aria-label="Перейти к шагу 1"]')).not.toBeVisible();

    // Проверяем что основной контент виден
    await expect(page.locator('text=Основная информация')).toBeVisible();

    // Заполняем название
    await page.fill('[placeholder*="Неделя в Грузии"]', 'Mobile тест');

    // Проверяем что кнопка Quick Draft видна
    await expect(page.locator('button:has-text("Быстрый черновик")')).toBeVisible();
  });
});

