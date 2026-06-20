import { test, expect } from './fixtures';

/**
 * Публичные поездки «Поехали со мной» (Sprint 14, #416).
 *
 * Flow покрывается детерминированно через page.route — статический e2e-билд
 * (__DEV__=false) сам по себе мок-фолбэк не отдаёт, поэтому ответы бэка
 * (которого ещё нет) мокаются на сетевом уровне. Покрытие:
 *   1. каталог рендерит карточки публичных поездок + метку «Продвигается»;
 *   2. переход в деталь поездки;
 *   3. организатор: список заявок + accept → смена статуса на «Одобрена».
 */

const ANON_STATE = { cookies: [], origins: [] };

function seedConsent(page: import('@playwright/test').Page) {
  return page.addInitScript(() => {
    try {
      window.localStorage.setItem(
        'metravel_consent_v1',
        JSON.stringify({ necessary: true, analytics: false, date: '2026-01-01T00:00:00.000Z' }),
      );
    } catch {
      // ignore
    }
  });
}

const CATALOG = [
  {
    id: 9001,
    slug: 'braslav-weekend',
    title: 'Браславские озёра — выходные с палаткой',
    cover_url: null,
    region: 'Витебская область',
    trip_type: 'Поход',
    start_date: '2026-07-18',
    end_date: '2026-07-20',
    organizer: { id: 1, name: 'Мария', avatar: null },
    seats_total: 6,
    seats_taken: 2,
    status: 'open',
    description: 'Браславские озёра на два дня.',
    featured: true,
    my_application_status: null,
    is_owner: false,
    meeting_point: null,
    contact_note: null,
  },
  {
    id: 9003,
    slug: 'naroch-bike',
    title: 'Велокольцо вокруг Нарочи',
    cover_url: null,
    region: 'Минская область',
    trip_type: 'Велопоход',
    start_date: '2026-08-09',
    end_date: '2026-08-10',
    organizer: { id: 7, name: 'Вы', avatar: null },
    seats_total: 8,
    seats_taken: 3,
    status: 'open',
    description: 'Велосипедное кольцо вокруг озера Нарочь.',
    featured: false,
    my_application_status: null,
    is_owner: true,
    meeting_point: 'Стоянка у санатория «Нарочь», 9:00',
    contact_note: 'Чат открывается после одобрения.',
  },
];

const APPLICATIONS = [
  {
    id: 6001,
    trip_id: 9003,
    trip_title: 'Велокольцо вокруг Нарочи',
    applicant: {
      id: 101,
      name: 'Дмитрий К.',
      avatar: null,
      activity_summary: '12 поездок · 3 квеста',
      badges: ['explorer', 'cyclist'],
    },
    message: 'Катаю по 100 км в выходные. Готов помочь.',
    social_links: [],
    status: 'new',
    created_at: '2026-06-18T08:15:00Z',
  },
];

async function mockTripApis(page: import('@playwright/test').Page) {
  await page.route('**/api/trips/public/9003/applications/**', (route) =>
    route.fulfill({ json: APPLICATIONS }),
  );
  await page.route('**/api/trips/public/9003/**', (route) =>
    route.fulfill({ json: CATALOG[1] }),
  );
  await page.route('**/api/trips/public/9001/**', (route) =>
    route.fulfill({ json: CATALOG[0] }),
  );
  await page.route('**/api/trips/public/**', (route) =>
    route.fulfill({ json: CATALOG }),
  );
  await page.route('**/api/trips/applications/**', (route) =>
    route.fulfill({ json: { granted: true } }),
  );
}

test.describe('Публичные поездки', () => {
  test.use({ storageState: ANON_STATE });

  test('каталог рендерит карточки и метку «Продвигается»', async ({ page }) => {
    await seedConsent(page);
    await mockTripApis(page);

    await page.goto('/trips');

    await expect(page.getByText('Поехали со мной').first()).toBeVisible();
    await expect(page.getByText('Браславские озёра — выходные с палаткой')).toBeVisible();
    await expect(page.getByText('Велокольцо вокруг Нарочи')).toBeVisible();
    // #463 — featured-карточка помечена «Продвигается».
    await expect(page.getByText('Продвигается').first()).toBeVisible();
  });

  test('организатор одобряет заявку → статус «Одобрена»', async ({ page }) => {
    await seedConsent(page);
    await mockTripApis(page);

    await page.goto('/trips/9003');

    // Панель организатора со списком заявок (#413).
    await expect(page.getByTestId('organizer-applications-panel')).toBeVisible();
    await expect(page.getByText('Дмитрий К.')).toBeVisible();

    // accept → оптимистичная смена статуса на «Одобрена» (#414).
    await page.getByTestId('trip-application-6001-approve').click();
    await expect(
      page.getByTestId('trip-application-6001').getByText('Одобрена'),
    ).toBeVisible();
  });
});
