import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { ensureAuthedStorageFallback, mockFakeAuthApis } from './helpers/auth';
import { preacceptCookies } from './helpers/navigation';
import { runtimeViewport } from './helpers/runtimeViewport';
import { aiAssistStaticResources as ruAssist } from '@/i18n/locales/ru/static/ai_assist_static';
import { aiAssistStaticResources as enAssist } from '@/i18n/locales/en/static/ai_assist_static';

/**
 * #2884: экран `/assistant` ходит в серверный `POST /ai/ask` службы metravel-assist.
 * Служба мокается целиком (SSE `sources → text* → done` и JSON-отказы), прямых
 * запросов к `llama-server` быть не должно; бандл собран с
 * `EXPO_PUBLIC_AI_ASSISTANT=1` (.env), иначе экрана нет и тест пропускается явно.
 */
const SCREEN_TIMEOUT_MS = 30_000;
/** Desktop 1280 по умолчанию; `E2E_RUNTIME_MOBILE_ONLY=1` — тот же набор на mobile 390. */
const VIEWPORT = runtimeViewport({ width: 1280, height: 720 });

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

/** Считает запросы к модели напрямую: их быть не должно — экран ходит только в службу `/ai/ask` (#3297). */
async function trackModelRequests(page: Page): Promise<string[]> {
  const direct: string[] = [];
  await page.route('**/v1/chat/completions', async (route) => {
    direct.push(route.request().url());
    await route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"direct model call"}' });
  });
  return direct;
}

/**
 * Экран виден из статического HTML раньше скриптов. Чанк экрана стоит в тегах <script> роута,
 * и страница гидрируется на месте (#3370). Поле «живое», когда экран смонтирован: `data-live` он
 * ставит сам после монтирования, в статике его нет. Сценарии живого ввода ждут именно этого;
 * ввод ДО гидрации (#3346) и ВО ВРЕМЯ гидрации (#3370) проверяют отдельные сценарии.
 */
async function waitForLiveInput(page: Page): Promise<void> {
  await expect(
    page.locator('[data-testid="assistant-screen"][data-live="true"] [data-testid="assistant-input"]'),
  ).toBeVisible({ timeout: SCREEN_TIMEOUT_MS });
}

async function openAssistant(page: Page, path = '/assistant', viewport = VIEWPORT): Promise<void> {
  await page.setViewportSize(viewport);
  await preacceptCookies(page);
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  const screen = page.getByTestId('assistant-screen');
  test.skip(!(await waitForScreen(screen)), 'бандл собран без EXPO_PUBLIC_AI_ASSISTANT');
  await waitForLiveInput(page);
}

async function send(page: Page, question: string): Promise<void> {
  await page.getByTestId('assistant-input').fill(question);
  await page.getByTestId('assistant-send').click();
}

