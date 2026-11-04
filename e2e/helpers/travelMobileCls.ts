import { test, expect, type Browser, type TestInfo } from '@playwright/test';
import { preacceptCookies } from './navigation';

const { resolveApiProxyTarget } = require('../../scripts/serve-web-build') as { resolveApiProxyTarget: () => string };
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const MEDIA_PATH = /^\/(?:address-image|avatar|gallery|quest-cover|travel-description-image|travel-image)\//;
// Match the rich-text image renderer's default ratio when the article has no dimensions.
const MISSING_LOCAL_IMAGE = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="9"/>';

// Shared #2329 contract: five mobile guest traversals against real article data.
export async function assertTravelMobileCls(
  { browser, baseURL }: { browser: Browser; baseURL: string | undefined },
  testInfo: TestInfo,
) {
  test.setTimeout(180_000);
  const results: any[] = [];
  const route = '/travels/liuksemburg-za-odin-den-kvest-kazematy-bok-i-legenda-o-meliuzine';
  const webOrigin = baseURL ? new URL(baseURL) : null;
  const mediaProxy = new URL(resolveApiProxyTarget());
  for (let sample = 1; sample <= 5; sample++) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: { cookies: [], origins: [] }, baseURL });
    const page = await context.newPage();
    const errors: string[] = [], writes: string[] = [];
    const localImageFallbacks: string[] = [];
    if (webOrigin && LOOPBACK_HOSTS.has(webOrigin.hostname) && LOOPBACK_HOSTS.has(mediaProxy.hostname)) {
      // The local database has production article records, while its media bucket
      // only contains local uploads. Keep successful media responses and all API calls real.
      await context.route(
        url => (url.origin === webOrigin.origin || url.origin === mediaProxy.origin) && MEDIA_PATH.test(url.pathname),
        async mediaRoute => {
          const request = mediaRoute.request();
          if (request.method() !== 'GET' || request.resourceType() !== 'image') {
            await mediaRoute.continue();
            return;
          }
          const response = await mediaRoute.fetch({ maxRedirects: 0 });
          const repairBusy = response.status() === 503 &&
            response.headers()['x-metravel-image-transform'] === 'repair-capacity-rejected';
          if (response.status() !== 404 && !repairBusy) {
            await mediaRoute.fulfill({ response });
            return;
          }
          localImageFallbacks.push(`${response.status()} ${new URL(request.url()).pathname}`);
          await mediaRoute.fulfill({
            headers: { 'access-control-allow-origin': webOrigin.origin },
            contentType: 'image/svg+xml',
            body: MISSING_LOCAL_IMAGE,
          });
        },
      );
    }
    const api = new Map<any, { id: number; method: string; path: string; status: number | null; finished: boolean; failed: boolean }>();
    page.on('pageerror', error => errors.push(`${error.name}: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') errors.push('console-error'); });
    page.on('request', request => {
      const path = new URL(request.url()).pathname;
      if (path.startsWith('/api/')) api.set(request, { id: api.size + 1, method: request.method(), path, status: null, finished: false, failed: false });
    });
    page.on('response', response => { const entry = api.get(response.request()); if (entry) entry.status = response.status(); });
    page.on('requestfinished', request => { const entry = api.get(request); if (entry) entry.finished = true; });
    page.on('requestfailed', request => { const entry = api.get(request); if (entry) entry.failed = true; });
    await context.route('**/api/**', async requestRoute => {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(requestRoute.request().method())) {
        writes.push(requestRoute.request().method());
        await requestRoute.abort('blockedbyclient');
      } else await requestRoute.continue();
    });
    await preacceptCookies(page);
    await page.addInitScript(() => {
      const state = { supported: PerformanceObserver.supportedEntryTypes.includes('layout-shift'), installed: false, error: false, entries: [] as any[] };
      (window as any).__travelMobileCls = state;
      const rect = (value: DOMRectReadOnly) => ({ x: value.x, y: value.y, width: value.width, height: value.height });
      if (!state.supported) return;
      try {
        new PerformanceObserver(list => {
          for (const entry of list.getEntries() as any[]) state.entries.push({
            value: entry.value, time: entry.startTime, hadRecentInput: entry.hadRecentInput,
            ownerTop: document.querySelector('[data-testid="travel-details-scroll"]')?.scrollTop ?? null,
            sources: (entry.sources || []).map((source: any) => ({
              testID: source.node instanceof Element ? source.node.closest('[data-testid]')?.getAttribute('data-testid') : null,
              previousRect: rect(source.previousRect), currentRect: rect(source.currentRect),
            })),
          });
        }).observe({ type: 'layout-shift', buffered: true });
        state.installed = true;
      } catch { state.error = true; }
    });
    const snapshot = () => {
      const candidates = document.querySelectorAll<HTMLElement>('[data-testid="travel-details-scroll"]');
      const owner = candidates.length === 1 ? candidates[0] : null;
      if (!owner) return null;
      const bounds = owner.getBoundingClientRect();
      const x = bounds.x + bounds.width / 2;
      const y = Math.min(744, bounds.y + bounds.height * 0.7);
      let hit = document.elementFromPoint(x, y) as HTMLElement | null;
      while (hit && !(hit.scrollHeight > hit.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(hit).overflowY))) hit = hit.parentElement;
      const footer = document.querySelector('[data-testid="travel-details-footer-transition-runtime"]')?.getBoundingClientRect();
      return {
        top: owner.scrollTop, height: owner.scrollHeight, viewport: owner.clientHeight, x, y,
        overflow: getComputedStyle(owner).overflowY, wheelHitIsOwner: hit === owner,
        footerVisible: Boolean(footer && footer.height > 0 && footer.bottom > Math.max(0, bounds.top) && footer.top < Math.min(innerHeight, bounds.bottom)),
        transitionsReady: ['sidebar', 'comments', 'footer'].every(section =>
          document.querySelector(`[data-testid="travel-details-${section}-transition"]`)?.getAttribute('data-deferred-transition-state') === 'runtime'),
        clamped: document.querySelectorAll('[data-reserve-release-state="clamped"]').length,
      };
    };
    let failure: string | null = null, observation: any = null, first: any = null, final: any = null;
    let moved = false;
    let settledRequestIds: number[] = [];
    const samples: any[] = [];
    try {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(response?.ok()).toBe(true);
      await page.waitForFunction(() => document.documentElement.classList.contains('app-hydrated'));
      await expect(page.locator('#root')).toHaveAttribute('data-travel-details-ready', 'true');
      const fontsStatus = await page.evaluate(async () => { await document.fonts.ready; return document.fonts.status; });
      expect(fontsStatus).toBe('loaded');
      first = await page.evaluate(snapshot);
      expect(first?.wheelHitIsOwner, 'the ready article owns the initial wheel hit').toBe(true);
      expect(first?.overflow).toMatch(/auto|scroll/);
      expect(first!.height - first!.viewport).toBeGreaterThan(first!.viewport);
      let bottomSamples = 0;
      let stalledSteps = 0;
      for (let step = 0; step < 80 && bottomSamples < 4; step++) {
        const before = await page.evaluate(snapshot);
        expect(before?.wheelHitIsOwner, `the article owns the wheel hit at step ${step}`).toBe(true);
        const start = await page.evaluate(() => performance.now());
        await page.mouse.move(before!.x, before!.y);
        await page.mouse.wheel(0, 600);
        // Fixed observation cadence is part of the CLS traversal, not element readiness.
        await page.waitForFunction(since => performance.now() - since >= 300, start);
        const after = await page.evaluate(snapshot);
        const bottom = after!.top + after!.viewport >= after!.height - 2;
        const delta = after!.top - before!.top;
        samples.push(after);
        if (step === 0) expect(delta, 'the first wheel advances the ready article').toBeGreaterThan(0);
        // A layout correction can absorb one step once scrolling has started.
        // Two consecutive non-advancing steps signal a stalled traversal.
        stalledSteps = delta > 0 || bottom ? 0 : stalledSteps + 1;
        expect(stalledSteps, `article scroll stalled at wheel step ${step} (top=${after!.top})`).toBeLessThan(2);
        moved ||= delta > 0;
        bottomSamples = bottom ? bottomSamples + 1 : 0;
      }
      await expect.poll(() => [...api.values()].every(entry => entry.finished || entry.failed), { timeout: 15_000 }).toBe(true);
      settledRequestIds = [...api.values()].map(entry => entry.id);
      const settleStart = await page.evaluate(() => performance.now());
      await page.waitForFunction(since => performance.now() - since >= 3500, settleStart);
      expect([...api.values()].map(entry => entry.id)).toEqual(settledRequestIds);
      await page.screenshot({ path: testInfo.outputPath(`travel-mobile-cls390-${sample}-bottom.png`) });
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      expect([...api.values()].map(entry => entry.id)).toEqual(settledRequestIds);
      final = await page.evaluate(snapshot);
      observation = await page.evaluate(() => (window as any).__travelMobileCls);
    } catch (error) {
      failure = error instanceof Error ? `${error.name}: ${error.message}` : 'runtime-failure';
      observation = await page.evaluate(() => (window as any).__travelMobileCls).catch(() => null);
    }
    await context.close();
    const valid = observation?.supported === true && observation.installed === true && observation.error === false &&
      Array.isArray(observation.entries) && observation.entries.every((entry: any) => Number.isFinite(entry.value) && Number.isFinite(entry.time));
    const cumulative = valid ? observation.entries.filter((entry: any) => !entry.hadRecentInput).reduce((sum: number, entry: any) => sum + entry.value, 0) : null;
    const rawSum = valid ? observation.entries.reduce((sum: number, entry: any) => sum + entry.value, 0) : null;
    const ledger = [...api.values()];
    const stableApiWindow = ledger.length === settledRequestIds.length && ledger.every((entry, index) => entry.id === settledRequestIds[index]);
    results.push({ sample, first, samples, final, observation, cumulative, rawSum, settledRequestIds, stableApiWindow, ledger, errors, writes, localImageFallbacks, failure,
      pass: !failure && valid && moved && final?.top + final?.viewport >= final?.height - 2 &&
        final?.footerVisible === true && final?.transitionsReady === true && final?.clamped === 0 && cumulative <= 0.1 &&
        errors.length === 0 && writes.length === 0 && stableApiWindow && ledger.length > 0 && ledger.every(entry => entry.finished && !entry.failed && entry.status !== null && entry.status < 400) });
  }
  await testInfo.attach('travel-mobile-cls390-five-raw', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
  expect(results).toHaveLength(5);
  expect(results.filter(result => !result.pass).map(result => ({ sample: result.sample, cumulative: result.cumulative, failure: result.failure }))).toEqual([]);
}
