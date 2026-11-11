import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { preacceptCookies } from './helpers/navigation';

/**
 * #2884: экран `/assistant` ходит в серверный `POST /ai/ask` службы metravel-assist.
 * Служба мокается целиком (SSE `sources → text* → done` и JSON-отказы), прямых
 * запросов к `llama-server` быть не должно; бандл собран с
 * `EXPO_PUBLIC_AI_ASSISTANT=1` (.env), иначе экрана нет и тест пропускается явно.
 */
const SCREEN_TIMEOUT_MS = 30_000;

/** Экран живёт в lazy-чанке за фича-флагом: ждём его появления, а не проверяем мгновенно. */
const waitForScreen = (screen: Locator): Promise<boolean> =>
  screen.waitFor({ state: 'visible', timeout: SCREEN_TIMEOUT_MS }).then(() => true).catch(() => false);

const sse = (...events: Array<[string, Record<string, unknown>]>): string =>
  events.map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`).join('');

const sources = [
  {
    type: 'quest',
    source_id: '7',
    title: 'Квест по Минску для семьи',
    url: 'https://metravel.by/quests/minsk/minsk-family',
    path: '/quests/minsk/minsk-family',
    snippet: 'Загадки Верхнего города на два часа прогулки.',
    score: 0.8,
  },
  {
    type: 'travel',
    source_id: '816',
    title: 'Выходные в Минске с детьми',
    url: 'https://metravel.by/travels/minsk-e2e',
    path: '/travels/minsk-e2e',
    snippet: 'Парки, музеи и короткие маршруты.',
    score: 0.7,
  },
];

const answer = 'Начните с [квеста по Минску для семьи](https://metravel.by/quests/minsk/minsk-family), а на второй день — выходные с детьми.';

/** Считает запросы к модели напрямую: при провайдере `ask` их быть не должно. */
async function trackModelRequests(page: Page): Promise<string[]> {
  const direct: string[] = [];
  await page.route('**/v1/chat/completions', async (route) => {
    direct.push(route.request().url());
    await route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"direct model call"}' });
  });
  return direct;
}

async function openAssistant(page: Page): Promise<void> {
  await preacceptCookies(page);
  await page.goto('/assistant', { waitUntil: 'domcontentloaded' });
  const screen = page.getByTestId('assistant-screen');
  test.skip(!(await waitForScreen(screen)), 'бандл собран без EXPO_PUBLIC_AI_ASSISTANT');
  await expect(page.getByTestId('assistant-input')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS });
}

async function send(page: Page, question: string): Promise<void> {
  const input = page.getByTestId('assistant-input');
  const sendButton = page.getByTestId('assistant-send');
  // Экран виден из статики до гидрации: значение, введённое раньше, React стирает.
  // Повторяем ввод, пока кнопка не станет активной (draft попал в state).
  await expect(async () => {
    await input.fill(question);
    await expect(sendButton).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: SCREEN_TIMEOUT_MS });
  await sendButton.click();
}

test.describe('Assistant via server /ai/ask (#2884)', () => {
  test('one POST /ai/ask per question: streamed answer, sources from the service, remaining from the server', async ({ page }) => {
    const direct = await trackModelRequests(page);
    const asks: Array<{ q?: string; locale?: string; history?: unknown[] }> = [];
    await page.route('**/ai/ask', async (route) => {
      asks.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream; charset=utf-8',
        body: sse(
          ['sources', { sources, degraded: false, remaining: 19 }],
          ['text', { text: 'Начните с ' }],
          ['text', { text: answer }],
          ['done', { status: 'done', removed_links: 0, usage: { prompt_tokens: 900, completion_tokens: 60, ttft_ms: 400, tokens_per_s: 40 }, remaining: 19 }],
        ),
      });
    });

    await openAssistant(page);
    await send(page, 'Какие квесты есть в Минске?');

    await expect(page.getByTestId('assistant-turn-done')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS });
    await expect(page.getByTestId('assistant-answer-text')).toContainText('квеста по Минску для семьи');
    await expect(page.getByTestId('assistant-source-quest-7')).toBeVisible();
    await expect(page.getByTestId('assistant-source-travel-816')).toBeVisible();
    await expect(page.getByTestId('assistant-composer-meta')).toContainText('19');
    expect(asks).toHaveLength(1);
    expect(asks[0]).toMatchObject({ q: 'Какие квесты есть в Минске?', history: [] });
    expect(typeof asks[0].locale).toBe('string');
    expect(direct).toEqual([]);

    // Уточнение уходит с историей завершённого ответа: опору подбора сервер берёт из неё.
    await send(page, 'А какой подойдёт детям?');
    await expect(page.getByTestId('assistant-turn-done')).toHaveCount(2, { timeout: SCREEN_TIMEOUT_MS });
    expect(asks).toHaveLength(2);
    expect(asks[1].history).toEqual([
      { role: 'user', text: 'Какие квесты есть в Минске?' },
      { role: 'assistant', text: answer },
    ]);
    expect(direct).toEqual([]);
  });

  // #3290: вопрос со страницы статьи — служба отдаёт карточку страницы и соседние материалы отдельной группой.
  test('page mode: the page card under «Sources», neighbours under «More on the topic», source in the request', async ({ page }) => {
    const direct = await trackModelRequests(page);
    const asks: Array<{ q?: string; source?: unknown }> = [];
    const pageCard = { ...sources[1], group: 'page', snippet: 'Беларусь, Минск. Дней: 2. Парки и музеи … короткие маршруты на выходные.' };
    const nearby = { ...sources[0], group: 'nearby' };
    await page.route('**/ai/ask', async (route) => {
      asks.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream; charset=utf-8',
        body: sse(
          ['sources', { sources: [pageCard, nearby], degraded: false, remaining: 18 }],
          ['text', { text: 'На странице [Выходные в Минске с детьми](https://metravel.by/travels/minsk-e2e) маршрут рассчитан на два дня.' }],
          ['done', { status: 'done', removed_links: 0, usage: { prompt_tokens: 800, completion_tokens: 40, ttft_ms: 400, tokens_per_s: 40 }, remaining: 18 }],
        ),
      });
    });

    await preacceptCookies(page);
    await page.goto('/assistant?source=travel:816', { waitUntil: 'domcontentloaded' });
    test.skip(!(await waitForScreen(page.getByTestId('assistant-screen'))), 'бандл собран без EXPO_PUBLIC_AI_ASSISTANT');
    await expect(page.getByTestId('assistant-input')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS });
    await send(page, 'Сколько дней нужно на этот маршрут?');

    await expect(page.getByTestId('assistant-turn-done')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS });
    await expect(page.getByTestId('assistant-answer-text')).toContainText('рассчитан на два дня');
    // Страница — в «Источниках», сосед — ниже, под своим заголовком группы.
    await expect(page.getByTestId('assistant-source-travel-816')).toBeVisible();
    const nearbyTitle = page.getByTestId('assistant-sources-nearby');
    await expect(nearbyTitle).toBeVisible();
    const neighbour = page.getByTestId('assistant-source-quest-7');
    await expect(neighbour).toBeVisible();
    const [titleBox, pageBox, neighbourBox] = await Promise.all([nearbyTitle.boundingBox(), page.getByTestId('assistant-source-travel-816').boundingBox(), neighbour.boundingBox()]);
    expect(pageBox!.y).toBeLessThan(titleBox!.y);
    expect(titleBox!.y).toBeLessThan(neighbourBox!.y);
    expect(asks).toHaveLength(1);
    expect(asks[0]).toMatchObject({ q: 'Сколько дней нужно на этот маршрут?', source: { type: 'travel', id: 816 } });
    expect(direct).toEqual([]);
  });

  test('service down → unavailable with retry; 429 offtopic_blocked → block notice and disabled composer', async ({ page }) => {
    const direct = await trackModelRequests(page);
    let mode: 'down' | 'blocked' = 'down';
    await page.route('**/ai/ask', async (route) => {
      if (mode === 'down') {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          headers: { 'Retry-After': '30' },
          body: JSON.stringify({ error: 'generator_unavailable', detail: 'model down', retry_after_sec: 30 }),
        });
        return;
      }
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        headers: { 'Retry-After': '3600' },
        body: JSON.stringify({ error: 'offtopic_blocked', detail: 'blocked', retry_after_sec: 3600, strikes: 3, strikes_to_block: 3 }),
      });
    });

    await openAssistant(page);
    await send(page, 'Что посмотреть в Несвиже?');
    await expect(page.getByTestId('assistant-turn-unavailable')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS });
    await expect(page.getByTestId('assistant-retry')).toBeVisible();
    // Лимит не списан: служба отказала до ответа, подписи счётчика на экране нет.
    await expect(page.getByTestId('assistant-composer-meta')).toHaveCount(0);

    mode = 'blocked';
    await page.getByTestId('assistant-retry').click();
    await expect(page.getByTestId('assistant-turn-off_topic')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS });
    await expect(page.getByTestId('assistant-offtopic')).toBeVisible();
    await expect(page.getByTestId('assistant-send')).toBeDisabled();
    expect(direct).toEqual([]);
  });
});
