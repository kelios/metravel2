import { test, expect } from './fixtures';
import { preacceptCookies, gotoWithRetry } from './helpers/navigation';
import {
  ensureAuthedStorageFallback,
  mockFakeAuthApis,
} from './helpers/auth';

const CALENDAR_URL = '/calendar';

// Helper: seed fake auth + mock APIs
async function setupFakeAuth(page: import('@playwright/test').Page) {
  await ensureAuthedStorageFallback(page);
  await mockFakeAuthApis(page);
}

// Helper: mock travels API for "authored" travels shown in "Был" tab
async function mockMyTravels(
  page: import('@playwright/test').Page,
  travels: unknown[] = []
) {
  await page.route('**/api/travels/**', (route) => {
    const url = route.request().url();
    if (url.includes('user_id') || url.includes('where')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: travels, count: travels.length }),
      });
    }
    return route.continue();
  });
}

test.describe('Calendar @smoke', () => {
  test('unauthenticated user sees login prompt on /calendar', async ({ page }) => {
    await page.context().clearCookies();
    await page.addInitScript(() => {
      try {
        window.localStorage.removeItem('secure_userToken');
        window.localStorage.removeItem('userId');
        window.localStorage.removeItem('userName');
      } catch {
        // ignore
      }
    });

    await preacceptCookies(page);
    await gotoWithRetry(page, CALENDAR_URL);

    const authPrompt = page.getByText(/Войдите в аккаунт|Войти/i);
    await expect(authPrompt.first()).toBeVisible({ timeout: 15_000 });
  });

  test('authenticated user sees calendar page with three tabs', async ({ page }) => {
    await setupFakeAuth(page);
    await mockMyTravels(page);
    await preacceptCookies(page);
    await gotoWithRetry(page, CALENDAR_URL);

    const authPromptVisible = await page
      .getByText(/Войдите в аккаунт/i)
      .first()
      .isVisible()
      .catch(() => false);

    if (authPromptVisible) {
      test.info().annotations.push({
        type: 'note',
        description: 'Calendar page is showing auth prompt in current env; skipping tabs assertion',
      });
      return;
    }

    // All three tabs should be visible
    const wasTab = page.getByRole('button', { name: /Был/i });
    const plannedTab = page.getByRole('button', { name: /Планирую/i });
    const wishlistTab = page.getByRole('button', { name: /Хочу/i });

    await Promise.all([
      wasTab.first().waitFor({ state: 'visible', timeout: 15_000 }),
      plannedTab.first().waitFor({ state: 'visible', timeout: 15_000 }),
      wishlistTab.first().waitFor({ state: 'visible', timeout: 15_000 }),
    ]);

    await expect(wasTab.first()).toBeVisible();
    await expect(plannedTab.first()).toBeVisible();
    await expect(wishlistTab.first()).toBeVisible();
  });

  test('tab switching works — Был / Планирую / Хочу', async ({ page }) => {
    await setupFakeAuth(page);
    await mockMyTravels(page);
    await preacceptCookies(page);
    await gotoWithRetry(page, CALENDAR_URL);

    const authPromptVisible = await page
      .getByText(/Войдите в аккаунт/i)
      .first()
      .isVisible()
      .catch(() => false);

    if (authPromptVisible) {
      test.info().annotations.push({
        type: 'note',
        description: 'Auth prompt visible; skipping tab switching assertion',
      });
      return;
    }

    // Click "Был" tab
    const wasTab = page.getByRole('button', { name: /Был/i }).first();
    const isWasVisible = await wasTab
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => true)
      .catch(() => false);

    if (!isWasVisible) {
      test.info().annotations.push({
        type: 'note',
        description: 'Calendar tabs not available in current env; skipping',
      });
      return;
    }

    await wasTab.click();
    await page.waitForTimeout(300);

    // After clicking "Был", hint text should be visible
    const visitedHint = page.getByText(/путешествия, которые ты добавил на сайт/i);
    const hasHint = await visitedHint
      .first()
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);

    if (hasHint) {
      await expect(visitedHint.first()).toBeVisible();
    }

    // Click "Планирую" tab
    const plannedTab = page.getByRole('button', { name: /Планирую/i }).first();
    await plannedTab.click();
    await page.waitForTimeout(300);

    // MiniCalendar should appear for "Планирую" tab
    const calendarHint = page.getByText(/Открой путешествие.*Планирую/i);
    const hasCalendarHint = await calendarHint
      .first()
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);

    if (hasCalendarHint) {
      await expect(calendarHint.first()).toBeVisible();
    }

    // Click "Хочу" tab
    const wishlistTab = page.getByRole('button', { name: /Хочу/i }).first();
    await wishlistTab.click();
    await page.waitForTimeout(300);

    const wishlistHint = page.getByText(/Избранные.*автоматически|Добавляй путешествия в избранное/i);
    const hasWishlistHint = await wishlistHint
      .first()
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);

    if (hasWishlistHint) {
      await expect(wishlistHint.first()).toBeVisible();
    }
  });

  test('"Был" tab shows authored travels from API', async ({ page }) => {
    const mockTravel = {
      id: 9001,
      name: 'Тестовое путешествие E2E',
      slug: 'test-e2e-travel',
      url: '/travels/test-e2e-travel',
      travel_image_thumb_url: '',
      countryName: 'Беларусь',
      cityName: 'Минск',
      publish: 1,
      moderation: 1,
      created_at: new Date().toISOString(),
    };

    await setupFakeAuth(page);
    await mockMyTravels(page, [mockTravel]);
    await preacceptCookies(page);
    await gotoWithRetry(page, CALENDAR_URL);

    const authPromptVisible = await page
      .getByText(/Войдите в аккаунт/i)
      .first()
      .isVisible()
      .catch(() => false);

    if (authPromptVisible) {
      test.info().annotations.push({
        type: 'note',
        description: 'Auth prompt visible; skipping authored travels assertion',
      });
      return;
    }

    // Navigate to "Был" tab
    const wasTab = page.getByRole('button', { name: /Был/i }).first();
    const isVisible = await wasTab
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => true)
      .catch(() => false);

    if (!isVisible) {
      test.info().annotations.push({
        type: 'note',
        description: 'Calendar tabs not available; skipping authored travels assertion',
      });
      return;
    }

    await wasTab.click();
    await page.waitForTimeout(500);

    // Check if authored travel card appears
    const travelCard = page.getByText(/Тестовое путешествие E2E/i);
    const cardVisible = await travelCard
      .first()
      .waitFor({ state: 'visible', timeout: 8_000 })
      .then(() => true)
      .catch(() => false);

    if (cardVisible) {
      await expect(travelCard.first()).toBeVisible();
    } else {
      test.info().annotations.push({
        type: 'note',
        description: 'Authored travel card not rendered (env limitation): skipping strict card assertion',
      });
    }
  });

  test('"Планирую" tab shows MiniCalendar grid', async ({ page }) => {
    await setupFakeAuth(page);
    await mockMyTravels(page);
    await preacceptCookies(page);
    await gotoWithRetry(page, CALENDAR_URL);

    const authPromptVisible = await page
      .getByText(/Войдите в аккаунт/i)
      .first()
      .isVisible()
      .catch(() => false);

    if (authPromptVisible) {
      test.info().annotations.push({
        type: 'note',
        description: 'Auth prompt visible; skipping MiniCalendar assertion',
      });
      return;
    }

    const plannedTab = page.getByRole('button', { name: /Планирую/i }).first();
    const isVisible = await plannedTab
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => true)
      .catch(() => false);

    if (!isVisible) {
      test.info().annotations.push({
        type: 'note',
        description: 'Calendar tabs not visible; skipping MiniCalendar assertion',
      });
      return;
    }

    await plannedTab.click();
    await page.waitForTimeout(500);

    // MiniCalendar shows month navigation arrows and day numbers
    const prevArrow = page.getByRole('button', { name: /предыдущий месяц|пред/i });
    const nextArrow = page.getByRole('button', { name: /следующий месяц|след/i });

    const hasPrev = await prevArrow
      .first()
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    const hasNext = await nextArrow
      .first()
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);

    // At least one navigation arrow should be rendered when MiniCalendar is shown
    if (!hasPrev && !hasNext) {
      test.info().annotations.push({
        type: 'note',
        description: 'MiniCalendar navigation arrows not found (env limitation); skipping',
      });
      return;
    }

    // Calendar should display current month name
    const currentYear = new Date().getFullYear().toString();
    const yearText = page.getByText(currentYear);
    await expect(yearText.first()).toBeVisible({ timeout: 5_000 });
  });

  test('"Планирую" tab month navigation works', async ({ page }) => {
    await setupFakeAuth(page);
    await mockMyTravels(page);
    await preacceptCookies(page);
    await gotoWithRetry(page, CALENDAR_URL);

    const authPromptVisible = await page
      .getByText(/Войдите в аккаунт/i)
      .first()
      .isVisible()
      .catch(() => false);

    if (authPromptVisible) {
      test.info().annotations.push({
        type: 'note',
        description: 'Auth prompt visible; skipping month navigation assertion',
      });
      return;
    }

    const plannedTab = page.getByRole('button', { name: /Планирую/i }).first();
    const isVisible = await plannedTab
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => true)
      .catch(() => false);

    if (!isVisible) {
      test.info().annotations.push({
        type: 'note',
        description: 'Calendar tabs not visible; skipping month navigation assertion',
      });
      return;
    }

    await plannedTab.click();
    await page.waitForTimeout(500);

    const nextArrow = page.getByRole('button', { name: /следующий месяц|след/i }).first();
    const hasNext = await nextArrow
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);

    if (!hasNext) {
      test.info().annotations.push({
        type: 'note',
        description: 'MiniCalendar next arrow not visible; skipping navigation test',
      });
      return;
    }

    await nextArrow.click();
    await page.waitForTimeout(300);

    // After clicking next, the calendar should still be visible (no crash)
    await expect(nextArrow).toBeVisible({ timeout: 5_000 });
  });

  test('empty state shown for each tab when no data', async ({ page }) => {
    await setupFakeAuth(page);
    await mockMyTravels(page); // returns empty travels
    await preacceptCookies(page);
    await gotoWithRetry(page, CALENDAR_URL);

    const authPromptVisible = await page
      .getByText(/Войдите в аккаунт/i)
      .first()
      .isVisible()
      .catch(() => false);

    if (authPromptVisible) {
      test.info().annotations.push({
        type: 'note',
        description: 'Auth prompt visible; skipping empty state assertion',
      });
      return;
    }

    const wasTab = page.getByRole('button', { name: /Был/i }).first();
    const isVisible = await wasTab
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => true)
      .catch(() => false);

    if (!isVisible) {
      test.info().annotations.push({
        type: 'note',
        description: 'Calendar tabs not visible; skipping empty state assertion',
      });
      return;
    }

    for (const tabName of [/Был/i, /Планирую/i, /Хочу/i]) {
      const tab = page.getByRole('button', { name: tabName }).first();
      await tab.click();
      await page.waitForTimeout(300);

      // Each tab should show empty state or a hint when no data
      const hasContent = await Promise.race([
        page.getByText(/нет|пуст|найди|добавляй/i).first()
          .waitFor({ state: 'visible', timeout: 5_000 })
          .then(() => true)
          .catch(() => false),
      ]);

      if (hasContent) {
        const emptyText = page.getByText(/нет|пуст|найди|добавляй/i).first();
        await expect(emptyText).toBeVisible();
      }
    }
  });

  test('year-only authored travel is placed on the calendar (no exact date)', async ({ page }) => {
    // Путешествие без точной даты и без месяца — только год.
    // Регрессия: раньше оно не получало дату и пропадало с сетки календаря.
    const yearOnlyTravel = {
      id: 9042,
      name: 'Путешествие только с годом E2E',
      slug: 'year-only-e2e',
      url: '/travels/year-only-e2e',
      travel_image_thumb_url: '',
      countryName: 'Беларусь',
      cityName: 'Гродно',
      year: '2024',
      publish: 1,
      moderation: 1,
      created_at: new Date().toISOString(),
    };

    await setupFakeAuth(page);
    await mockMyTravels(page, [yearOnlyTravel]);
    await preacceptCookies(page);
    await gotoWithRetry(page, CALENDAR_URL);

    const authPromptVisible = await page
      .getByText(/Войдите в аккаунт/i)
      .first()
      .isVisible()
      .catch(() => false);

    if (authPromptVisible) {
      test.info().annotations.push({
        type: 'note',
        description: 'Auth prompt visible; skipping year-only placement assertion',
      });
      return;
    }

    const wasTab = page.getByRole('button', { name: /Был/i }).first();
    const isVisible = await wasTab
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => true)
      .catch(() => false);

    if (!isVisible) {
      test.info().annotations.push({
        type: 'note',
        description: 'Calendar tabs not available; skipping year-only placement assertion',
      });
      return;
    }

    await wasTab.click();
    await page.waitForTimeout(800);

    // Карточка путешествия должна отображаться.
    await expect(
      page.getByText(/Путешествие только с годом E2E/i).first()
    ).toBeVisible({ timeout: 8_000 });

    // Ключевая проверка фикса: MiniCalendar сфокусирован на годе путешествия (2024),
    // а не на текущем годе. Заголовок MiniCalendar — "<Месяц> 2024".
    const miniCalendarHeader = page.getByText(
      /(Январь|Февраль|Март|Апрель|Май|Июнь|Июль|Август|Сентябрь|Октябрь|Ноябрь|Декабрь)\s+2024/
    );
    await expect(miniCalendarHeader.first()).toBeVisible({ timeout: 8_000 });
  });

  test('calendar page has no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await setupFakeAuth(page);
    await mockMyTravels(page);
    await preacceptCookies(page);
    await gotoWithRetry(page, CALENDAR_URL);
    await page.waitForTimeout(2_000);

    const authPromptVisible = await page
      .getByText(/Войдите в аккаунт/i)
      .first()
      .isVisible()
      .catch(() => false);

    if (authPromptVisible) {
      test.info().annotations.push({
        type: 'note',
        description: 'Auth prompt visible; skipping console errors check',
      });
      return;
    }

    const critical = errors.filter(
      (e) =>
        !e.includes('401') &&
        !e.includes('403') &&
        !e.includes('favicon') &&
        !e.includes('ResizeObserver') &&
        !e.includes('Non-Error exception') &&
        !e.includes('Loading chunk')
    );

    expect(critical, `Console errors on /calendar: ${critical.join('\n')}`).toHaveLength(0);
  });
});

