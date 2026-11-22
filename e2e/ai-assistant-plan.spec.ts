import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { ensureAuthedStorageFallback, mockFakeAuthApis } from './helpers/auth';
import { preacceptCookies } from './helpers/navigation';
import { runtimeViewport } from './helpers/runtimeViewport';
import { aiAssistStaticResources as ruAssist } from '@/i18n/locales/ru/static/ai_assist_static';
import { tripsStaticResources as ruTrips } from '@/i18n/locales/ru/static/trips_static';

/**
 * #3298: «Спланируй два дня в Кракове» → план по дням из `POST /ai/plan` → «Открыть в планировщике» →
 * форма новой поездки с точками плана. Служба мокается целиком: `/ai/plan` отдаёт готовый план, а при
 * отказе вопрос обязан уйти в обычный `/ai/ask`. Бандл собран с `EXPO_PUBLIC_AI_ASSISTANT=1` (.env),
 * иначе экрана нет и сценарий пропускается явно.
 */
const SCREEN_TIMEOUT_MS = 30_000;
/** Desktop 1280 по умолчанию; `E2E_RUNTIME_MOBILE_ONLY=1` — тот же набор на mobile 390. */
const VIEWPORT = runtimeViewport({ width: 1280, height: 720 });
const QUESTION = 'Спланируй два дня в Кракове';

const waitForScreen = (screen: Locator): Promise<boolean> =>
  screen.waitFor({ state: 'visible', timeout: SCREEN_TIMEOUT_MS }).then(() => true).catch(() => false);

const item = (type: 'travel' | 'quest', id: number, title: string, hours: number, lat: number, lng: number) => ({
  type,
  source_id: id,
  title,
  url: `https://metravel.by/${type === 'quest' ? 'quests' : 'travels'}/e2e-${id}`,
  path: `/${type === 'quest' ? 'quests' : 'travels'}/e2e-${id}`,
  hours,
  lat,
  lng,
  cover: null,
  city: type === 'quest' ? 'Краков' : null,
  country: 'Польша',
});

const PLAN = {
  days: [
    { items: [item('travel', 568, 'Краков: путеводитель по местам', 4, 50.061, 19.937), item('quest', 246, 'Квест по Кракову: чёрные дамы', 2, 50.054, 19.935)] },
    { items: [item('travel', 636, 'Что посмотреть вокруг Кракова', 4, 50.2, 19.83)] },
  ],
  // Фразу к плану пишет только код; непроверенный текст модели служба не отдаёт.
  note: '',
  days_requested: 2,
  assembled: 'code',
  remaining: 9,
};

