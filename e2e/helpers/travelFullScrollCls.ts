import { test, expect, type Browser, type TestInfo } from '@playwright/test';

const ARTICLE = '/travels/tropa-vedm-v-gartse-kak-proiti-hexenstieg';

type Rect = { x: number; y: number; width: number; height: number };
type Shift = {
  value: number;
  time: number;
  hadRecentInput: boolean;
  sources: { tag: string | null; className: string | null; testID: string | null; section: string | null; previousRect: Rect; currentRect: Rect }[];
};
type Observation = { supported: boolean; installed: boolean; error: string | null; entries: Shift[] };
type ObservedWindow = Window & { __travelFullScrollCls?: Observation };

// #3382: keep the production reproduction cadence; settling before scrolling
// alone misses lower-section loading/release while the reader is traversing it.
export async function assertTravelFullScrollCls(
  { browser, baseURL }: { browser: Browser; baseURL: string | undefined },
  testInfo: TestInfo,
  viewport: { width: number; height: number },
) {
  test.setTimeout(300_000);
  const results = [];
  for (let sample = 1; sample <= 5; sample++) {
    const context = await browser.newContext({ viewport, baseURL, storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    const errors: string[] = [], writes: string[] = [], consoleErrors: string[] = [];
    page.on('pageerror', error => errors.push(`${error.name}: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    await context.route('**/api/**', async route => {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) {
        writes.push(route.request().method());
        await route.abort('blockedbyclient');
      } else await route.continue();
    });
    // Keep the same fresh-guest storage as the original production probe.
    await page.addInitScript(() => localStorage.setItem('consent_v1', '1'));
    await page.addInitScript(() => {
      const state: Observation = {
        supported: typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes.includes('layout-shift'),
        installed: false, error: null, entries: [],
      };
      (window as ObservedWindow).__travelFullScrollCls = state;
      if (!state.supported) return;
      const rect = (value: DOMRectReadOnly): Rect => ({ x: value.x, y: value.y, width: value.width, height: value.height });
      try {
        new PerformanceObserver(list => {
          try {
            for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean; sources?: { node: Node | null; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }[] })[]) {
              state.entries.push({
                value: entry.value, time: entry.startTime, hadRecentInput: entry.hadRecentInput,
                sources: (entry.sources ?? []).map(source => {
                  const node = source.node instanceof Element ? source.node : null;
                  return {
                    tag: node?.tagName ?? null, className: node ? String(node.className) : null,
                    testID: node?.closest('[data-testid]')?.getAttribute('data-testid') ?? null,
                    section: node?.closest('[data-section-key]')?.getAttribute('data-section-key') ?? null,
                    previousRect: rect(source.previousRect), currentRect: rect(source.currentRect),
                  };
                }),
              });
            }
          } catch (error) { state.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error); }
        }).observe({ type: 'layout-shift', buffered: true });
        state.installed = true;
      } catch (error) { state.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error); }
    });
    const snapshot = () => {
      const owners = document.querySelectorAll<HTMLElement>('[data-testid="travel-details-scroll"]');
      const owner = owners.length === 1 ? owners[0] : null;
      if (!owner) return null;
      const bounds = owner.getBoundingClientRect();
      const footer = document.querySelector('[data-testid="travel-details-footer-resolved-frame"]')?.getBoundingClientRect();
      const transitionStates = Object.fromEntries(['map', 'near', 'sidebar', 'comments', 'footer'].map(section => [
        section, document.querySelector(`[data-testid="travel-details-${section}-transition"]`)?.getAttribute('data-deferred-transition-state') ?? null,
      ]));
      return {
        top: owner.scrollTop, height: owner.scrollHeight, viewport: owner.clientHeight,
        transitionStates, transitionsReady: Object.values(transitionStates).every(state => state === 'runtime'),
        footerVisible: Boolean(footer && footer.height > 0 && footer.bottom > Math.max(0, bounds.top) && footer.top < Math.min(innerHeight, bounds.bottom)),
      };
    };
    // These are the metric's prescribed observation windows, not element
    // readiness. Use the same elapsed-performance condition as the #2329 audit.
    const observeWindow = async (duration: number) => {
      const since = await page.evaluate(() => performance.now());
      await page.waitForFunction(({ since, duration }) => performance.now() - since >= duration, { since, duration });
    };
    let observation: Observation | null = null, first = null, final = null, failure: string | null = null;
    try {
      expect((await page.goto(ARTICLE, { waitUntil: 'load' }))?.ok()).toBe(true);
      await observeWindow(6000);
      first = await page.evaluate(snapshot);
      expect(first, 'the real article scroll owner exists').not.toBeNull();
      expect(first!.top, 'a fresh article stays at its start before the first wheel').toBe(0);
      expect(first!.height - first!.viewport).toBeGreaterThan(first!.viewport);
      await page.mouse.move(Math.min(200, viewport.width / 2), 400);
      for (let step = 0; step < 120; step++) {
        await page.mouse.wheel(0, 500);
        await observeWindow(200);
      }
      await observeWindow(2000);
      final = await page.evaluate(snapshot);
      observation = await page.evaluate(() => (window as ObservedWindow).__travelFullScrollCls ?? null);
      await page.screenshot({ path: testInfo.outputPath(`travel-full-scroll-${viewport.width}-${sample}-bottom.png`) });
    } catch (error) {
      failure = error instanceof Error ? `${error.name}: ${error.message}` : 'runtime-failure';
      observation = await page.evaluate(() => (window as ObservedWindow).__travelFullScrollCls ?? null).catch(() => null);
    } finally {
      await context.close();
    }
    const valid = observation?.supported === true && observation.installed === true && observation.error === null && Array.isArray(observation.entries) &&
      observation.entries.every(entry => Number.isFinite(entry.value) && Number.isFinite(entry.time));
    const cumulative = valid ? observation!.entries.filter(entry => !entry.hadRecentInput).reduce((sum, entry) => sum + entry.value, 0) : null;
    results.push({ sample, viewport, first, final, observation, cumulative, errors, consoleErrors, writes, failure,
      pass: !failure && valid && cumulative !== null && cumulative <= 0.1 &&
        first !== null && first.top === 0 && final !== null && final.top > first.top && final.top + final.viewport >= final.height - 2 &&
        final.transitionsReady && final.footerVisible && errors.length === 0 && writes.length === 0 });
  }
  await testInfo.attach(`travel-full-scroll-cls${viewport.width}-five-raw`, { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
  expect(results).toHaveLength(5);
  expect(results.filter(result => !result.pass).map(result => ({ sample: result.sample, cumulative: result.cumulative, failure: result.failure }))).toEqual([]);
}
