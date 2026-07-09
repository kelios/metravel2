import { test, expect, type Page } from '@playwright/test';
import { preacceptCookies, gotoWithRetry } from './helpers/navigation';
import { ensureAuthedStorageFallback, mockFakeAuthApis } from './helpers/auth';

const CALENDAR_URL = '/calendar?status=visited';

type StatusItem = {
  travel_id: number;
  status: 'visited';
  planned_date: string | null;
  visited_date: string | null;
  added_at: string;
  updated_at: string | null;
  travel: {
    id: number;
    name: string;
    slug: string;
    url: string;
    travel_image_thumb_url: string;
    countryName: string;
    // prod-форма: year — int, month — массив id, monthName — строка
    year?: number | null;
    month?: number[] | null;
    monthName?: string | null;
  };
};

const makeItem = (id: number, name: string, over: Partial<StatusItem> = {}): StatusItem => ({
  travel_id: id,
  status: 'visited',
  planned_date: null,
  visited_date: null,
  added_at: new Date(2024, 6, 1).toISOString(),
  updated_at: null,
  travel: {
    id,
    name,
    slug: `t-${id}`,
    url: `/travels/t-${id}`,
    travel_image_thumb_url: '',
    countryName: 'Италия',
  },
  ...over,
});

async function seedVisited(page: Page, items: StatusItem[]) {
  await ensureAuthedStorageFallback(page);
  await mockFakeAuthApis(page);
  await page.route('**/api/user/*/travel-statuses/**', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: items, count: items.length }),
      });
    }
    return route.continue();
  });
  await page.route('**/api/travels/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [], count: 0 }) })
  );
}

async function skipIfAuthGate(page: Page): Promise<boolean> {
  const gate = await page
    .getByText(/Войдите в аккаунт/i)
    .first()
    .isVisible()
    .catch(() => false);
  if (gate) {
    test.info().annotations.push({ type: 'note', description: 'Auth gate shown in env; skipping' });
  }
  return gate;
}

test.describe('Calendar — visited placement (#878/#880) @smoke', () => {
  test('dateless visit (prod shape: year int + month array, no exact date) renders as a card and gets a calendar marker', async ({ page }) => {
    await seedVisited(page, [
      makeItem(701, 'Озеро Гарда', {
        visited_date: null,
        travel: { ...makeItem(701, 'Озеро Гарда').travel, year: 2024, month: [7], monthName: 'Июль' },
      }),
    ]);
    await preacceptCookies(page);
    await gotoWithRetry(page, CALENDAR_URL);
    if (await skipIfAuthGate(page)) return;

    // Реальная поездка без точной даты всё равно видна карточкой.
    await expect(page.getByText('Озеро Гарда').first()).toBeVisible({ timeout: 15_000 });

    // И размещена маркером в календаре (fallback по месяцу+году → выходной июля 2024).
    await expect(page.getByLabel(/есть поездки/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('dated visits across different months all render at default view (счётчик = список) #878', async ({ page }) => {
    await seedVisited(page, [
      makeItem(640, 'Озеро Гарда велодорожка', { visited_date: '2024-06-15', travel: { ...makeItem(640, 'Озеро Гарда велодорожка').travel, year: 2024, month: [6], monthName: 'Июнь' } }),
      makeItem(569, 'Доломиты водопады', { visited_date: '2023-07-20', travel: { ...makeItem(569, 'Доломиты водопады').travel, year: 2023, month: [7], monthName: 'Июль' } }),
      makeItem(628, 'Balaton Sound', { visited_date: null, travel: { ...makeItem(628, 'Balaton Sound').travel, year: 2025, month: [8], monthName: 'Август' } }),
    ]);
    await preacceptCookies(page);
    await gotoWithRetry(page, CALENDAR_URL);
    if (await skipIfAuthGate(page)) return;

    // Без выбранной даты видны ВСЕ три визита (счётчик «Был (3)» = список из 3), несмотря на разные месяцы/годы.
    await expect(page.getByText('Озеро Гарда велодорожка').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Доломиты водопады').first()).toBeVisible();
    await expect(page.getByText('Balaton Sound').first()).toBeVisible();

    const cards = page.getByTestId(/^calendar-travel-card-/);
    await expect(cards).toHaveCount(3);
  });

  test('selecting an empty day shows contextual empty-state, "Показать все" restores the list (#880)', async ({ page }) => {
    await seedVisited(page, [
      makeItem(801, 'Рим', { visited_date: '2024-07-06' }),
      makeItem(802, 'Флоренция', { visited_date: '2024-07-13' }),
    ]);
    await preacceptCookies(page);
    await gotoWithRetry(page, CALENDAR_URL);
    if (await skipIfAuthGate(page)) return;

    // Без выбранной даты обе поездки видны.
    await expect(page.getByText('Рим').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Флоренция').first()).toBeVisible();

    // Кликаем заведомо пустой день (1 июля 2024 — записей нет).
    await page.getByTestId('mini-calendar-day-2024-07-01').click();

    // Контекстный empty-state вместо «данных нет вовсе».
    await expect(page.getByText(/В этот день поездок нет/i)).toBeVisible({ timeout: 8_000 });
    const showAll = page.getByRole('button', { name: /Показать все/i }).first();
    await expect(showAll).toBeVisible();

    // Сброс фильтра возвращает список.
    await showAll.click();
    await expect(page.getByText('Рим').first()).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText('Флоренция').first()).toBeVisible();
  });
});
