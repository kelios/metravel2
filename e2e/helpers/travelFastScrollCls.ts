import { test, expect, type Browser, type TestInfo } from '@playwright/test';
import { installReadOnlyTravelApi } from './readOnlyTravelApi';
import { hideRecommendationsBanner, seedNecessaryConsent } from './storage';

// #3419: статья с десятью GPX-файлами — профили высот приходят после показа
// секции карты и растят её блок на тысячи пикселей, когда читатель уже ниже.
// #3430: обычная статья с одним GPX и пустым «Рядом» (`/near/` даёт 0): каркас
// «Рядом» 338 px сменяется пустым состоянием 121 px у конца страницы.
// `routeBlockMinPx` — высота блока карты с пришедшими профилями: ниже неё прогон
// не прошёл поздний рост (без профилей блок 692 px на проде).
// #3436: обе статьи резервируют профили из данных статьи с первого кадра;
// сдвиги блока маршрута снова входят в бюджет и запретные источники.
// У 470 разгон 6000 px проходит блок до прихода GPX.
const ARTICLES = [
  { path: '/travels/tour-du-mont-blanc-vokrug-monblana-za-10-dney', id: 470, routeBlockMinPx: 2000 },
  { path: '/travels/tropa-vedm-v-gartse-kak-proiti-hexenstieg', id: 544, routeBlockMinPx: 900 },
] as const;
// Протокол воспроизведения с прода 14.11.2026: около 1800 px/с. При шаге раз в
// 450 мс хвост успевает разрешиться за экраном и сдвига нет.
const STEP_PX = 400;
const STEP_MS = 220;
// Хвост статьи читатель проходит с разгона; тело статьи (десятки тысяч px) на
// сдвиг не влияет — прогрев всех кадров его не убирал.
const RUN_UP_PX = 6000;
const SAMPLES = 3;
// Источники этого механизма: точки маршрута, въезжающие в экран, и профили высот,
// нарисованные поверх них до публикации высоты блока.
const ROUTE_BLOCK_SOURCE = /^(travel-details-points|travel-details-route-map-transition|route-elevation-)/;
// #3430: сдвиги секций хвоста («Рядом», комментарии, футер) входят в бюджет 0,1:
// сжатие занятой высоты удерживается, пока не уйдёт из экрана или не найдёт якорь
// в кадре без прокрутки, а каркас сайдбара держит место «Похожих». Запретными они
// не стали — пишутся отдельно для разбора источника.
const TAIL_SECTION_SOURCES = [
  'travel-details-sidebar-transition', 'travel-details-comments-transition', 'travel-details-footer-transition',
  'travel-details-footer-resolved-frame', 'travel-details-share', 'travel-details-telegram', 'travel-details-email-subscribe',
];

type Rect = { y: number; height: number };
type Shift = { value: number; time: number; hadRecentInput: boolean; sources: { testID: string | null; previousRect: Rect; currentRect: Rect }[] };
type Observation = { supported: boolean; installed: boolean; error: string | null; entries: Shift[] };
type ObservedWindow = Window & { __travelFastScrollCls?: Observation };

function readFrame() {
  const owner = document.querySelector<HTMLElement>('[data-testid="travel-details-scroll"]');
  const map = document.querySelector<HTMLElement>('[data-testid="travel-details-map-transition"]');
  const route = document.querySelector<HTMLElement>('[data-testid="travel-details-route-map-transition-runtime"]');
  if (!owner) return null;
  return {
    top: owner.scrollTop,
    height: owner.scrollHeight,
    viewport: owner.clientHeight,
    island: Boolean(document.querySelector('[data-ssr-html-island="description"]')),
    mapTop: map ? map.getBoundingClientRect().top : null,
    routeBlockHeight: route ? route.getBoundingClientRect().height : null,
    profileCount: document.querySelectorAll('[data-testid="route-elevation-profile"]').length,
    pendingProfileReserves: document.querySelectorAll('[data-testid="route-elevation-profiles-reserve"]').length,
  };
}