const sse = (...events: Array<[string, Record<string, unknown>]>): string =>
  events.map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`).join('');

async function openAssistant(page: Page, viewport: { width: number; height: number } = VIEWPORT): Promise<void> {
  await page.setViewportSize(viewport);
  await preacceptCookies(page);
  await page.goto('/assistant', { waitUntil: 'domcontentloaded' });
  const screen = page.getByTestId('assistant-screen');
  test.skip(!(await waitForScreen(screen)), 'бандл собран без EXPO_PUBLIC_AI_ASSISTANT');
  await expect(page.locator('[data-testid="assistant-screen"][data-live="true"] [data-testid="assistant-input"]')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS });
}

async function waitForLive(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="assistant-screen"][data-live="true"] [data-testid="assistant-input"]')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS });
}

async function send(page: Page, question: string): Promise<void> {
  await page.getByTestId('assistant-input').fill(question);
  await page.getByTestId('assistant-send').click();
}

/**
 * Адрес формы поездки при переходе из плана ассистента: ровно `source=plan`, `draft=<id>` и — с #3449 —
 * `planner_source=assistant` (`usePlanTripFromSource('assistant')` → `beginTripPlannerEntry`). Порядок
 * параметров контрактом не закреплён (docs/features/analytics-events.md), поэтому сверяется разобранный
 * адрес, а не строка: лишний, повторный или пропавший параметр — красный.
 */
const plannerDraftAddress = (href: string) => {
  const url = new URL(href, 'http://e2e.invalid');
  return { path: url.pathname, hash: url.hash, params: [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b)) };
};

const plannerDraftAddressOf = (draftId?: string) => ({
  path: '/trips/plan/create',
  hash: '',
  params: [['draft', draftId ?? expect.stringMatching(/^[a-z0-9]+$/)], ['planner_source', 'assistant'], ['source', 'plan']],
});

/** Ждёт перехода в форму поездки по адресу из плана ассистента. */
async function expectPlannerDraftUrl(page: Page): Promise<void> {
  await expect.poll(() => plannerDraftAddress(page.url()), { timeout: SCREEN_TIMEOUT_MS }).toEqual(plannerDraftAddressOf());
}

test.describe('Assistant trip plan via /ai/plan (#3298)', () => {
  test('plan → planner: days with material cards, then the trip form with the plan points', async ({ page }) => {
    await mockFakeAuthApis(page);
    await ensureAuthedStorageFallback(page, { userId: '3298', userName: 'E2E Plan User' });
    const planRequests: Array<Record<string, unknown>> = [];
    const askRequests: string[] = [];
    await page.route('**/ai/plan', async (route) => {
      planRequests.push(route.request().postDataJSON() as Record<string, unknown>);
      await route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify(PLAN) });
    });
    await page.route('**/ai/ask', async (route) => {
      askRequests.push(route.request().url());
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"ask must not be called"}' });
    });

    await openAssistant(page);
    await send(page, QUESTION);

    await expect(page.getByTestId('assistant-plan')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS });
    expect(planRequests).toEqual([{ q: QUESTION, locale: 'ru' }]);
    expect(askRequests).toEqual([]);
    await expect(page.getByTestId('assistant-plan-day-1')).toContainText('День 1');
    await expect(page.getByTestId('assistant-plan-day-2')).toContainText('День 2');
    await expect(page.getByTestId('assistant-plan-day-1').getByTestId('assistant-source-card-travel-568')).toBeVisible();
    await expect(page.getByTestId('assistant-plan-day-1').getByTestId('assistant-source-card-quest-246')).toBeVisible();
    await expect(page.getByTestId('assistant-plan-day-2').getByTestId('assistant-source-card-travel-636')).toBeVisible();
    await expect(page.getByTestId('assistant-plan-short')).toHaveCount(0);
    // Страница вбок не едет: карточки дня прокручиваются внутри своего ряда.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    // Цель касания кнопки — не меньше 44 px.
    const open = page.getByTestId('assistant-plan-open');
    // Подпись кнопки — в aria-label: текст кнопки UIButton несёт служебный хвостовой пробел.
    await expect(open).toHaveAttribute('aria-label', ruAssist['ask.planOpen']);
    expect((await open.boundingBox())!.height).toBeGreaterThanOrEqual(44);

    await open.click();
    await expectPlannerDraftUrl(page);
    // В адресе нет ни вопроса, ни точек плана.
    expect(decodeURIComponent(page.url())).not.toMatch(/Краков|50\.0/);
    await expect(page.getByTestId('trip-create-form')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS });
    await expect(page.getByTestId('trip-create-title')).toHaveValue(QUESTION);
    await expect(page.getByTestId('trip-create-route-draft')).toContainText('3');
    await expect(page.getByTestId('trip-create-form')).toContainText('День 1: «Краков: путеводитель по местам»');
  });

  test('fewer materials than days: the plan is shorter and says how many days the materials cover', async ({ page }) => {
    await page.route('**/ai/plan', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify({ ...PLAN, days: PLAN.days.slice(0, 1), days_requested: 5 }) });
    });
    await openAssistant(page);
    await send(page, 'Спланируй пять дней в Лиде');
    await expect(page.getByTestId('assistant-plan-short')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS });
    await expect(page.getByTestId('assistant-plan-short')).toContainText('1');
    await expect(page.getByTestId('assistant-plan-day-2')).toHaveCount(0);
  });

  test('/ai/plan refuses (422) → the same question goes to /ai/ask, no error on screen', async ({ page }) => {
    const askBodies: Array<Record<string, unknown>> = [];
    await page.route('**/ai/plan', async (route) => {
      await route.fulfill({ status: 422, contentType: 'application/json', body: '{"error":"invalid_plan"}' });
    });
    await page.route('**/ai/ask', async (route) => {
      askBodies.push(route.request().postDataJSON() as Record<string, unknown>);
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream; charset=utf-8',
        body: sse(['sources', { sources: [], degraded: false, remaining: 19 }], ['text', { text: 'Загляните в каталог маршрутов.' }], ['done', { status: 'done', removed_links: 0, remaining: 19 }]),
      });
    });
    await openAssistant(page);
    await send(page, QUESTION);
    await expect(page.getByTestId('assistant-turn-done')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS });
    await expect(page.getByTestId('assistant-answer-text')).toContainText('Загляните в каталог маршрутов.');
    await expect(page.getByTestId('assistant-plan')).toHaveCount(0);
    expect(askBodies.map((body) => body.q)).toEqual([QUESTION]);
  });
});

// ── Сценарии #3298 поверх плана: часы, планировщик, сбой маршрута, гость, чужой черновик, квест ──

const WIDTHS = [390, 1280] as const;
const SHOTS = '.codex-temp/3298/e2e';
const DRAFT_KEY = 'metravel:tripPlanDraft';
const USER_ID = '3298';
const TRIP_ID = 3298001;
const START_POINT = { name: 'Вокзал Краков-Главный', lat: '50.0680', lng: '19.9475' };

const sizeOf = (width: number) => ({ width, height: width < 600 ? 844 : 720 });
const noHorizontalScroll = (page: Page): Promise<boolean> => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const readDraft = (page: Page): Promise<string | null> => page.evaluate((key) => window.localStorage.getItem(key), DRAFT_KEY);

async function signIn(page: Page): Promise<void> {
  await mockFakeAuthApis(page);
  await ensureAuthedStorageFallback(page, { userId: USER_ID, userName: 'E2E Plan User' });
}

async function mockPlan(page: Page, plan: Record<string, unknown> = PLAN): Promise<Array<Record<string, unknown>>> {
  const requests: Array<Record<string, unknown>> = [];
  await page.route('**/ai/plan', async (route) => {
    requests.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify(plan) });
  });
  return requests;
}

async function mockAskEcho(page: Page, text = 'Загляните в каталог маршрутов.', cards: unknown[] = []): Promise<Array<Record<string, unknown>>> {
  const bodies: Array<Record<string, unknown>> = [];
  await page.route('**/ai/ask', async (route) => {
    bodies.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream; charset=utf-8',
      body: sse(['sources', { sources: cards, degraded: false, remaining: 19 }], ['text', { text }], ['done', { status: 'done', removed_links: 0, remaining: 19 }]),
    });
  });
  return bodies;
}

/** Поездки: POST создаёт поездку (в ответе уже стартовая точка формы, как у бэкенда), PUT …/route/ сохраняет точки. */
async function mockTrips(page: Page, options: { putStatuses?: number[] } = {}) {
  const posts: Array<Record<string, unknown>> = [];
  const puts: Array<{ points: Array<Record<string, unknown>> }> = [];
  const statuses = [...(options.putStatuses ?? [])];
  let startPoint: Record<string, unknown> | null = null;
  const trip = (points: unknown[]) => ({
    id: TRIP_ID,
    title: 'Краков',
    description: '',
    start_date: '2026-12-01T09:00:00',
    end_date: null,
    status: 'planned',
    owner: { id: Number(USER_ID), username: 'E2E Plan User', avatar: null },
    participants: [],
    route: { points },
    is_public: true,
    max_participants: 4,
  });
  await page.route('**/api/trips/planned/', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const body = route.request().postDataJSON() as Record<string, unknown>;
    posts.push(body);
    startPoint = body.start_point_name
      ? { id: 1, point_type: 'place', order: 1, title: body.start_point_name, description: '', lat: body.start_lat, lng: body.start_lng }
      : null;
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(trip(startPoint ? [startPoint] : [])) });
  });
  await page.route(`**/api/trips/planned/${TRIP_ID}/route/`, async (route) => {
    if (route.request().method() !== 'PUT') return route.fallback();
    const body = route.request().postDataJSON() as { points: Array<Record<string, unknown>> };
    puts.push(body);
    const status = statuses.shift() ?? 200;
    if (status !== 200) return route.fulfill({ status, contentType: 'application/json', body: '{"detail":"route failed"}' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(trip(body.points)) });
  });
  await page.route(`**/api/trips/planned/${TRIP_ID}/`, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(trip([])) });
  });
  return { posts, puts };
}

async function askAndWaitPlan(page: Page, question = QUESTION): Promise<void> {
  await send(page, question);
  await expect(page.getByTestId('assistant-plan')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS });
}

async function openPlanner(page: Page): Promise<void> {
  await page.getByTestId('assistant-plan-open').click();
  await expectPlannerDraftUrl(page);
  await expect(page.getByTestId('trip-create-form')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS });
}

async function submitTripForm(page: Page): Promise<void> {
  await page.getByTestId('trip-create-consent').click();
  await expect(page.getByTestId('trip-create-consent')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('trip-create-submit')).toBeEnabled();
  await page.getByTestId('trip-create-submit').click();
}

const addDays = (isoDate: string, days: number): string => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const seedDraft = async (page: Page, draft: Record<string, unknown> | string): Promise<void> => {
  await page.addInitScript(({ key, value }) => {
    // Один раз за вкладку: удалённый приложением черновик не должен появиться снова при навигации.
    if (window.sessionStorage.getItem('e2e-draft-seeded')) return;
    window.sessionStorage.setItem('e2e-draft-seeded', '1');
    window.localStorage.setItem(key, value);
  }, { key: DRAFT_KEY, value: typeof draft === 'string' ? draft : JSON.stringify(draft) });
};

const draftOf = (overrides: Record<string, unknown> = {}) => ({
  id: 'e2edraft01',
  title: 'Чужой план по Кракову',
  description: 'День 1: «Чужой материал»',
  days: 2,
  points: [{ type: 'travel', sourceId: 568, title: 'Краков: путеводитель по местам', lat: 50.061, lng: 19.937, day: 1, note: 'https://metravel.by/travels/e2e-568' }],
  createdAt: Date.now(),
  owner: null,
  ...overrides,
});

test.describe('Assistant plan: days, planner hand-off, failures (#3298)', () => {
  for (const width of WIDTHS) {
    test(`plan block ${width}px: day labels, hours, cards, no horizontal scroll, touch targets`, async ({ page }) => {
      await mockPlan(page);
      await openAssistant(page, sizeOf(width));
      await askAndWaitPlan(page);

      // Подписи дней и сумма часов дня: первый день 4 + 2, второй 4.
      await expect(page.getByTestId('assistant-plan-day-1')).toContainText('День 1');
      await expect(page.getByTestId('assistant-plan-day-1')).toContainText('6');
      await expect(page.getByTestId('assistant-plan-day-2')).toContainText('День 2');
      await expect(page.getByTestId('assistant-plan-day-2')).toContainText('4');
      // Время на материал — метка на карточке; у каждой карточки есть координаты, значит есть «На карте».
      const first = page.getByTestId('assistant-plan-day-1').getByTestId('assistant-source-card-travel-568');
      await expect(first.getByTestId('ai-pick-card-marker')).toContainText('4');
      await expect(page.getByTestId('assistant-plan-day-1').getByTestId('assistant-source-card-quest-246').getByTestId('ai-pick-card-marker')).toContainText('2');
      await expect(page.getByTestId('assistant-plan-day-1').getByTestId('ai-pick-card-marker')).toHaveCount(2);
      await expect(page.getByTestId('assistant-plan-day-2').getByTestId('ai-pick-card-marker')).toHaveCount(1);
      for (const id of ['assistant-source-map-travel-568', 'assistant-source-map-quest-246', 'assistant-source-map-travel-636']) {
        await expect(page.getByTestId(id)).toBeVisible();
      }
      expect(await noHorizontalScroll(page)).toBe(true);
      for (const id of ['assistant-plan-open', 'assistant-source-map-travel-568', 'assistant-source-plan-quest-246', 'assistant-source-map-quest-246', 'assistant-source-map-travel-636']) {
        const box = await page.getByTestId(id).boundingBox();
        expect(box?.height ?? 0, id).toBeGreaterThanOrEqual(44);
        expect(box?.width ?? 0, id).toBeGreaterThanOrEqual(44);
      }
      await expect(page.getByTestId('assistant-plan-open')).toHaveAttribute('aria-label', ruAssist['ask.planOpen']);
      await expect(page.getByTestId('assistant-plan-open')).toBeEnabled();

      await page.getByTestId('assistant-plan').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOTS}/plan-${width}-light.png` });
      if (width === 390) {
        await page.emulateMedia({ colorScheme: 'dark' });
        await page.evaluate(() => window.localStorage.setItem('theme', 'dark'));
        await page.reload({ waitUntil: 'domcontentloaded' });
        await waitForLive(page);
        await askAndWaitPlan(page);
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
        await page.screenshot({ path: `${SHOTS}/plan-${width}-dark.png` });
      }
    });

    test(`signed in ${width}px: open in planner → prefilled form → create trip + route by days, draft removed`, async ({ page }) => {
      await signIn(page);
      await mockPlan(page);
      const { posts, puts } = await mockTrips(page);
      await openAssistant(page, sizeOf(width));
      await askAndWaitPlan(page);
      await openPlanner(page);

      const draftId = new URL(page.url()).searchParams.get('draft')!;
      expect(JSON.parse((await readDraft(page))!)).toMatchObject({ id: draftId, owner: USER_ID, days: 2 });
      await expect(page.getByTestId('trip-create-title')).toHaveValue(QUESTION);
      const description = page.getByTestId('trip-create-description');
      await expect(description).toHaveValue(/День 1: «Краков: путеводитель по местам»[\s\S]*День 2: «Что посмотреть вокруг Кракова»/);
      // Два дня — дата окончания на день позже старта.
      const start = await page.getByTestId('trip-create-start-date').inputValue();
      await expect(page.getByTestId('trip-create-end-date')).toHaveValue(addDays(start, 1));
      await expect(page.getByTestId('trip-create-route-draft')).toHaveText('В маршрут поездки встанут 3 точки');
      expect(await noHorizontalScroll(page)).toBe(true);
      await page.getByTestId('trip-create-start-point-name').fill(START_POINT.name);
      await page.getByTestId('trip-create-start-lat').fill(START_POINT.lat);
      await page.getByTestId('trip-create-start-lng').fill(START_POINT.lng);
      await page.screenshot({ path: `${SHOTS}/trip-form-${width}.png`, fullPage: true });

      await submitTripForm(page);
      await expect(page).toHaveURL(new RegExp(`/trips/plan/${TRIP_ID}$`), { timeout: SCREEN_TIMEOUT_MS });

      expect(posts).toHaveLength(1);
      expect(posts[0]).toMatchObject({ title: QUESTION, start_point_name: START_POINT.name, end_date: expect.any(String) });
      expect(String(posts[0].description)).toContain('День 2');
      expect(puts).toHaveLength(1);
      // Стартовая точка формы — первая, дальше точки плана в порядке дней с номером дня.
      expect(puts[0].points.map((point) => [point.title, point.day_number])).toEqual([
        [START_POINT.name, null],
        ['Краков: путеводитель по местам', 1],
        ['Квест по Кракову: чёрные дамы', 1],
        ['Что посмотреть вокруг Кракова', 2],
      ]);
      expect(puts[0].points[1]).toMatchObject({ place_id: 568, lat: 50.061, lng: 19.937 });
      expect(puts[0].points[2]).toMatchObject({ place_id: null });
      expect(await readDraft(page)).toBeNull();
    });
  }

  for (const width of WIDTHS) {
    test(`route save fails ${width}px: retry and skip are offered, no second trip, retry succeeds → trip opens, draft removed`, async ({ page }) => {
      await signIn(page);
      await mockPlan(page);
      const { posts, puts } = await mockTrips(page, { putStatuses: [500, 500, 500, 500] });
      await openAssistant(page, sizeOf(width));
      await askAndWaitPlan(page);
      await openPlanner(page);
      await submitTripForm(page);

      await expect(page.getByTestId('trip-create-route-draft-failed')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS });
      await expect(page.getByTestId('trip-create-route-draft-failed')).toContainText(ruTrips['tripCreate.routeDraftFailed']);
      await expect(page.getByTestId('trip-create-route-draft-retry')).toBeVisible();
      await expect(page.getByTestId('trip-create-route-draft-skip')).toBeVisible();
      await expect(page.getByTestId('trip-create-submit')).toBeDisabled();
      expect(await noHorizontalScroll(page)).toBe(true);
      expect(posts).toHaveLength(1);
      expect(await readDraft(page)).not.toBeNull();
      await expect(page).toHaveURL(/\/trips\/plan\/create/);

      // Следующий PUT проходит: повтор не создаёт вторую поездку и открывает созданную.
      const failedPuts = puts.length;
      await page.unroute(`**/api/trips/planned/${TRIP_ID}/route/`);
      await page.route(`**/api/trips/planned/${TRIP_ID}/route/`, async (route) => {
        if (route.request().method() !== 'PUT') return route.fallback();
        const body = route.request().postDataJSON() as { points: unknown[] };
        puts.push(body as { points: Array<Record<string, unknown>> });
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: TRIP_ID, title: 'Краков', status: 'planned', owner: { id: Number(USER_ID), username: 'E2E', avatar: null }, participants: [], route: { points: [] }, is_public: true, max_participants: 4 }) });
      });
      await page.getByTestId('trip-create-route-draft-retry').click();
      await expect(page).toHaveURL(new RegExp(`/trips/plan/${TRIP_ID}$`), { timeout: SCREEN_TIMEOUT_MS });
      expect(posts).toHaveLength(1);
      expect(puts.length).toBe(failedPuts + 1);
      expect(puts[puts.length - 1].points).toHaveLength(3);
      expect(await readDraft(page)).toBeNull();
    });

    test(`route save fails ${width}px: «open trip without points» opens the trip and keeps the draft`, async ({ page }) => {
      await signIn(page);
      await mockPlan(page);
      const { posts } = await mockTrips(page, { putStatuses: [500, 500, 500, 500] });
      await openAssistant(page, sizeOf(width));
      await askAndWaitPlan(page);
      await openPlanner(page);
      await submitTripForm(page);
      await expect(page.getByTestId('trip-create-route-draft-skip')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS });
      await page.getByTestId('trip-create-route-draft-skip').click();
      await expect(page).toHaveURL(new RegExp(`/trips/plan/${TRIP_ID}$`), { timeout: SCREEN_TIMEOUT_MS });
      expect(posts).toHaveLength(1);
      // Точки не сохранены — черновик остаётся до срока, посетитель не теряет план.
      expect(await readDraft(page)).not.toBeNull();
    });
  }

  for (const width of WIDTHS) {
    test(`guest ${width}px: «open in planner» → sign-in with return to the same draft address, points intact`, async ({ page }) => {
      await mockPlan(page);
      await mockTrips(page);
      await openAssistant(page, sizeOf(width));
      await askAndWaitPlan(page);
      await page.getByTestId('assistant-plan-open').click();

      await expect(page).toHaveURL(/\/(login|registration)\?/, { timeout: SCREEN_TIMEOUT_MS });
      const saved = JSON.parse((await readDraft(page))!) as { id: string; owner: string | null; points: unknown[] };
      expect(saved.owner).toBeNull();
      expect(saved.points).toHaveLength(3);
      const redirect = new URL(page.url()).searchParams.get('redirect');
      expect(plannerDraftAddress(redirect!)).toEqual(plannerDraftAddressOf(saved.id));
      // В адресе входа нет ни вопроса, ни точек.
      expect(decodeURIComponent(page.url())).not.toMatch(/Краков|50\.0/);

      // Вход (подменённая сессия) и возврат по сохранённому адресу: тот же черновик, три точки.
      await signIn(page);
      await page.goto(redirect!, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('trip-create-form')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS });
      await expect(page.getByTestId('trip-create-title')).toHaveValue(QUESTION);
      await expect(page.getByTestId('trip-create-route-draft')).toHaveText('В маршрут поездки встанут 3 точки');
    });
  }

  test('a draft of another account is not accepted: empty form, no crash, the foreign draft is removed', async ({ page }) => {
    await signIn(page);
    await seedDraft(page, draftOf({ owner: '777' }));
    await page.setViewportSize(sizeOf(1280));
    await preacceptCookies(page);
    await page.goto('/trips/plan/create?source=plan&draft=e2edraft01', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('trip-create-form')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS });
    await expect(page.getByTestId('trip-create-title')).toHaveValue('');
    await expect(page.getByTestId('trip-create-description')).toHaveValue('');
    await expect(page.getByTestId('trip-create-route-draft')).toHaveCount(0);
    await expect.poll(() => readDraft(page)).toBeNull();
  });

  test('an expired draft: empty form without the plan, the record is removed', async ({ page }) => {
    await signIn(page);
    await seedDraft(page, draftOf({ owner: USER_ID, createdAt: Date.now() - 25 * 60 * 60 * 1000 }));
    await page.setViewportSize(sizeOf(390));
    await preacceptCookies(page);
    await page.goto('/trips/plan/create?source=plan&draft=e2edraft01', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('trip-create-form')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS });
    await expect(page.getByTestId('trip-create-title')).toHaveValue('');
    await expect(page.getByTestId('trip-create-route-draft')).toHaveCount(0);
    await expect.poll(() => readDraft(page)).toBeNull();
  });

  test('a corrupted draft record and an unknown draft id: empty form without a crash', async ({ page }) => {
    await signIn(page);
    await seedDraft(page, '{not json');
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize(sizeOf(1280));
    await preacceptCookies(page);
    await page.goto('/trips/plan/create?source=plan&draft=e2edraft01', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('trip-create-form')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS });
    await expect(page.getByTestId('trip-create-title')).toHaveValue('');
    await expect(page.getByTestId('trip-create-route-draft')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  for (const width of WIDTHS) {
    test(`quest from an ordinary answer ${width}px: «Plan a trip» → form with one point and its link note`, async ({ page }) => {
      await signIn(page);
      const { puts } = await mockTrips(page);
      const quest = { type: 'quest', score: 0.8, snippet: 'Загадки Старого города.', source_id: '246', title: 'Квест по Кракову: чёрные дамы', url: 'https://metravel.by/quests/krakow/e2e-246', path: '/quests/krakow/e2e-246', group: 'match', cover: null, city: 'Краков', country: 'Польша', lat: 50.054, lng: 19.935 };
      await mockAskEcho(page, 'Попробуйте [квест по Кракову: чёрные дамы](https://metravel.by/quests/krakow/e2e-246).', [quest]);
      await mockPlan(page);
      await openAssistant(page, sizeOf(width));
      await send(page, 'Какие квесты есть в Кракове?');
      await expect(page.getByTestId('assistant-turn-done')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS });
      await page.getByTestId('assistant-source-plan-quest-246').click();

      await expect(page).toHaveURL(/\/trips\/plan\/create\?.*source=quest.*sourcePoint=50\.054(?:0+)?%2C19\.935/, { timeout: SCREEN_TIMEOUT_MS });
      await expect(page.getByTestId('trip-create-form')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS });
      await expect(page.getByTestId('trip-create-route-draft')).toHaveText('В маршрут поездки встанет 1 точка');
      await submitTripForm(page);
      await expect(page).toHaveURL(new RegExp(`/trips/plan/${TRIP_ID}$`), { timeout: SCREEN_TIMEOUT_MS });
      expect(puts).toHaveLength(1);
      expect(puts[0].points).toHaveLength(1);
      expect(puts[0].points[0]).toMatchObject({ title: 'Квест по Кракову: чёрные дамы', lat: 50.054, lng: 19.935, place_id: null, description: 'https://metravel.by/quests/krakow/e2e-246' });
    });
  }

  test('a javascript: sourceTravelUrl never becomes the point note (#3416 item 1)', async ({ page }) => {
    await signIn(page);
    const { puts } = await mockTrips(page);
    await page.setViewportSize(sizeOf(1280));
    await preacceptCookies(page);
    const query = new URLSearchParams({ source: 'quest', sourceTravelTitle: 'Квест по Кракову', sourceTravelUrl: 'javascript:alert(1)', sourcePoint: '50.054,19.935' });
    await page.goto(`/trips/plan/create?${query.toString()}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('trip-create-route-draft')).toHaveText('В маршрут поездки встанет 1 точка', { timeout: SCREEN_TIMEOUT_MS });
    // Известное расхождение (находка карточки): `buildTripPlanPrefill` кладёт непроверенный `sourceTravelUrl`
    // в описание формы как есть, схему http(s) там никто не проверяет. Здесь закреплена только точка маршрута.
    await submitTripForm(page);
    await expect(page).toHaveURL(new RegExp(`/trips/plan/${TRIP_ID}$`), { timeout: SCREEN_TIMEOUT_MS });
    expect(puts).toHaveLength(1);
    expect(puts[0].points).toHaveLength(1);
    expect(puts[0].points[0]).toMatchObject({ title: 'Квест по Кракову', description: '' });
  });

  for (const [status, body] of [[422, '{"error":"invalid_plan"}'], [503, '{"error":"busy","retry_after_sec":5}']] as const) {
    test(`/ai/plan ${status}: the same question is answered by /ai/ask exactly once, no error on screen`, async ({ page }) => {
      let planCalls = 0;
      await page.route('**/ai/plan', async (route) => {
        planCalls += 1;
        await route.fulfill({ status, contentType: 'application/json', body });
      });
      const askBodies = await mockAskEcho(page);
      await openAssistant(page);
      await send(page, QUESTION);
      await expect(page.getByTestId('assistant-turn-done')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS });
      await expect(page.getByTestId('assistant-answer-text')).toContainText('Загляните в каталог маршрутов.');
      await expect(page.getByTestId('assistant-plan')).toHaveCount(0);
      await expect(page.getByTestId('assistant-turn-unavailable')).toHaveCount(0);
      expect(planCalls).toBe(1);
      expect(askBodies.map((request) => request.q)).toEqual([QUESTION]);
    });
  }

  test('a question without the plan intent never calls /ai/plan', async ({ page }) => {
    let planCalls = 0;
    await page.route('**/ai/plan', async (route) => {
      planCalls += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PLAN) });
    });
    const askBodies = await mockAskEcho(page, 'В Минске есть несколько квестов.');
    await openAssistant(page);
    await send(page, 'Какие квесты есть в Минске?');
    await expect(page.getByTestId('assistant-turn-done')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS });
    await expect(page.getByTestId('assistant-plan')).toHaveCount(0);
    expect(askBodies.map((request) => request.q)).toEqual(['Какие квесты есть в Минске?']);
    expect(planCalls).toBe(0);
  });
});
