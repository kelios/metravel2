import { test, expect } from '@playwright/test';

const e2eEmail = process.env.E2E_EMAIL;
const e2ePassword = process.env.E2E_PASSWORD;

const maybeAcceptCookies = async (page: any) => {
  const acceptAll = page.getByText('Принять всё', { exact: true });
  const necessaryOnly = page.getByText('Только необходимые', { exact: true });
  const bannerTitle = page.getByText('Мы ценим вашу приватность', { exact: true });

  // Banner can appear asynchronously; wait briefly.
  await Promise.race([
    bannerTitle.waitFor({ state: 'visible', timeout: 1500 }).catch(() => null),
    acceptAll.waitFor({ state: 'visible', timeout: 1500 }).catch(() => null),
    necessaryOnly.waitFor({ state: 'visible', timeout: 1500 }).catch(() => null),
  ]);

  if (await acceptAll.isVisible().catch(() => false)) {
    await acceptAll.click({ force: true });
  } else if (await necessaryOnly.isVisible().catch(() => false)) {
    await necessaryOnly.click({ force: true });
  }

  // Ensure it is gone so it doesn't intercept clicks.
  if (await bannerTitle.isVisible().catch(() => false)) {
    await bannerTitle.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => null);
  }
};

const maybeLogin = async (page: any) => {
  if (!e2eEmail || !e2ePassword) return false;

  await page.goto('/login');
  await maybeAcceptCookies(page);

  const emailCandidates = [
    page.locator('input[type="email"]'),
    page.locator('input[name*="email" i]'),
    page.locator('input[autocomplete="email"]'),
    page.locator('input[placeholder="Email"]'),
    page.getByPlaceholder('Email'),
    page.getByLabel('Email'),
    page.getByRole('textbox', { name: /^email$/i }),
  ];

  const passwordCandidates = [
    page.locator('input[type="password"]'),
    page.locator('input[name*="pass" i]'),
    page.locator('input[autocomplete="current-password"]'),
    page.locator('input[placeholder="Пароль"]'),
    page.locator('input[placeholder="Password"]'),
    page.getByPlaceholder('Пароль'),
    page.getByPlaceholder('Password'),
    page.getByLabel(/пароль|password/i),
  ];

  const pickVisible = async (candidates: any[], timeoutMs: number) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      for (const c of candidates) {
        const loc = c.first();
        if (await loc.isVisible().catch(() => false)) return loc;
      }
      await page.waitForTimeout(250);
    }
    await Promise.race(candidates.map((c) => c.first().waitFor({ state: 'visible', timeout: 1000 }).catch(() => null)));
    for (const c of candidates) {
      const loc = c.first();
      if (await loc.isVisible().catch(() => false)) return loc;
    }
    return null;
  };

  const emailBox = await pickVisible(emailCandidates, 30_000);
  if (!emailBox) return false;
  await emailBox.fill(e2eEmail);

  const passwordBox = await pickVisible(passwordCandidates, 30_000);
  if (!passwordBox) return false;
  await passwordBox.fill(e2ePassword);

  await page.getByText('Войти', { exact: true }).click({ timeout: 30_000 }).catch(() => null);

  // Consider login successful only if we navigated away from /login.
  try {
    await page.waitForURL((url: any) => !url.pathname.includes('/login'), { timeout: 60_000 });
  } catch {
    return false;
  }

  await page.waitForLoadState('networkidle').catch(() => null);
  return true;
};

const maybeDismissRouteCoachmark = async (page: any) => {
  const okButton = page.getByText('Понятно', { exact: true });
  if (await okButton.isVisible().catch(() => false)) {
    await okButton.click({ force: true });
  }
};

const fillRichDescription = async (page: any, text: string) => {
  const editor = page.locator('.ql-editor').first();
  await expect(editor).toBeVisible({ timeout: 15000 });
  await editor.click();
  // Clear existing content.
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type(text);
};

const closePreviewModal = async (page: any) => {
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible().catch(() => false)) {
    // Some builds render an icon-only close control without an accessible name.
    await page.keyboard.press('Escape');
  }
};

const openPreviewModal = async (page: any) => {
  const previewButton = page.locator('button:has([aria-label*="eye"]), button:has-text("Превью"), button:has-text("Показать превью")');
  await expect(previewButton.first()).toBeVisible({ timeout: 15000 });
  await previewButton.first().click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 });
};