export async function assertTravelFastScrollCls(
  { browser, baseURL }: { browser: Browser; baseURL: string | undefined },
  testInfo: TestInfo,
  viewport: { width: number; height: number },
) {
  // Бюджет прежних трёх прогонов одной статьи (до 60 с ждём подмену острова) — на каждую статью.
  test.setTimeout(300_000 * ARTICLES.length);
  const results = [];
  for (const article of ARTICLES) for (let sample = 1; sample <= SAMPLES; sample++) {
    const context = await browser.newContext({ viewport, baseURL, storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(`${error.name}: ${error.message}`));
    const { unexpectedWrites: writes } = await installReadOnlyTravelApi(context, { baseURL, travelId: article.id });
    await page.addInitScript(seedNecessaryConsent);
    await page.addInitScript(hideRecommendationsBanner);
    await page.addInitScript(() => {
      const state: Observation = {
        supported: typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes.includes('layout-shift'),
        installed: false, error: null, entries: [],
      };
      (window as ObservedWindow).__travelFastScrollCls = state;
      if (!state.supported) return;
      try {
        new PerformanceObserver(list => {
          for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean; sources?: { node: Node | null; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }[] })[]) {
            state.entries.push({
              value: entry.value, time: entry.startTime, hadRecentInput: entry.hadRecentInput,
              sources: (entry.sources ?? []).map(source => ({
                testID: source.node instanceof Element ? source.node.closest('[data-testid]')?.getAttribute('data-testid') ?? null : null,
                previousRect: { y: source.previousRect.y, height: source.previousRect.height },
                currentRect: { y: source.currentRect.y, height: source.currentRect.height },
              })),
            });
          }
        }).observe({ type: 'layout-shift', buffered: true });
        state.installed = true;
      } catch (error) { state.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error); }
    });
    // Окна наблюдения метрики, а не ожидание готовности элемента.
    const observeWindow = async (duration: number) => {
      const since = await page.evaluate(() => performance.now());
      await page.waitForFunction(({ since, duration }) => performance.now() - since >= duration, { since, duration });
    };
    const scrollBy = (delta: number) => page.evaluate((delta) => {
      const owner = document.querySelector<HTMLElement>('[data-testid="travel-details-scroll"]')!;
      const before = owner.scrollTop;
      owner.scrollTop = before + delta;
      return { moved: owner.scrollTop !== before, atBottom: owner.scrollTop >= owner.scrollHeight - owner.clientHeight - 1 };
    }, delta);
    let observation: Observation | null = null, first = null, final = null, failure: string | null = null, steps = 0;
    try {
      expect((await page.goto(article.path, { waitUntil: 'load' }))?.ok()).toBe(true);
      await observeWindow(6000);
      first = await page.evaluate(readFrame);
      expect(first, 'the real article scroll owner exists').not.toBeNull();
      expect(first!.top, 'a fresh article stays at its start').toBe(0);
      // Первый шаг запускает подмену серверного острова полным рендером: высота
      // тела меняется на десятки тысяч px, и разгон считается уже от неё.
      await scrollBy(STEP_PX);
      await page.waitForFunction(() => !document.querySelector('[data-ssr-html-island="description"]'), undefined, { timeout: 60_000 });
      await observeWindow(1500);
      const settled = await page.evaluate(readFrame);
      expect(settled?.mapTop, 'the deferred map slot is in the article').not.toBeNull();
      await scrollBy(settled!.mapTop! - RUN_UP_PX);
      await observeWindow(STEP_MS);
      for (; steps < 600; steps++) {
        const state = await scrollBy(STEP_PX);
        await observeWindow(STEP_MS);
        if (!state.moved || state.atBottom) break;
      }
      await observeWindow(5000);
      final = await page.evaluate(readFrame);
      observation = await page.evaluate(() => (window as ObservedWindow).__travelFastScrollCls ?? null);
      await page.screenshot({ path: testInfo.outputPath(`travel-fast-scroll-${viewport.width}-${article.id}-${sample}-bottom.png`) });
    } catch (error) {
      failure = error instanceof Error ? `${error.name}: ${error.message}` : 'runtime-failure';
      observation = await page.evaluate(() => (window as ObservedWindow).__travelFastScrollCls ?? null).catch(() => null);
    } finally {
      await context.close();
    }
    const valid = observation?.supported === true && observation.installed === true && observation.error === null;
    const shifts = valid ? observation!.entries.filter(entry => !entry.hadRecentInput) : [];
    const isTailShift = (entry: Shift) => entry.sources.length > 0 &&
      entry.sources.every(source => source.testID !== null && TAIL_SECTION_SOURCES.includes(source.testID));
    const tailShifts = shifts.filter(isTailShift);
    const isRouteShift = (entry: Shift) => entry.sources.length > 0 &&
      entry.sources.every(source => source.testID !== null && ROUTE_BLOCK_SOURCE.test(source.testID));
    const routeShifts = shifts.filter(isRouteShift);
    const cumulative = valid ? shifts.reduce((sum, entry) => sum + entry.value, 0) : null;
    const forbidden = shifts.flatMap(entry => entry.sources.map(source => source.testID)).filter(testID => testID !== null && ROUTE_BLOCK_SOURCE.test(testID));
    results.push({ article: article.id, sample, viewport, first, final, steps, cumulative, forbidden, shifts, tailShifts, routeShifts, errors, writes, failure,
      pass: !failure && valid && cumulative !== null && cumulative <= 0.1 && forbidden.length === 0 &&
        final !== null && final.top + final.viewport >= final.height - 2 &&
        final.profileCount > 0 && final.pendingProfileReserves === 0 &&
        (final.routeBlockHeight ?? 0) >= article.routeBlockMinPx && errors.length === 0 && writes.length === 0 });
  }
  await testInfo.attach(`travel-fast-scroll-cls${viewport.width}-raw`, { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
  expect(results).toHaveLength(SAMPLES * ARTICLES.length);
  expect(results.filter(result => !result.pass).map(result => ({
    article: result.article, sample: result.sample, cumulative: result.cumulative, forbidden: result.forbidden, failure: result.failure,
    routeBlockHeight: result.final?.routeBlockHeight ?? null, profileCount: result.final?.profileCount ?? null,
    pendingProfileReserves: result.final?.pendingProfileReserves ?? null, errors: result.errors, writes: result.writes,
  }))).toEqual([]);
}
