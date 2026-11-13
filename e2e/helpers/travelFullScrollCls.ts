import { test, expect, type Browser, type TestInfo } from '@playwright/test';
import { installReadOnlyTravelApi } from './readOnlyTravelApi';

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

export function readTravelFullScrollFrame(options: { preserveMobilePoint: boolean; includeSections?: boolean }) {
  const driverWindow = window as Window & { __travelFullScrollOwner?: HTMLElement };
  let owner = driverWindow.__travelFullScrollOwner;
  if (!owner?.isConnected) {
    const owners = document.querySelectorAll<HTMLElement>('[data-testid="travel-details-scroll"]');
    owner = owners.length === 1 ? owners[0] : undefined;
    driverWindow.__travelFullScrollOwner = owner;
  }
  if (!owner) return null;
  const bounds = owner.getBoundingClientRect();
  const visible = {
    left: Math.max(0, bounds.left + owner.clientLeft),
    right: Math.min(innerWidth, bounds.left + owner.clientLeft + owner.clientWidth),
    top: Math.max(0, bounds.top + owner.clientTop),
    bottom: Math.min(innerHeight, bounds.top + owner.clientTop + owner.clientHeight),
  };
  const describe = (node: Element | null) => node ? {
    tag: node.tagName, testID: node.getAttribute('data-testid'),
    className: String(node.className).slice(0, 160),
  } : null;
  // Same nearest vertical scroll-owner rule as the #2329 traversal. A point
  // inside the viewport alone does not establish that wheel reaches the article.
  const inspect = (x: number, y: number, kind: string) => {
    const inside = x > visible.left && x < visible.right && y > visible.top && y < visible.bottom;
    const hit = inside ? document.elementFromPoint(x, y) : null;
    let scroller = hit as HTMLElement | null;
    while (scroller && !(scroller.scrollHeight > scroller.clientHeight + 1 && /^(auto|scroll)$/.test(getComputedStyle(scroller).overflowY))) scroller = scroller.parentElement;
    return {
      x, y, kind, inside, hit: describe(hit), scroller: describe(scroller),
      wheelHitIsOwner: inside && scroller === owner,
      nestedWheelConsumer: Boolean(hit?.closest('.leaflet-container,iframe,[role="dialog"],[aria-modal="true"]')),
    };
  };
  const proposed = options.preserveMobilePoint ? [{ x: 200, y: 400, kind: 'original-mobile' }] : [];
  const y = Math.max(visible.top + 2, Math.min(400, visible.bottom - 2));
  for (const candidateY of [y, visible.top + (visible.bottom - visible.top) * 0.35, visible.top + (visible.bottom - visible.top) * 0.75]) {
    proposed.push({ x: visible.left + 2, y: candidateY, kind: 'owner-left-padding' });
    proposed.push({ x: visible.right - 2, y: candidateY, kind: 'owner-right-padding' });
  }
  const candidates = [];
  for (const point of proposed) {
    const candidate = inspect(point.x, point.y, point.kind);
    candidates.push(candidate);
    if (candidate.wheelHitIsOwner && !candidate.nestedWheelConsumer) break;
  }
  const selected = candidates.find(point => point.wheelHitIsOwner && !point.nestedWheelConsumer) ?? null;
  const footer = options.includeSections ? document.querySelector('[data-testid="travel-details-footer-resolved-frame"]')?.getBoundingClientRect() : null;
  const transitionStates = options.includeSections ? Object.fromEntries(['map', 'excursions', 'near', 'sidebar', 'comments', 'footer'].map(section => [
    section, document.querySelector(`[data-testid="travel-details-${section}-transition"]`)?.getAttribute('data-deferred-transition-state') ?? null,
  ])) : null;
  // This article is eligible for Excursions. A runtime flow alone can still
  // contain its 160px Suspense fallback, so require the real section. Its
  // iframe has a separate viewport gate and may remain unloaded after a fast
  // traversal; record that fact and verify activation in targeted viewport QA.
  const excursions = options.includeSections ? document.querySelector('[data-section-key="excursions"]') : null;
  const widget = excursions?.querySelector('iframe[src]');
  const excursionsFrame = excursions?.getBoundingClientRect();
  const widgetFrame = widget?.getBoundingClientRect();
  return {
    top: owner.scrollTop, height: owner.scrollHeight, viewport: owner.clientHeight,
    driver: {
      ownerBounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }, visible,
      point: selected ? { x: selected.x, y: selected.y, kind: selected.kind } : null,
      wheelHitIsOwner: selected?.wheelHitIsOwner === true, candidates,
    },
    transitionStates, transitionsReady: transitionStates ? Object.values(transitionStates).every(state => state === 'runtime') : null,
    excursions: options.includeSections ? {
      sectionMounted: Boolean(excursions), widgetMounted: Boolean(widget),
      sectionHeight: excursionsFrame?.height ?? null, widgetHeight: widgetFrame?.height ?? null,
    } : null,
    excursionsResolved: options.includeSections ? Boolean(excursionsFrame && excursionsFrame.height > 0) : null,
    footerVisible: options.includeSections ? Boolean(footer && footer.height > 0 && footer.bottom > Math.max(0, bounds.top) && footer.top < Math.min(innerHeight, bounds.bottom)) : null,
  };
}

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
    const errors: string[] = [], consoleErrors: string[] = [];
    page.on('pageerror', error => errors.push(`${error.name}: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    const { handledViews, unexpectedWrites: writes } = await installReadOnlyTravelApi(context, { baseURL, travelId: 544 });
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
    // These are the metric's prescribed observation windows, not element
    // readiness. Use the same elapsed-performance condition as the #2329 audit.
    const observeWindow = async (duration: number) => {
      const since = await page.evaluate(() => performance.now());
      await page.waitForFunction(({ since, duration }) => performance.now() - since >= duration, { since, duration });
    };
    let observation: Observation | null = null, first = null, firstWheel = null, final = null, failure: string | null = null;
    const steps = [];
    const preserveMobilePoint = viewport.width === 390;
    try {
      expect((await page.goto(ARTICLE, { waitUntil: 'load' }))?.ok()).toBe(true);
      await observeWindow(6000);
      first = await page.evaluate(readTravelFullScrollFrame, { preserveMobilePoint, includeSections: true });
      expect(first, 'the real article scroll owner exists').not.toBeNull();
      expect(first!.top, 'a fresh article stays at its start before the first wheel').toBe(0);
      expect(first!.height - first!.viewport).toBeGreaterThan(first!.viewport);
      let pointer: { x: number; y: number } | null = null;
      for (let step = 0; step < 120; step++) {
        const before = await page.evaluate(readTravelFullScrollFrame, { preserveMobilePoint });
        steps.push({ step, frame: before });
        expect(before?.driver.wheelHitIsOwner, `the article owns the wheel hit at step ${step}`).toBe(true);
        const point = before!.driver.point!;
        if (!pointer || pointer.x !== point.x || pointer.y !== point.y) {
          await page.mouse.move(point.x, point.y);
          pointer = point;
        }
        await page.mouse.wheel(0, 500);
        await observeWindow(200);
        if (step === 0) {
          firstWheel = await page.evaluate(readTravelFullScrollFrame, { preserveMobilePoint });
          expect(firstWheel!.top, 'the first wheel advances the actual article').toBeGreaterThan(first!.top);
        }
      }
      await observeWindow(2000);
      final = await page.evaluate(readTravelFullScrollFrame, { preserveMobilePoint, includeSections: true });
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
    results.push({ sample, viewport, first, firstWheel, steps, final, observation, cumulative, errors, consoleErrors, writes, handledViews, failure,
      pass: !failure && valid && cumulative !== null && cumulative <= 0.1 &&
        first !== null && first.top === 0 && final !== null && final.top > first.top && final.top + final.viewport >= final.height - 2 &&
        final.transitionsReady && final.excursionsResolved && final.footerVisible && errors.length === 0 && writes.length === 0 && handledViews.length === 1 });
  }
  await testInfo.attach(`travel-full-scroll-cls${viewport.width}-five-raw`, { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
  expect(results).toHaveLength(5);
  expect(results.filter(result => !result.pass).map(result => ({ sample: result.sample, cumulative: result.cumulative, failure: result.failure }))).toEqual([]);
}
