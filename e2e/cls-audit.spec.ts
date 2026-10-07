import { test, expect } from './fixtures';
import { preacceptCookies } from './helpers/navigation';
import { assertTravelMobileCls } from './helpers/travelMobileCls';

type ClsEntry = {
  value: number;
  hadRecentInput: boolean;
  sources: any[];
};

type ClsAuditResult = {
  route: string;
  clsTotal: number;
  clsAfterRender: number;
  entries: ClsEntry[];
  error?: string;
};

function getNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const v = Number(raw);
  return Number.isFinite(v) ? v : fallback;
}

const CLS_AFTER_RENDER_MAX = getNumberEnv('E2E_CLS_AFTER_RENDER_MAX', 0.02);
const CLS_TOTAL_MAX = getNumberEnv('E2E_CLS_TOTAL_MAX', 0.35);
const NETWORKIDLE_TIMEOUT_MS = getNumberEnv('E2E_CLS_AUDIT_NETWORKIDLE_TIMEOUT_MS', 8000);
const VERBOSE = process.env.CI === 'true' ? process.env.E2E_CLS_AUDIT_VERBOSE === '1' : true;
const ENFORCE_TOTAL = process.env.E2E_CLS_AUDIT_ENFORCE_TOTAL === '1';


function getRoutesToAudit(defaultRoutes: string[]): string[] {
  const raw = process.env.E2E_CLS_AUDIT_ROUTES;
  if (!raw) return defaultRoutes;

  const routes = raw
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);

  return routes.length ? routes : defaultRoutes;
}

// Routes to audit.
// Note: in this app, the main travels list is '/'.
// In CI we audit a broader set; locally we keep it smaller so the test is actionable and less flaky.
const ROUTES_FULL: string[] = [
  '/',
  '/travelsby',
  '/map',
  '/roulette',
  '/quests',
  '/about',
  '/privacy',
  '/cookies',
  '/login',
  '/registration',
  '/settings',
  '/history',
  '/favorites',
];

const ROUTES_LOCAL_DEFAULT: string[] = ['/', '/travelsby', '/roulette'];