/** Придерживает скрипты приложения: страница остаётся статическим HTML, пока тест их не отпустит. */
async function holdAppScripts(page: Page): Promise<() => void> {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/_expo/static/js/**', async (route) => {
    await gate;
    await route.continue();
  });
  return release;
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

  // #3296: оценка ответа — идентификатор хода из `done`, голос и причина уходят в `POST /ai/feedback`.
  test('feedback: «Not helpful» with a reason — one vote per turn, two POST /ai/feedback requests', async ({ page }) => {
    const votes: Array<{ turn_id?: string; vote?: string; reason?: string }> = [];
    await page.route('**/ai/ask', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream; charset=utf-8',
        body: sse(
          ['sources', { sources, degraded: false, remaining: 19 }],
          ['text', { text: answer }],
          ['done', { status: 'done', removed_links: 0, remaining: 19, turn_id: '0b6f3c1e-8a55-4f6e-9a3e-2f1d6c7b8a90' }],
        ),
      });
    });
    await page.route('**/ai/feedback', async (route) => {
      votes.push(route.request().postDataJSON());
      await route.fulfill({ status: 204, body: '' });
    });

    await openAssistant(page);
    await expect(page.getByTestId('assistant-storage-notice')).toBeVisible();
    await send(page, 'Какие квесты есть в Минске?');
    await expect(page.getByTestId('assistant-turn-done')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS });

    const up = page.getByTestId('assistant-feedback-up');
    const down = page.getByTestId('assistant-feedback-down');
    await expect(up).toBeVisible();
    // Цель нажатия — не меньше 44 px по высоте на любой ширине.
    for (const button of [up, down]) expect((await button.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);

    await down.click();
    await expect(page.getByTestId('assistant-feedback-reason-place')).toBeVisible();
    await expect(up).toHaveCount(0);
    await page.getByTestId('assistant-feedback-reason-place').click();
    await expect(page.getByTestId('assistant-feedback-done')).toBeVisible();
    await expect(page.getByTestId('assistant-feedback-reason-place')).toHaveCount(0);
    await expect.poll(() => votes.length).toBe(2);
    expect(votes).toEqual([
      { turn_id: '0b6f3c1e-8a55-4f6e-9a3e-2f1d6c7b8a90', vote: 'down' },
      { turn_id: '0b6f3c1e-8a55-4f6e-9a3e-2f1d6c7b8a90', vote: 'down', reason: 'place' },
    ]);
    // Оценка не ломает вёрстку: горизонтальной прокрутки страницы нет.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });

  // #3295: под ответом — карточки названных материалов с обложкой и действиями; остальное под «Ещё материалы».
  test('answer actions: cards of the named materials with «On the map», the rest under «More materials»', async ({ page }) => {
    const cards = [
      { ...sources[0], group: 'match', cover: null, city: 'Минск', country: 'Беларусь', lat: 53.9045, lng: 27.5615 },
      { ...sources[1], group: 'match', cover: null, city: null, country: 'Беларусь', lat: null, lng: null },
      { ...sources[1], source_id: '900', title: 'Музеи Минска за день', url: 'https://metravel.by/travels/minsk-museums-e2e', path: '/travels/minsk-museums-e2e', group: 'nearby', cover: null, city: null, country: 'Беларусь', lat: null, lng: null },
    ];
    // Ответ называет ссылкой оба материала: квест и статью.
    const named = `${answer} Подробнее — [${cards[1].title}](${cards[1].url}).`;
    await page.route('**/ai/ask', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream; charset=utf-8',
        body: sse(['sources', { sources: cards, degraded: false, remaining: 19 }], ['text', { text: named }], ['done', { status: 'done', removed_links: 0, remaining: 19 }]),
      });
    });

    await openAssistant(page);
    await send(page, 'Какие квесты есть в Минске?');
    await expect(page.getByTestId('assistant-turn-done')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS });

    // Обе карточки названы в ответе: обложка, отметка и действия; неназванный материал свёрнут.
    await expect(page.getByTestId('assistant-source-card-quest-7')).toBeVisible();
    await expect(page.getByTestId('assistant-source-card-travel-816')).toBeVisible();
    await expect(page.getByTestId('ai-pick-card-marker')).toHaveCount(2);
    await expect(page.getByTestId('assistant-source-plan-quest-7')).toBeVisible();
    await expect(page.getByTestId('assistant-source-travel-900')).toHaveCount(0);
    // У карточки без координат «На карте» нет.
    await expect(page.getByTestId('assistant-source-map-travel-816')).toHaveCount(0);
    // Цели нажатия не меньше 44 px; страница вбок не едет ни на 390, ни на 1280.
    for (const id of ['assistant-source-plan-quest-7', 'assistant-source-map-quest-7', 'assistant-sources-more']) {
      expect((await page.getByTestId(id).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

    await page.getByTestId('assistant-sources-more').click();
    await expect(page.getByTestId('assistant-source-travel-900')).toBeVisible();

    // «На карте» — карта с центром в месте материала.
    await page.getByTestId('assistant-source-map-quest-7').click();
    await expect(page).toHaveURL(/\/map\?.*lat=53\.9045.*lng=27\.5615/);
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

    await openAssistant(page, '/assistant?source=travel:816');
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

  // #3346: статический HTML показывает поле раньше скриптов. Событий ввода до гидрации React
  // не воспроизводит — набранное обязано стать черновиком живого экрана и уйти одним запросом.
  test('a question typed into the static page before hydration survives it and is sent', async ({ page }) => {
    const direct = await trackModelRequests(page);
    const asks: Array<{ q?: string }> = [];
    await page.route('**/ai/ask', async (route) => {
      asks.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream; charset=utf-8',
        body: sse(
          ['sources', { sources, degraded: false, remaining: 19 }],
          ['text', { text: answer }],
          ['done', { status: 'done', removed_links: 0, usage: { prompt_tokens: 900, completion_tokens: 60, ttft_ms: 400, tokens_per_s: 40 }, remaining: 19 }],
        ),
      });
    });
    const question = 'Куда поехать на выходные из Минска?';
    const releaseScripts = await holdAppScripts(page);

    await page.setViewportSize(VIEWPORT);
    await preacceptCookies(page);
    // `commit`: DOMContentLoaded ждёт defer-скрипты, а они придержаны.
    await page.goto('/assistant', { waitUntil: 'commit' });
    test.skip(!(await waitForScreen(page.getByTestId('assistant-screen'))), 'бандл собран без EXPO_PUBLIC_AI_ASSISTANT');
    const input = page.getByTestId('assistant-input');
    const sendButton = page.getByTestId('assistant-send');
    await input.fill(question);
    // Скриптов ещё нет: кнопка из статики выключена, ввод никто не слушает.
    await expect(sendButton).toBeDisabled();

    releaseScripts();
    await expect(sendButton).toBeEnabled({ timeout: SCREEN_TIMEOUT_MS });
    await expect(input).toHaveValue(question);

    await sendButton.click();
    await expect(page.getByTestId('assistant-turn-done')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS });
    expect(asks).toHaveLength(1);
    expect(asks[0]).toMatchObject({ q: question });
    await expect(input).toHaveValue('');
    expect(direct).toEqual([]);
  });

  // #3370: чанк экрана стоит в тегах <script> HTML роута, поэтому страница оживает на месте:
  // поле вопроса остаётся тем же узлом, запасной вид роута не показывается, фокус и символы,
  // набранные во время гидрации, не теряются. Телефон и desktop — оба брейкпоинта карточки.
  for (const viewport of [{ width: 390, height: 844 }, VIEWPORT]) {
    test(`typing character by character while the page hydrates loses nothing and keeps focus (${viewport.width}px)`, async ({ page }) => {
      const direct = await trackModelRequests(page);
      const question = 'Куда поехать на выходные из Минска?';
      const typedBeforeScripts = question.slice(0, 8);
      const releaseScripts = await holdAppScripts(page);

      await page.setViewportSize(viewport);
      await preacceptCookies(page);
      // `commit`: DOMContentLoaded ждёт defer-скрипты, а они придержаны.
      await page.goto('/assistant', { waitUntil: 'commit' });
      test.skip(!(await waitForScreen(page.getByTestId('assistant-screen'))), 'бандл собран без EXPO_PUBLIC_AI_ASSISTANT');

      // Сборочный уровень: чанк экрана — один из собственных тегов <script> страницы, раньше входного файла.
      const scripts = await page
        .locator('script[src*="/_expo/static/js/"]')
        .evaluateAll((nodes) => nodes.map((node) => (node as HTMLScriptElement).src.split('/').pop() ?? ''));
      const screenChunk = scripts.findIndex((name) => /^AssistantScreen-[0-9a-f]+\.js$/.test(name));
      const entryChunk = scripts.findIndex((name) => /^entry-[0-9a-f]+\.js$/.test(name));
      expect(screenChunk).toBeGreaterThanOrEqual(0);
      expect(screenChunk).toBeLessThan(entryChunk);

      const input = page.getByTestId('assistant-input');
      await input.click();
      // Метка на узле статики и наблюдатель: экран не должен исчезать из документа ни на кадр.
      await page.evaluate(() => {
        const state = window as unknown as { __assistantStaticInput?: Element | null; __assistantScreenReplaced?: boolean };
        const screen = document.querySelector('[data-testid="assistant-screen"]');
        state.__assistantStaticInput = document.querySelector('[data-testid="assistant-input"]');
        state.__assistantScreenReplaced = false;
        new MutationObserver(() => {
          if (!document.contains(screen)) state.__assistantScreenReplaced = true;
        }).observe(document.body, { childList: true, subtree: true });
      });

      await page.keyboard.type(typedBeforeScripts, { delay: 30 });
      releaseScripts();
      // Посетитель продолжает печатать, пока скрипты грузятся и страница гидрируется.
      await page.keyboard.type(question.slice(typedBeforeScripts.length), { delay: 30 });

      await waitForLiveInput(page);
      await expect(input).toHaveValue(question);
      await expect(input).toBeFocused();
      const outcome = await page.evaluate(() => {
        const state = window as unknown as { __assistantStaticInput?: Element | null; __assistantScreenReplaced?: boolean };
        return {
          sameNode: state.__assistantStaticInput === document.querySelector('[data-testid="assistant-input"]'),
          replaced: state.__assistantScreenReplaced,
        };
      });
      expect(outcome).toEqual({ sameNode: true, replaced: false });
      await expect(page.getByTestId('assistant-send')).toBeEnabled();
      expect(direct).toEqual([]);
    });
  }

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

  // #3354: строка «Ассистент учитывает ваши статьи и сохранённое» — только вошедшему и только
  // если служба в `done` подтвердила личный контекст (`profile: true`). Вход подменён
  // фейковой сессией (cookie-проба), служба замокана; настоящих токенов и прода нет.
  test.describe('profile notice (#3354)', () => {
    const NOTICE_DIR = '.codex-temp/3354/e2e';
    const widths = [390, 1280] as const;

    const mockAsk = async (page: Page, done: Record<string, unknown>): Promise<void> => {
      await page.route('**/ai/ask', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream; charset=utf-8',
          body: sse(
            ['sources', { sources, degraded: false, remaining: 19 }],
            ['text', { text: answer }],
            ['done', { status: 'done', removed_links: 0, remaining: 19, ...done }],
          ),
        });
      });
    };
    const signIn = async (page: Page): Promise<void> => {
      await mockFakeAuthApis(page);
      await ensureAuthedStorageFallback(page, { userId: '3354', userName: 'E2E Profile User' });
    };
    const setLocale = async (page: Page, locale: string): Promise<void> => {
      await page.addInitScript((value) => {
        window.localStorage.setItem('@metravel/locale-preference:v1', JSON.stringify({ version: 1, mode: 'explicit', locale: value }));
      }, locale);
    };
    const askOnce = async (page: Page, width: number): Promise<void> => {
      await openAssistant(page, '/assistant', { width, height: width < 600 ? 844 : 720 });
      await send(page, 'Какие квесты есть в Минске?');
      await expect(page.getByTestId('assistant-turn-done')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS });
    };
    const noHorizontalScroll = (page: Page): Promise<boolean> =>
      page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

    for (const width of widths) {
      for (const scheme of ['light', 'dark'] as const) {
      test(`signed in + done.profile: notice with the locale text, no overflow, ${width}px ${scheme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.addInitScript((value) => window.localStorage.setItem('theme', value), scheme);
        await signIn(page);
        await mockAsk(page, { profile: true });
        await askOnce(page, width);

        const notice = page.getByTestId('assistant-profile-notice');
        await expect(notice).toBeVisible();
        await expect(notice).toHaveText(ruAssist['ask.profileNotice']);
        // Нет переполнения: строка в пределах окна, её содержимое не шире её самой, страница вбок не едет.
        const fit = await notice.evaluate((node) => {
          const box = node.getBoundingClientRect();
          return { inside: box.left >= 0 && box.right <= window.innerWidth + 1, clipped: node.scrollWidth > node.clientWidth + 1 };
        });
        expect(fit).toEqual({ inside: true, clipped: false });
        expect(await noHorizontalScroll(page)).toBe(true);
        // Строка стоит в колонке поля вопроса, а не у края окна (на 1280 колонка уже окна).
        const column = await page.evaluate(() => {
          const left = (testId: string) => document.querySelector(`[data-testid="${testId}"]`)!.getBoundingClientRect().left;
          return { notice: left('assistant-profile-notice'), composer: left('assistant-composer') };
        });
        expect(Math.abs(column.notice - column.composer)).toBeLessThanOrEqual(1);
        // Ответ остался на месте: строка не заменила и не сломала ход.
        await expect(page.getByTestId('assistant-answer-text')).toContainText('квеста по Минску для семьи');

        await page.screenshot({ path: `${NOTICE_DIR}/profile-notice-${width}-${scheme}.png`, fullPage: false });
      });
      }
    }

    test('signed in + done without profile: no notice', async ({ page }) => {
      await signIn(page);
      await mockAsk(page, {});
      await askOnce(page, 1280);
      await expect(page.getByTestId('assistant-composer-meta')).toContainText('19');
      await expect(page.getByTestId('assistant-profile-notice')).toHaveCount(0);
    });

    // Экран не обещает гостю личный контекст, даже если ответ службы несёт `profile: true`:
    // компонент гейтит строку по `authStore.isAuthenticated` (AssistantProfileNotice).
    test('guest + done.profile: no notice', async ({ page }) => {
      await mockAsk(page, { profile: true });
      await askOnce(page, 1280);
      await expect(page.getByTestId('assistant-composer-meta')).toContainText('19');
      await expect(page.getByTestId('assistant-profile-notice')).toHaveCount(0);
    });

    test('signed in + done.profile in English: notice text comes from the en resource', async ({ page }) => {
      await signIn(page);
      await setLocale(page, 'en');
      await mockAsk(page, { profile: true });
      await askOnce(page, 390);
      await expect(page.getByTestId('assistant-profile-notice')).toHaveText(enAssist['ask.profileNotice']);
      expect(enAssist['ask.profileNotice']).not.toBe(ruAssist['ask.profileNotice']);
      expect(await noHorizontalScroll(page)).toBe(true);
    });
  });
});