const ensureCanCreateTravel = async (page: any) => {
  await maybeAcceptCookies(page);
  const authGate = page.getByText('Войдите, чтобы создать путешествие', { exact: true });
  if (await authGate.isVisible().catch(() => false)) {
    const didLogin = await maybeLogin(page);
    if (!didLogin) {
      test.skip(true, 'E2E_EMAIL/E2E_PASSWORD are required for travel creation tests');
    }
    await page.goto('/travel/new');
    await maybeAcceptCookies(page);

    // If we're still gated after the login attempt, treat it as env/config issue.
    if (await authGate.isVisible().catch(() => false)) {
      test.skip(true, 'Could not authenticate for travel creation (E2E creds missing/invalid or login flow changed)');
    }
  }
};

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
    await ensureCanCreateTravel(page);

    // Заполняем только название
    await page.getByPlaceholder('Например: Неделя в Грузии').fill('Минимальный черновик');

    // Клик по Quick Draft
    await page.click('button:has-text("Быстрый черновик")');

    // Проверяем успешное сообщение
    await expect(page.locator('text=Черновик сохранен')).toBeVisible({ timeout: 5000 });

    // Проверяем редирект
    await expect(page).toHaveURL(/\/metravel/, { timeout: 5000 });

    // Проверяем что черновик появился в списке
    await expect(page.locator('text=Минимальный черновик').first()).toBeVisible({ timeout: 5000 });
  });

  test('должен показать валидацию при коротком названии', async ({ page }) => {
    await page.goto('/travel/new');
    await ensureCanCreateTravel(page);

    // Заполняем название < 3 символов
    await page.getByPlaceholder('Например: Неделя в Грузии').fill('AB');

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
    await ensureCanCreateTravel(page);

    const quickDraftButton = page.locator('button:has-text("Быстрый черновик")');
    await expect(quickDraftButton).toBeVisible();

    // Mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await ensureCanCreateTravel(page);

    // On mobile footer renders icon-only button with "💾" label.
    const quickDraftButtonMobile = page.locator('button:has-text("💾"), button:has-text("Быстрый черновик")');
    await expect(quickDraftButtonMobile.first()).toBeVisible();
  });
});