// #2330: selectable mobile-only audit; existing desktop audits retain their defaults.
// Capture supported pre-navigation observation and raw source rectangles in each fresh guest context.
const MAP_MOBILE_CLS_OBSERVER = String.raw`function installMapClsObserver() {
  const state = { supported: PerformanceObserver.supportedEntryTypes.includes('layout-shift'), entries: [], marks: [], readyAt: null, fontsReady: false, observerError: null };
  window.__mapMobileCls = state;
  const mark = (name, detail) => state.marks.push({ name, time: performance.now(), detail });
  mark('observer-init');
  const rect = value => value ? { x: value.x, y: value.y, width: value.width, height: value.height } : null;
  const describe = node => {
    if (!(node instanceof Element)) return null;
    const ancestors = [];
    for (let current = node, depth = 0; current && depth < 8; current = current.parentElement, depth++) {
      ancestors.push({ tag: current.tagName, id: current.id, testID: current.getAttribute('data-testid'), className: String(current.className || '').slice(0, 160) });
    }
    return { ancestors, rect: rect(node.getBoundingClientRect()) };
  };
  if (state.supported) {
    try {
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) state.entries.push({ value: entry.value, time: entry.startTime, hadRecentInput: entry.hadRecentInput, sources: (entry.sources || []).map(source => ({ node: describe(source.node), previousRect: rect(source.previousRect), currentRect: rect(source.currentRect) })) });
      });
      observer.observe({ type: 'layout-shift', buffered: true });
    } catch (error) { state.observerError = String(error); }
  }
  let mapMounted = false;
  const mutations = new MutationObserver(records => {
    if (!mapMounted && document.querySelector('.leaflet-container')) { mapMounted = true; mark('leaflet-dom-mounted'); }
    if (state.readyAt === null && document.querySelector('#root[data-map-route-ready="true"]')) { state.readyAt = performance.now(); mark('map-route-ready-after-tile-paint'); }
    for (const record of records) for (const node of record.addedNodes) if (node instanceof Element && (node.tagName === 'STYLE' || node.tagName === 'LINK')) mark('style-insert', { tag: node.tagName, id: node.id, href: node.getAttribute('href'), reactNative: node.hasAttribute('data-rnw') });
  });
  mutations.observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-map-route-ready'] });
  document.addEventListener('DOMContentLoaded', () => {
    mark('dom-content-loaded');
    document.fonts.ready.then(() => { state.fontsReady = true; mark('fonts-ready', { status: document.fonts.status }); });
  }, { once: true });
}`;
test('@map-mobile-cls390 five fresh guest frames stay <=0.05', async ({ browser, baseURL }, testInfo) => {
  const results: any[] = [];
  for (let sample = 1; sample <= 5; sample++) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: { cookies: [], origins: [] }, baseURL });
    const page = await context.newPage();
    const errors: string[] = [], writes: string[] = [], apiFailures: string[] = [];
    page.on('pageerror', error => errors.push(error.name));
    page.on('console', message => { if (message.type() === 'error') errors.push('console-error'); });
    page.on('response', response => { if (new URL(response.url()).pathname.startsWith('/api/') && response.status() >= 400) apiFailures.push(String(response.status())); });
    page.on('requestfailed', request => { if (new URL(request.url()).pathname.startsWith('/api/')) apiFailures.push(request.failure()?.errorText || 'request-failed'); });
    await context.route('**/api/**', async route => {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) {
        writes.push(route.request().method()); await route.abort('blockedbyclient');
      } else await route.continue();
    });
    await preacceptCookies(page);
    await page.addInitScript({ content: `(${MAP_MOBILE_CLS_OBSERVER})();` });
    let observation: any = null, failure: string | null = null;
    try {
      await page.goto('/map', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => {
        const state = (window as any).__mapMobileCls;
        return state && (state.supported === false || state.observerError ||
          (state.fontsReady && state.readyAt !== null && performance.now() - state.readyAt >= 3000));
      });
      observation = await page.evaluate(() => (window as any).__mapMobileCls);
      await page.screenshot({ path: testInfo.outputPath(`map-mobile-cls390-${sample}.png`) });
    } catch (error) { failure = error instanceof Error ? error.name : 'runtime-failure'; }
    await context.close();
    const valid = observation?.supported === true && !observation.observerError && observation.fontsReady === true &&
      observation.readyAt !== null && observation.marks?.some((mark: any) => mark.name === 'observer-init') && Array.isArray(observation.entries);
    const entries = valid ? observation.entries.filter((entry: any) => !entry.hadRecentInput) : [];
    const finite = entries.every((entry: any) => Number.isFinite(entry.value) && Number.isFinite(entry.time));
    const cumulative = valid && finite ? entries.reduce((total: number, entry: any) => total + entry.value, 0) : null;
    results.push({ sample, viewport: { width: 390, height: 844 }, observation, cumulative, errors, writes, apiFailures, failure,
      pass: valid && finite && cumulative <= 0.05 && errors.length === 0 && writes.length === 0 && apiFailures.length === 0 && !failure });
  }
  await testInfo.attach('map-mobile-cls390-five-raw', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
  expect(results).toHaveLength(5);
  expect(results.filter(result => !result.pass).map(result => ({ sample: result.sample, cumulative: result.cumulative, failure: result.failure, supported: result.observation?.supported }))).toEqual([]);
});

// #2329: real article data and the actual RN-Web scroll owner are required.
// A document-sized viewport is not evidence that this inner ScrollView reached its bottom.
test('@perf @travel-mobile-cls390 five complete guest traversals stay <=0.1', assertTravelMobileCls);

