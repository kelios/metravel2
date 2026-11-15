import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { ensureAuthedStorageFallback, mockFakeAuthApis } from './helpers/auth';
import { preacceptCookies } from './helpers/navigation';
import { runtimeViewport } from './helpers/runtimeViewport';
import { aiAssistStaticResources as ruAssist } from '@/i18n/locales/ru/static/ai_assist_static';

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

async function openAssistant(page: Page): Promise<void> {
  await page.setViewportSize(VIEWPORT);
  await preacceptCookies(page);
  await page.goto('/assistant', { waitUntil: 'domcontentloaded' });
  const screen = page.getByTestId('assistant-screen');
  test.skip(!(await waitForScreen(screen)), 'бандл собран без EXPO_PUBLIC_AI_ASSISTANT');
  await expect(page.locator('[data-testid="assistant-screen"][data-live="true"] [data-testid="assistant-input"]')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS });
}

async function send(page: Page, question: string): Promise<void> {
  await page.getByTestId('assistant-input').fill(question);
  await page.getByTestId('assistant-send').click();
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
    await expect(open).toHaveText(ruAssist['ask.planOpen']);
    expect((await open.boundingBox())!.height).toBeGreaterThanOrEqual(44);

    await open.click();
    await expect(page).toHaveURL(/\/trips\/plan\/create\?source=plan&draft=[a-z0-9]+$/, { timeout: SCREEN_TIMEOUT_MS });
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
