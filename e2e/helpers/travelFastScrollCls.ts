import { test, expect, type Browser, type TestInfo } from '@playwright/test';
import { installReadOnlyTravelApi } from './readOnlyTravelApi';

// #3419: статья с десятью GPX-файлами — профили высот приходят после показа
// секции карты и растят её блок на тысячи пикселей, когда читатель уже ниже.
const ARTICLE = '/travels/tour-du-mont-blanc-vokrug-monblana-za-10-dney';
const ARTICLE_ID = 470;
// Протокол воспроизведения с прода 14.11.2026: около 1800 px/с. При шаге раз в
// 450 мс хвост успевает разрешиться за экраном и сдвига нет.
const STEP_PX = 400;
const STEP_MS = 220;
// Хвост статьи читатель проходит с разгона; тело статьи (десятки тысяч px) на
// сдвиг не влияет — прогрев всех кадров его не убирал.
const RUN_UP_PX = 6000;
const SAMPLES = 3;
// Высота блока карты без профилей — 692 px на проде; выше этого порога блок
// вырос уже после показа, то есть прогон действительно прошёл поздний рост.
const ROUTE_BLOCK_GROWN_MIN_PX = 2000;
// Источники этого механизма: точки маршрута, въезжающие в экран, и профили высот,
// нарисованные поверх них до публикации высоты блока.
const FORBIDDEN_SOURCES = ['travel-details-points', 'route-elevation-profile'];
// #3430: у самого конца страницы «Рядом», комментарии и футер ещё сдвигаются сами
// (прод 14.11.2026: `travel-details-footer-resolved-frame` 0,12 в 1 прогоне из 10).
// Это другая причина; её сдвиги пишутся в отчёт, но в бюджет этого контроля не
// входят, пока #3430 не закрыта, — иначе контроль блока карты краснел бы случайно.
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
  };
}

export async function assertTravelFastScrollCls(
  { browser, baseURL }: { browser: Browser; baseURL: string | undefined },
  testInfo: TestInfo,
  viewport: { width: number; height: number },
) {
  test.setTimeout(300_000);
  const results = [];
  for (let sample = 1; sample <= SAMPLES; sample++) {
    const context = await browser.newContext({ viewport, baseURL, storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(`${error.name}: ${error.message}`));
    const { unexpectedWrites: writes } = await installReadOnlyTravelApi(context, { baseURL, travelId: ARTICLE_ID });
    await page.addInitScript(() => localStorage.setItem('consent_v1', '1'));
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
      expect((await page.goto(ARTICLE, { waitUntil: 'load' }))?.ok()).toBe(true);
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
      await page.screenshot({ path: testInfo.outputPath(`travel-fast-scroll-${viewport.width}-${sample}-bottom.png`) });
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
    const cumulative = valid ? shifts.filter(entry => !isTailShift(entry)).reduce((sum, entry) => sum + entry.value, 0) : null;
    const forbidden = shifts.flatMap(entry => entry.sources.map(source => source.testID)).filter(testID => testID !== null && FORBIDDEN_SOURCES.includes(testID));
    results.push({ sample, viewport, first, final, steps, cumulative, forbidden, shifts, tailShifts, errors, writes, failure,
      pass: !failure && valid && cumulative !== null && cumulative <= 0.1 && forbidden.length === 0 &&
        final !== null && final.top + final.viewport >= final.height - 2 &&
        (final.routeBlockHeight ?? 0) >= ROUTE_BLOCK_GROWN_MIN_PX && errors.length === 0 && writes.length === 0 });
  }
  await testInfo.attach(`travel-fast-scroll-cls${viewport.width}-raw`, { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
  expect(results).toHaveLength(SAMPLES);
  expect(results.filter(result => !result.pass).map(result => ({
    sample: result.sample, cumulative: result.cumulative, forbidden: result.forbidden, failure: result.failure,
    routeBlockHeight: result.final?.routeBlockHeight ?? null, errors: result.errors, writes: result.writes,
  }))).toEqual([]);
}