test.describe('@perf CLS audit', () => {
  // #2331: source regression for the late context-bar mount. Desktop execution
  // is deferred when the current acceptance scope is mobile web only.
  for (const width of [1024, 1280, 1440]) {
    test(`late header context keeps its hydration geometry @ ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await preacceptCookies(page);
      await page.addInitScript(() => {
        const state = { heights: [] as number[], headerShifts: [] as number[] };
        (window as any).__headerHydration = state;
        const sample = () => {
          const header = document.querySelector('[data-testid="main-header"]');
          const height = header?.getBoundingClientRect().height ?? 0;
          if (height > 0) state.heights.push(height);
          (window as any).__headerHydrationFrame = requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as any[]) {
            if (entry.hadRecentInput) continue;
            if (entry.sources?.some((source: any) => source.node instanceof Element &&
              source.node.closest('[data-testid="main-header"]'))) state.headerShifts.push(entry.value);
          }
        });
        observer.observe({ type: 'layout-shift', buffered: true });
      });
      await page.goto('/app', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('header-context-bar')).toBeVisible();
      const state = await page.evaluate(async () => {
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        cancelAnimationFrame((window as any).__headerHydrationFrame);
        return (window as any).__headerHydration as { heights: number[]; headerShifts: number[] };
      });
      expect(state.heights.length).toBeGreaterThan(1);
      expect(Math.max(...state.heights) - Math.min(...state.heights)).toBeLessThanOrEqual(0.5);
      if (width === 1280) expect(state.heights.at(-1)).toBe(124);
      expect(state.headerShifts).toEqual([]);
    });
  }

  test('audit core routes (clsTotal / clsAfterRender)', async ({ page }, testInfo) => {
    // This audit can take a while on dev servers (cold start / heavy routes).
    test.setTimeout(5 * 60_000);

    const results: ClsAuditResult[] = [];

    const routesToAudit = getRoutesToAudit(process.env.CI === 'true' ? ROUTES_FULL : ROUTES_LOCAL_DEFAULT);

    for (const route of routesToAudit) {
      const routePage = await page.context().newPage();

      // Keep viewport deterministic for CLS collection.
      // Otherwise Playwright/CI defaults can fall into web-mobile breakpoints (e.g. fixed footer dock),
      // inflating clsTotal with breakpoint-related relayout.
      await routePage.setViewportSize({ width: 1440, height: 900 });

      await preacceptCookies(routePage);
      await routePage.addInitScript(() => {
        const describeNode = (node: any) => {
          try {
            if (!node) return 'unknown';
            const el = node as Element;
            const tag = (el as any).tagName ? String((el as any).tagName).toLowerCase() : 'unknown';
            const testId = (el as any).getAttribute?.('data-testid') || '';
            const id = (el as any).id || '';
            const className = typeof (el as any).className === 'string' ? String((el as any).className) : '';

            let text = '';
            try {
              const raw = (el as any).innerText || (el as any).textContent || '';
              text = String(raw).replace(/\s+/g, ' ').trim().slice(0, 80);
            } catch {
              text = '';
            }

            let rect: any = null;
            try {
              const r = (el as any).getBoundingClientRect?.();
              if (r) {
                rect = { x: r.x, y: r.y, w: r.width, h: r.height };
              }
            } catch {
              rect = null;
            }

            const parts: string[] = [tag];
            if (testId) parts.push(`[data-testid="${testId}"]`);
            if (id) parts.push(`#${id}`);
            if (className.trim()) {
              parts.push(`.${className.trim().split(/\s+/).slice(0, 3).join('.')}`);
            }

            return {
              label: parts.join(''),
              testId,
              id,
              className: className.trim().split(/\s+/).slice(0, 6).join(' '),
              text,
              rect,
            };
          } catch {
            return 'unknown';
          }
        };

        (window as any).__e2eCls = {
          clsTotal: 0,
          clsAfterRender: 0,
          phase: 'total',
          finalized: false,
          entries: [] as any[],
        };

        try {
          const obs = new PerformanceObserver((list) => {
            for (const entry of list.getEntries() as any[]) {
              const state = (window as any).__e2eCls;
              if (!state || state.finalized) return;
              if (!entry || entry.hadRecentInput || typeof entry.value !== 'number') continue;

              state.clsTotal += entry.value;
              if (state.phase === 'afterRender') state.clsAfterRender += entry.value;

              try {
                const sources = Array.isArray(entry.sources)
                  ? entry.sources
                      .map((s: any) => s?.node)
                      .filter(Boolean)
                      .map(describeNode)
                  : [];

                state.entries.push({
                  value: entry.value,
                  hadRecentInput: !!entry.hadRecentInput,
                  sources,
                });
                state.entries.sort((a: any, b: any) => b.value - a.value);
                state.entries = state.entries.slice(0, 8);
              } catch {
                // ignore
              }
            }
          });

          obs.observe({ type: 'layout-shift', buffered: true } as any);
        } catch {
          // ignore
        }
      });

      try {
        await routePage.goto(route, { waitUntil: 'domcontentloaded', timeout: 45_000 });

        // Allow initial render/hydration/async blocks to complete.
        await routePage.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT_MS }).catch(() => null);

        try {
          const beforePath = testInfo.outputPath(`cls-${route.replace(/\W+/g, '_')}-before.png`);
          await routePage.screenshot({ path: beforePath, fullPage: false });
          await testInfo.attach(`cls-${route}-before`, { path: beforePath, contentType: 'image/png' });
        } catch {
          // ignore screenshot errors
        }

        // Start measuring post-render CLS separately.
        await routePage.evaluate(() => {
          const s = (window as any).__e2eCls;
          if (!s) return;
          s.phase = 'afterRender';
          s.clsAfterRender = 0;
        }).catch(() => null);

        // Let the route settle (lazy components / images).
        await routePage.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT_MS }).catch(() => null);

        try {
          const afterPath = testInfo.outputPath(`cls-${route.replace(/\W+/g, '_')}-after.png`);
          await routePage.screenshot({ path: afterPath, fullPage: false });
          await testInfo.attach(`cls-${route}-after`, { path: afterPath, contentType: 'image/png' });
        } catch {
          // ignore screenshot errors
        }

        // Finalize CLS collection.
        const data = await routePage.evaluate(() => {
          const s = (window as any).__e2eCls;
          if (!s) return { clsTotal: 0, clsAfterRender: 0, entries: [] };
          s.finalized = true;
          return {
            clsTotal: typeof s.clsTotal === 'number' ? s.clsTotal : 0,
            clsAfterRender: typeof s.clsAfterRender === 'number' ? s.clsAfterRender : 0,
            entries: Array.isArray(s.entries) ? s.entries : [],
          };
        }).catch(() => ({ clsTotal: 0, clsAfterRender: 0, entries: [] }));

        results.push({
          route,
          clsTotal: data.clsTotal,
          clsAfterRender: data.clsAfterRender,
          entries: data.entries,
        });
      } catch (e: any) {
        const message = e?.message ? String(e.message) : String(e);
        results.push({ route, clsTotal: 0, clsAfterRender: 0, entries: [], error: message });
      } finally {
        await routePage.close().catch(() => undefined);
      }
    }

    // Sort worst offenders first
    results.sort((a, b) => b.clsAfterRender - a.clsAfterRender);

     
    console.log(
      'CLS audit results (sorted by clsAfterRender):\n' +
        results
          .map((r) => {
            const base = `${r.route}  clsAfterRender=${r.clsAfterRender.toFixed(4)}  clsTotal=${r.clsTotal.toFixed(4)}`;
            return r.error ? `${base}  ERROR=${r.error}` : base;
          })
          .join('\n')
    );

    if (VERBOSE) {
       
      console.log(
        'Top CLS entries per route:\n' +
          results
            .map((r) => {
              const top = r.entries
                .slice(0, 3)
                .map((e) => {
                  const src = Array.isArray(e.sources)
                    ? e.sources
                        .slice(0, 5)
                        .map((s: any) => {
                          if (typeof s === 'string') return s;
                          const label = String((s as any)?.label ?? 'unknown');
                          const rect = (s as any)?.rect;
                          const rectStr = rect ? ` @(${Number(rect.x).toFixed(0)},${Number(rect.y).toFixed(0)} ${Number(rect.w).toFixed(0)}x${Number(rect.h).toFixed(0)})` : '';
                          const text = (s as any)?.text ? ` "${String((s as any).text)}"` : '';
                          return `${label}${rectStr}${text}`;
                        })
                        .join(' | ')
                    : '';
                  return `  - ${e.value.toFixed(4)}: ${src}`;
                })
                .join('\n');
              return `${r.route}\n${top || '  (no entries captured)'}`;
            })
            .join('\n\n')
      );
    }

    const failing = results.filter((r) => {
      if (r.error) return false;
      const totalFail = ENFORCE_TOTAL && r.clsTotal > CLS_TOTAL_MAX;
      const afterFail = r.clsAfterRender > CLS_AFTER_RENDER_MAX;
      return totalFail || afterFail;
    });

    if (failing.length) {
      const details = failing
        .map((r) => {
          const top = r.entries
            .slice(0, 3)
            .map((e) => {
              const src = Array.isArray(e.sources)
                ? e.sources
                    .slice(0, 5)
                    .map((s: any) => {
                      if (typeof s === 'string') return s;
                      const label = String((s as any)?.label ?? 'unknown');
                      const rect = (s as any)?.rect;
                      const rectStr = rect
                        ? ` @(${Number(rect.x).toFixed(0)},${Number(rect.y).toFixed(0)} ${Number(rect.w).toFixed(0)}x${Number(rect.h).toFixed(0)})`
                        : '';
                      const text = (s as any)?.text ? ` "${String((s as any).text)}"` : '';
                      return `${label}${rectStr}${text}`;
                    })
                    .join(' | ')
                : '';
              return `    - ${e.value.toFixed(4)}: ${src}`;
            })
            .join('\n');
          return [
            `  ${r.route}`,
            `    clsAfterRender=${r.clsAfterRender.toFixed(4)} (max=${CLS_AFTER_RENDER_MAX})`,
            ENFORCE_TOTAL ? `    clsTotal=${r.clsTotal.toFixed(4)} (max=${CLS_TOTAL_MAX})` : `    clsTotal=${r.clsTotal.toFixed(4)} (ignored)`,
            top ? `    top entries:\n${top}` : '    (no entries captured)',
          ].join('\n');
        })
        .join('\n\n');

      expect(failing, `CLS audit failed (routes above limits).\n\n${details}`).toHaveLength(0);
    }
  });

  // Merged from cls-guard-travelsby.spec.ts — mobile-specific CLS guard for the main list.
  test('mobile CLS guard: /travelsby should not exceed thresholds', async ({ page }) => {
    test.setTimeout(2 * 60_000);

    await page.setViewportSize({ width: 390, height: 844 });

    await preacceptCookies(page);
    await page.addInitScript(() => {
      (window as any).__e2eCls = {
        clsTotal: 0,
        clsAfterRender: 0,
        phase: 'total',
        finalized: false,
        entries: [] as any[],
      };
      try {
        const obs = new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as any[]) {
            const state = (window as any).__e2eCls;
            if (!state || state.finalized) return;
            if (!entry || entry.hadRecentInput || typeof entry.value !== 'number') continue;
            state.clsTotal += entry.value;
            if (state.phase === 'afterRender') state.clsAfterRender += entry.value;
          }
        });
        obs.observe({ type: 'layout-shift', buffered: true } as any);
      } catch { /* ignore */ }
    });

    let lastError: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await page.goto('/travelsby', { waitUntil: 'domcontentloaded', timeout: 60_000 });
        await Promise.any([
          page.waitForSelector('#search-input', { timeout: 30_000 }),
          page.waitForSelector('[placeholder*="Найти путешествия"]', { timeout: 30_000 }),
          page.waitForSelector('[data-testid="travel-card-link"], [data-testid="travel-list-item-skeleton"]', { timeout: 30_000 }),
          page.waitForSelector('text=Пока нет путешествий', { timeout: 30_000 }),
        ]);
        lastError = null;
        break;
      } catch (e) {
        lastError = e;
        if (typeof (page as any)?.isClosed === 'function' && (page as any).isClosed()) break;
        try { await page.waitForTimeout(700 + attempt * 400); } catch { break; }
      }
    }
    if (lastError) throw lastError;

    await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT_MS }).catch(() => null);
    await page.evaluate(() => { const s = (window as any).__e2eCls; if (s) { s.phase = 'afterRender'; s.clsAfterRender = 0; } }).catch(() => null);
    await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT_MS }).catch(() => null);

    const data = await page.evaluate(() => {
      const s = (window as any).__e2eCls;
      if (!s) return { clsTotal: 0, clsAfterRender: 0 };
      s.finalized = true;
      return { clsTotal: s.clsTotal ?? 0, clsAfterRender: s.clsAfterRender ?? 0 };
    }).catch(() => ({ clsTotal: 0, clsAfterRender: 0 }));

    expect(data.clsTotal, `Mobile CLS total too high: ${data.clsTotal.toFixed(4)}`).toBeLessThanOrEqual(CLS_TOTAL_MAX);
    expect(data.clsAfterRender, `Mobile CLS afterRender too high: ${data.clsAfterRender.toFixed(4)}`).toBeLessThanOrEqual(CLS_AFTER_RENDER_MAX);
  });
});
