import { test, expect } from './fixtures';
import { preacceptCookies, gotoWithRetry } from './helpers/navigation';
import {
  ensureAuthedStorageFallback,
  mockFakeAuthApis,
} from './helpers/auth';

const CALENDAR_URL = '/calendar';

async function mockSharedShellApis(page: import('@playwright/test').Page) {
  await page.route('**/api/getFiltersTravel/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      categories: [],
      categoryTravelAddress: [],
      companions: [],
      complexity: [],
      month: [],
      over_nights_stay: [],
      sortings: [],
      transports: [],
      year: [],
    }),
  }));
  await page.route('**/api/countries/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([]),
  }));
}

// Helper: seed fake auth + mock APIs
async function setupFakeAuth(page: import('@playwright/test').Page) {
  await ensureAuthedStorageFallback(page);
  await mockFakeAuthApis(page);
  await mockSharedShellApis(page);
  await page.route('**/api/user/*/travel-statuses/**', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [], count: 0 }),
      });
    }
    return route.continue();
  });

}

// Helper: mock authored travels API; календарь добавляет опубликованные авторские маршруты как default "Был".
async function mockMyTravels(
  page: import('@playwright/test').Page,
  travels: unknown[] = []
) {
  await page.route('**/api/travels/**', (route) => {
    if (route.request().method() === 'GET') {
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
    await mockSharedShellApis(page);
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

    // All three tabs should be visible
    const wasTab = page.getByRole('button', { name: /Был/i });
    const plannedTab = page.getByRole('button', { name: /Планирую/i });
    const wishlistTab = page.getByRole('button', { name: /Хочу/i });

    await expect(wasTab.first()).toBeVisible({ timeout: 15_000 });
    await expect(plannedTab.first()).toBeVisible({ timeout: 15_000 });
    await expect(wishlistTab.first()).toBeVisible({ timeout: 15_000 });
  });

  test('tab switching works — Был / Планирую / Хочу', async ({ page }) => {
    await setupFakeAuth(page);
    await mockMyTravels(page);
    await preacceptCookies(page);
    await gotoWithRetry(page, CALENDAR_URL);

    // Click "Был" tab
    const wasTab = page.getByRole('button', { name: /Был/i }).first();
    await expect(wasTab).toBeVisible({ timeout: 15_000 });
    await wasTab.click();
    await expect(page.getByText(/посещённые поездки за этот день|добавь её прямо в карточке/i).first())
      .toBeVisible({ timeout: 5_000 });

    // Click "Планирую" tab
    const plannedTab = page.getByRole('button', { name: /Планирую/i }).first();
    await plannedTab.click();
    await page.waitForTimeout(300);

    await expect(page.getByText(/Нет запланированных поездок/i).first())
      .toBeVisible({ timeout: 5_000 });

    // Click "Хочу" tab
    const wishlistTab = page.getByRole('button', { name: /Хочу/i }).first();
    await wishlistTab.click();
    await page.waitForTimeout(300);

    const wishlistHint = page.getByText(/«Хочу поехать» на этот день|статус «Хочу поехать»/i);
    await expect(wishlistHint.first()).toBeVisible({ timeout: 5_000 });
  });

  test('"Был" tab shows authored travels as default visited without an explicit user status', async ({ page }) => {
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
      year: 2026,
      month: [5],
      monthName: 'Май',
      created_at: new Date().toISOString(),
    };

    await setupFakeAuth(page);
    await mockMyTravels(page, [mockTravel]);
    await preacceptCookies(page);
    await gotoWithRetry(page, CALENDAR_URL);

    // Navigate to "Был" tab
    const wasTab = page.getByRole('button', { name: /Был/i }).first();
    await expect(wasTab).toBeVisible({ timeout: 15_000 });
    await wasTab.click();

    // Authored published travel appears in "Был" as a derived default status.
    const travelCard = page.getByText(/Тестовое путешествие E2E/i);
    await expect(travelCard.first()).toBeVisible({ timeout: 15_000 });

    const cards = page.getByTestId(/^calendar-travel-card-/);
    await expect(cards).toHaveCount(1);
  });

  test('"Планирую" tab shows MiniCalendar grid', async ({ page }) => {
    await setupFakeAuth(page);
    await mockMyTravels(page);
    await preacceptCookies(page);
    await gotoWithRetry(page, CALENDAR_URL);

    const plannedTab = page.getByRole('button', { name: /Планирую/i }).first();
    await expect(plannedTab).toBeVisible({ timeout: 15_000 });
    await plannedTab.click();

    // MiniCalendar shows month navigation arrows and day numbers
    const prevArrow = page.getByRole('button', { name: /предыдущий месяц|пред/i });
    const nextArrow = page.getByRole('button', { name: /следующий месяц|след/i });

    await expect(prevArrow.first()).toBeVisible({ timeout: 5_000 });
    await expect(nextArrow.first()).toBeVisible({ timeout: 5_000 });

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

    const plannedTab = page.getByRole('button', { name: /Планирую/i }).first();
    await expect(plannedTab).toBeVisible({ timeout: 15_000 });
    await plannedTab.click();

    const nextArrow = page.getByRole('button', { name: /следующий месяц|след/i }).first();
    await expect(nextArrow).toBeVisible({ timeout: 5_000 });
    const monthLabel = page.locator('text=/^[А-ЯЁA-Z][а-яёa-z]+ \\d{4}$/').first();
    const initialMonth = await monthLabel.textContent();
    await nextArrow.click();
    await expect(monthLabel).not.toHaveText(initialMonth ?? '', { timeout: 5_000 });
  });

  test('empty state shown for each tab when no data', async ({ page }) => {
    await setupFakeAuth(page);
    await mockMyTravels(page); // returns empty travels
    await preacceptCookies(page);
    await gotoWithRetry(page, CALENDAR_URL);

    const expectedEmptyStates = [
      { tabName: /Был/i, emptyState: /Нет посещённых мест/i },
      { tabName: /Планирую/i, emptyState: /Нет запланированных поездок/i },
      { tabName: /Хочу/i, emptyState: /В «Хочу поехать» пока пусто/i },
    ];

    for (const { tabName, emptyState } of expectedEmptyStates) {
      const tab = page.getByRole('button', { name: tabName }).first();
      await expect(tab).toBeVisible({ timeout: 15_000 });
      await tab.click();
      await expect(page.getByText(emptyState).first()).toBeVisible({ timeout: 5_000 });
    }
  });


  test('calendar page has no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    const failedResponses: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('response', (response) => {
      if (response.status() >= 400) {
        failedResponses.push(`${response.status()} ${response.url()}`);
      }
    });

    await setupFakeAuth(page);
    await mockMyTravels(page);
    await preacceptCookies(page);
    await gotoWithRetry(page, CALENDAR_URL);
    await page.waitForTimeout(2_000);

    expect(
      errors,
      `Console errors on /calendar: ${errors.join('\n')}\nFailed responses: ${failedResponses.join('\n')}`,
    ).toHaveLength(0);
    expect(failedResponses, `Failed responses on /calendar: ${failedResponses.join('\n')}`).toHaveLength(0);
  });
});