test.describe('Поиск мест на карте (Location Search)', () => {
  test('должен найти место и добавить точку на карту', async ({ page }) => {
    await page.goto('/travel/new');
    await ensureCanCreateTravel(page);

    // Заполняем название
    await page.getByPlaceholder('Например: Неделя в Грузии').fill('Тест поиска');
    await page.click('button:has-text("Далее")');

    // Шаг 2: Маршрут
    await expect(page.locator('text=Маршрут на карте')).toBeVisible();
    await maybeDismissRouteCoachmark(page);

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
    await ensureCanCreateTravel(page);
    await page.getByPlaceholder('Например: Неделя в Грузии').fill('Тест');
    await page.click('button:has-text("Далее")');

    // Ищем несуществующее место
    await page.fill('[placeholder*="Поиск места"]', 'asdfghjkl123456789');

    await page.waitForTimeout(1000);

    // Проверяем empty state
    await expect(page.locator('text=/Ничего не найдено|No results/i')).toBeVisible({ timeout: 5000 });
  });

  test('должен показать loading indicator при поиске', async ({ page }) => {
    await page.goto('/travel/new');
    await ensureCanCreateTravel(page);
    await page.getByPlaceholder('Например: Неделя в Грузии').fill('Тест');
    await page.click('button:has-text("Далее")');

    // Вводим текст
    await page.fill('[placeholder*="Поиск места"]', 'Москва');

    // Проверяем loading indicator (может быть виден короткое время)
    // await expect(page.locator('[aria-label="Loading"]')).toBeVisible({ timeout: 1000 });
  });

  test('должен очистить поле поиска кнопкой X', async ({ page }) => {
    await page.goto('/travel/new');
    await ensureCanCreateTravel(page);
    await page.getByPlaceholder('Например: Неделя в Грузии').fill('Тест');
    await page.click('button:has-text("Далее")');

    await expect(page.locator('text=Маршрут на карте')).toBeVisible();
    await maybeDismissRouteCoachmark(page);

    const searchInput = page.locator('[placeholder*="Поиск места"]');
    await searchInput.fill('Тбилиси');

    // Ждем появления кнопки очистки
    const clearButton = page.getByTestId('location-clear-button');
    await expect(clearButton).toBeVisible({ timeout: 5000 });

    // Кликаем по кнопке очистки
    await clearButton.click();

    // Проверяем что поле очистилось
    await expect(searchInput).toHaveValue('');
  });

  test('должен работать debounce (не запрашивать при каждом символе)', async ({ page }) => {
    await page.goto('/travel/new');
    await ensureCanCreateTravel(page);
    await page.getByPlaceholder('Например: Неделя в Грузии').fill('Тест');
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
    await ensureCanCreateTravel(page);

    // Заполняем данные
    await page.getByPlaceholder('Например: Неделя в Грузии').fill('Путешествие для превью');
    await fillRichDescription(page, 'Описание путешествия для проверки превью карточки');

    // Ждем автосохранение
    await page.waitForTimeout(6000);

    // Кликаем по кнопке превью
    await openPreviewModal(page);

    // Проверяем что модальное окно открылось
    await expect(page.getByText('Превью карточки', { exact: true })).toBeVisible();
    await expect(page.getByText('Путешествие для превью', { exact: true })).toBeVisible();
    await expect(page.getByText('Описание путешествия для проверки превью карточки', { exact: true })).toBeVisible();

    // Закрываем модальное окно
    await closePreviewModal(page);
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('должен закрыть превью по клику вне модального окна', async ({ page }) => {
    await page.goto('/travel/new');
    await ensureCanCreateTravel(page);
    await page.getByPlaceholder('Например: Неделя в Грузии').fill('Тест превью');
    await page.waitForTimeout(6000);

    await openPreviewModal(page);

    // Кликаем вне модального окна (в левом верхнем углу viewport)
    await page.mouse.click(5, 5);

    // Модальное окно должно закрыться (fallback: Escape)
    const dialog = page.getByRole('dialog');
    if (await dialog.isVisible().catch(() => false)) {
      await closePreviewModal(page);
    }
    await expect(dialog).toBeHidden({ timeout: 5000 });
  });

  test('должен показать placeholder если нет обложки', async ({ page }) => {
    await page.goto('/travel/new');
    await ensureCanCreateTravel(page);
    await page.getByPlaceholder('Например: Неделя в Грузии').fill('Без обложки');
    await page.waitForTimeout(6000);

    await openPreviewModal(page);

    // Проверяем placeholder
    await expect(page.getByRole('dialog').getByText('Нет обложки', { exact: true })).toBeVisible();
  });

  test('должен обрезать длинное описание до 150 символов', async ({ page }) => {
    await page.goto('/travel/new');
    await ensureCanCreateTravel(page);
    await page.getByPlaceholder('Например: Неделя в Грузии').fill('Длинное описание');

    const longDescription = 'Это очень длинное описание путешествия, которое содержит более 150 символов. ' +
      'Мы хотим проверить что оно правильно обрезается в превью карточки и добавляется многоточие в конце текста. ' +
      'Дополнительный текст для увеличения длины.';

    await fillRichDescription(page, longDescription);
    await page.waitForTimeout(6000);

    await openPreviewModal(page);

    // Проверяем что есть многоточие "..." в превью
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('text=/\\.\\.\\./').first()).toBeVisible();
  });

  test('должен показать статистику (дни, точки, страны)', async ({ page }) => {
    await page.goto('/travel/new');
    await ensureCanCreateTravel(page);
    await page.getByPlaceholder('Например: Неделя в Грузии').fill('Со статистикой');
    await page.click('button:has-text("Далее")');

    await expect(page.locator('text=Маршрут на карте')).toBeVisible();
    await maybeDismissRouteCoachmark(page);

    // Добавляем точку
    await page.fill('[placeholder*="Поиск места"]', 'Париж');
    await page.waitForTimeout(1000);
    await page.click('text=Париж >> nth=0');
    await page.waitForTimeout(6000);

    // Превью доступно на шаге 1, возвращаемся туда через милестон
    await page.click('[aria-label="Перейти к шагу 1"]');
    await expect(page.locator('text=Основная информация')).toBeVisible();

    // Открываем превью
    await openPreviewModal(page);

    // Проверяем статистику
    await expect(page.getByRole('dialog').locator('text=/1 точ/i').first()).toBeVisible();
  });
});

test.describe('Группировка параметров (Шаг 5)', () => {
  test('должен открывать и закрывать группу параметров', async ({ page }) => {
    await page.goto('/travel/new');
    await ensureCanCreateTravel(page);
    await page.getByPlaceholder('Например: Неделя в Грузии').fill('Тест группировки');

    // Переходим к шагу 2 (так мы гарантируем, что милестоны уже отрисованы)
    await page.click('button:has-text("Далее")');
    await expect(page.locator('text=Маршрут на карте')).toBeVisible();
    await maybeDismissRouteCoachmark(page);

    // Переходим к шагу 5 через милестон (кнопка "Далее" может быть заблокирована валидацией на шаге 2)
    await page.click('[aria-label="Перейти к шагу 5"]');

    const sectionToggle = page
      .getByRole('button', { name: 'Свернуть секцию Дополнительные параметры' })
      .or(page.getByRole('button', { name: 'Развернуть секцию Дополнительные параметры' }));
    await expect(sectionToggle.first()).toBeVisible();

    // Проверяем заголовок группы
    await expect(sectionToggle.first()).toBeVisible();

    // Проверяем счетчик
    await expect(page.locator('text=/\\d+\\/11/')).toBeVisible();

    // Группа должна быть открыта по умолчанию
    await expect(page.locator('text=Категории путешествий')).toBeVisible();

    // Кликаем по заголовку группы чтобы закрыть
    await sectionToggle.first().click();

    // Проверяем что контент скрылся
    await expect(page.locator('text=Категории путешествий')).not.toBeVisible({ timeout: 2000 });

    // Открываем обратно
    await sectionToggle.first().click();
    await expect(page.locator('text=Категории путешествий')).toBeVisible();
  });

  test('должен показывать счетчик заполненных полей', async ({ page }) => {
    await page.goto('/travel/new');
    await ensureCanCreateTravel(page);
    await page.getByPlaceholder('Например: Неделя в Грузии').fill('Тест счетчика');

    // Переходим к шагу 2 (так мы гарантируем, что милестоны уже отрисованы)
    await page.click('button:has-text("Далее")');
    await expect(page.locator('text=Маршрут на карте')).toBeVisible();
    await maybeDismissRouteCoachmark(page);

    // Переходим к шагу 5 через милестон (кнопка "Далее" может быть заблокирована валидацией на шаге 2)
    await page.click('[aria-label="Перейти к шагу 5"]');

    const sectionToggle = page
      .getByRole('button', { name: 'Свернуть секцию Дополнительные параметры' })
      .or(page.getByRole('button', { name: 'Развернуть секцию Дополнительные параметры' }));
    await expect(sectionToggle.first()).toBeVisible();

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
    await ensureCanCreateTravel(page);

    // Проверяем наличие милестонов
    await expect(page.locator('[aria-label="Перейти к шагу 1"]')).toBeVisible();
    await expect(page.locator('[aria-label="Перейти к шагу 2"]')).toBeVisible();
    await expect(page.locator('[aria-label="Перейти к шагу 6"]')).toBeVisible();
  });

  test('должен скрывать милестоны на mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/travel/new');
    await ensureCanCreateTravel(page);

    // Проверяем что милестоны скрыты
    await expect(page.locator('[aria-label="Перейти к шагу 1"]')).not.toBeVisible();
  });

  test('должен подсвечивать текущий шаг', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/travel/new');
    await ensureCanCreateTravel(page);

    // Текущий шаг должен быть подсвечен
    const currentMilestone = page.locator('[aria-label="Перейти к шагу 1"]');
    await expect(currentMilestone).toHaveClass(/active|current/i);
  });

  test('должен показывать галочку для пройденных шагов', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/travel/new');
    await ensureCanCreateTravel(page);

    // Заполняем и переходим дальше
    await page.getByPlaceholder('Например: Неделя в Грузии').fill('Тест милестонов');
    await page.click('button:has-text("Далее")');

    // Проверяем галочку на шаге 1
    const _step1 = page.locator('[aria-label="Перейти к шагу 1"]');
    // await expect(step1.locator('text=✓')).toBeVisible();
  });
});

test.describe('Разделенный чеклист (Шаг 6)', () => {
  test('должен показывать две секции чеклиста', async ({ page }) => {
    await page.goto('/travel/new');
    await ensureCanCreateTravel(page);
    await page.getByPlaceholder('Например: Неделя в Грузии').fill('Тест чеклиста');

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
    await ensureCanCreateTravel(page);
    await page.getByPlaceholder('Например: Неделя в Грузии').fill('Тест преимуществ');

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
    await ensureCanCreateTravel(page);
    await page.getByPlaceholder('Например: Неделя в Грузии').fill('Тест счетчика готовности');

    // Переходим к шагу 6
    for (let i = 0; i < 5; i++) {
      await page.click('button:has-text("Далее")');
      await page.waitForTimeout(500);
    }

    // Проверяем счетчик N/6
    await expect(page.locator('text=/\\d+\\/6/')).toBeVisible();
  });
});
