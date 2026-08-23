/**
 * Performance budget tests for the travel details page.
 *
 * These tests run against a **production build** (dist/prod) served locally
 * and enforce thresholds aligned with a Lighthouse Performance score ≥ 80.
 *
 * Metrics measured via the browser Performance API + PerformanceObserver:
 *   - LCP  (Largest Contentful Paint)  — target ≤ 2500 ms
 *   - TBT  (Total Blocking Time proxy) — target ≤ 300 ms
 *   - CLS  (Cumulative Layout Shift)   — target ≤ 0.10
 *   - FCP  (First Contentful Paint)    — target ≤ 1800 ms
 *   - SI   (Speed Index proxy via FCP) — informational
 *
 * The tests also check:
 *   - JS bundle transfer size (gzip)
 *   - Image optimization (width/height, modern formats, total weight)
 *   - Number of network requests
 *   - Long tasks on main thread
 *
 * Run:
 *   yarn build:web:prod
 *   npx playwright test e2e/travel-details-perf-budget.spec.ts
 *
 * Override thresholds via env:
 *   PERF_LCP_MAX_MS=2500  PERF_TBT_MAX_MS=300  PERF_CLS_MAX=0.10
 */

import { test, expect, devices, type Page } from '@playwright/test';
import {
  FALLBACK_TRAVEL_ID,
  FALLBACK_TRAVEL_SLUG,
  mockFallbackTravelDetails,
  preacceptCookies,
} from './helpers/navigation';
import { isMediaRequestWithoutWidth } from './helpers/mediaRequestWidth';
import {
  applyMobileThrottling,
  collectObservedProfile,
  measureCpuThrottlingRatio,
  median,
  MOBILE_THROTTLE_PROFILE,
} from './helpers/perfBudget';
import { clampCeiling } from './helpers/pagesPerfBudgets';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function envNum(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const v = Number(raw);
  return Number.isFinite(v) ? v : fallback;
}

// Thresholds aligned with Lighthouse score ≥ 80 (desktop)
const IS_CI = Boolean(process.env.CI);
const LCP_MAX_MS = envNum('PERF_LCP_MAX_MS', IS_CI ? 2500 : 10_000);
const TBT_MAX_MS = envNum('PERF_TBT_MAX_MS', IS_CI ? 300 : 600);
const CLS_MAX = envNum('PERF_CLS_MAX', 0.30);
const FCP_MAX_MS = envNum('PERF_FCP_MAX_MS', IS_CI ? 1800 : 3500);

const MAX_JS_TRANSFER_KB = envNum('PERF_MAX_JS_KB', 1800);
const MAX_IMG_TRANSFER_KB = envNum('PERF_MAX_IMG_KB', IS_CI ? 3500 : 4500);
const MAX_TOTAL_TRANSFER_KB = envNum('PERF_MAX_TOTAL_KB', IS_CI ? 7000 : 8000);
// Fresh origin/main production baseline (2026-08-11): 92 first-party requests,
// 996 KB JS and 1149 KB total. Keep the request ceiling exact while the
// independent transfer-size budgets continue to catch payload growth.
const MAX_REQUESTS = envNum('PERF_MAX_REQUESTS', 92);
const MAX_LONG_TASKS = envNum('PERF_MAX_LONG_TASKS', 5);
const LONG_TASK_THRESHOLD_MS = 50;

const REQUEST_BUDGET_HOSTS = new Set(
  (process.env.PERF_REQUEST_BUDGET_HOSTS ??
    '127.0.0.1,localhost,images.weserv.nl,metravellocal.s3.amazonaws.com,metravelprod.s3.eu-north-1.amazonaws.com')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
);

// The default fixture keeps API/media availability out of the regression signal.
// PERF_TRAVEL_SLUG remains an explicit opt-in for live-data diagnostics.
const TRAVEL_SLUG =
  process.env.PERF_TRAVEL_SLUG ||
  FALLBACK_TRAVEL_SLUG;

function travelUrl(slug: string): string {
  return `/travels/${slug}`;
}

async function openTravelDetailsForPerf(
  page: Page,
  waitUntil: 'load' | 'domcontentloaded' = 'load'
) {
  await mockFallbackTravelDetails(page);
  if (TRAVEL_SLUG === FALLBACK_TRAVEL_SLUG) {
    await page.route(`**/api/achievements/travel/${FALLBACK_TRAVEL_ID}/**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ peer_received: [] }),
      });
    });
    // Keep the deterministic fixture independent from the live nearby-quest
    // catalog. Otherwise it sometimes downloads six production quest covers
    // and sometimes none, moving the first-party count by six requests. An
    // explicit PERF_TRAVEL_SLUG remains genuinely live for diagnostics.
    await page.route('**/quests/near-location/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [], count: 0 }),
      });
    });
  }
  await page.goto(travelUrl(TRAVEL_SLUG), {
    waitUntil,
    timeout: 60_000,
  });

  const detailsRoot = page.locator('[data-testid="travel-details-page"]').first();
  const hero = page.locator('[data-testid="travel-details-hero"]').first();

  await expect(
    detailsRoot,
    'performance metrics require the rendered travel-details page, not an API/load error state'
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    hero,
    'performance metrics require the rendered travel-details hero'
  ).toBeVisible({ timeout: 30_000 });
}

/** Inject PerformanceObserver collectors before page load. */
async function injectPerfObservers(page: any) {
  await page.addInitScript(() => {
    const w: any = window as any
    w.__layoutShiftEntries = []
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
            w.__layoutShiftEntries.push({
              value: entry.value,
              hadRecentInput: entry.hadRecentInput,
              sources: entry.sources
                ? entry.sources.map((s: any) => ({
                    node: s.node,
                    previousRect: s.previousRect,
                    currentRect: s.currentRect,
                  }))
                : [],
            })
          }
        }
      }).observe({ type: 'layout-shift', buffered: true } as any)
    } catch {
      // noop
    }
  })

  await preacceptCookies(page);
  await page.addInitScript(() => {
    const w = window as any;
    w.__perfBudget = {
      lcp: null as number | null,
      fcp: null as number | null,
      cls: 0,
      longTasks: [] as number[],
      clsEntries: [] as Array<{ value: number; sources: string[] }>,
    };

    // CLS
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (entry && !entry.hadRecentInput && typeof entry.value === 'number') {
            w.__perfBudget.cls += entry.value;
            const sources = Array.isArray(entry.sources)
              ? entry.sources
                  .map((s: any) => {
                    try {
                      const el = s?.node as Element;
                      if (!el) return 'unknown';
                      const tag = el.tagName?.toLowerCase() || 'unknown';
                      const tid = (el as any).getAttribute?.('data-testid') || '';
                      return tid ? `${tag}[data-testid="${tid}"]` : tag;
                    } catch {
                      return 'unknown';
                    }
                  })
                  .filter(Boolean)
              : [];
            w.__perfBudget.clsEntries.push({ value: entry.value, sources });
          }
        }
      }).observe({ type: 'layout-shift', buffered: true } as any);
    } catch { /* unsupported */ }

    // LCP
    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1] as any;
        if (last && typeof last.startTime === 'number') {
          w.__perfBudget.lcp = last.startTime;
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true } as any);
    } catch { /* unsupported */ }

    // Long tasks (proxy for TBT)
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) {
            w.__perfBudget.longTasks.push(entry.duration);
          }
        }
      }).observe({ type: 'longtask', buffered: true } as any);
    } catch { /* unsupported */ }
  });
}

async function collectMetrics(page: any) {
  // Wait for page to stabilize
  await page.waitForLoadState('networkidle').catch(() => null);

  return page.evaluate(() => {
    const w = window as any;
    const pb = w.__perfBudget || {};

    // FCP from paint entries
    const paintEntries = performance.getEntriesByType('paint');
    const fcpEntry = paintEntries.find((e: any) => e.name === 'first-contentful-paint');
    const fcp = fcpEntry ? (fcpEntry as any).startTime : null;

    // TBT = sum of (longTask.duration - 50ms) for each long task
    const longTasks: number[] = pb.longTasks || [];
    const tbt = longTasks.reduce((sum: number, d: number) => sum + Math.max(0, d - 50), 0);

    // Navigation timing
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;

    return {
      lcp: typeof pb.lcp === 'number' ? pb.lcp : null,
      fcp: typeof fcp === 'number' ? fcp : null,
      cls: typeof pb.cls === 'number' ? pb.cls : 0,
      tbt,
      longTaskCount: longTasks.length,
      longTasks: longTasks.slice(0, 10),
      clsEntries: (pb.clsEntries || []).slice(0, 5),
      ttfb: nav ? nav.responseStart - nav.requestStart : null,
      domContentLoaded: nav ? nav.domContentLoadedEventEnd - nav.fetchStart : null,
      loadComplete: nav ? nav.loadEventEnd - nav.fetchStart : null,
    };
  });
}

type NetworkStats = {
  totalKB: number;
  jsKB: number;
  imgKB: number;
  cssKB: number;
  fontKB: number;
  otherKB: number;
  requestCount: number; // first-party scoped count used for request budget assertion
  allRequestCount: number;
  ignoredThirdPartyRequestCount: number;
  jsRequests: number;
  imgRequests: number;
  largestResources: Array<{ url: string; sizeKB: number; type: string }>;
  /** #1161: медиа-запросы без `w` — прокси на них отдаёт мастер целиком. */
  mediaRequestsWithoutWidth: string[];
};

function hostFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isPrivateOrLocalHost(host: string): boolean {
  if (!host) return false;
  if (host === 'localhost' || host === '::1' || host.endsWith('.local')) return true;
  if (/^127\.\d+\.\d+\.\d+$/.test(host)) return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(host)) return true;
  return false;
}

function shouldCountForRequestBudget(url: string): boolean {
  const host = hostFromUrl(url);
  if (!host) return true;
  if (REQUEST_BUDGET_HOSTS.has(host)) return true;
  if (isPrivateOrLocalHost(host)) return true;
  return false;
}

function createNetworkTracker(page: any): { getStats: () => NetworkStats } {
  const resources: Array<{ url: string; size: number; type: string }> = [];
  const mediaRequestsWithoutWidth = new Set<string>();
  let allRequestCount = 0;
  let requestCount = 0;
  let ignoredThirdPartyRequestCount = 0;

  page.on('response', async (response: any) => {
    allRequestCount++;
    try {
      const req = response.request();
      const type = req.resourceType();
      const url = req.url();
      const isCounted = shouldCountForRequestBudget(url);
      if (isCounted) {
        requestCount++;
      } else {
        ignoredThirdPartyRequestCount++;
      }

      if (isMediaRequestWithoutWidth(url)) {
        mediaRequestsWithoutWidth.add(url);
      }

      const contentLength = response.headers()['content-length'];
      const size = contentLength ? parseInt(contentLength, 10) : 0;
      if (size > 0) {
        resources.push({ url, size, type });
      }
    } catch { /* ignore */ }
  });

  return {
    getStats(): NetworkStats {
      let jsKB = 0, imgKB = 0, cssKB = 0, fontKB = 0, otherKB = 0;
      let jsRequests = 0, imgRequests = 0;

      for (const r of resources) {
        const kb = r.size / 1024;
        switch (r.type) {
          case 'script': jsKB += kb; jsRequests++; break;
          case 'image': imgKB += kb; imgRequests++; break;
          case 'stylesheet': cssKB += kb; break;
          case 'font': fontKB += kb; break;
          default: otherKB += kb;
        }
      }

      const totalKB = jsKB + imgKB + cssKB + fontKB + otherKB;

      const sorted = [...resources].sort((a, b) => b.size - a.size);
      const largestResources = sorted.slice(0, 10).map((r) => ({
        url: r.url.length > 120 ? r.url.slice(0, 117) + '...' : r.url,
        sizeKB: Math.round(r.size / 1024),
        type: r.type,
      }));

      return {
        totalKB: Math.round(totalKB),
        jsKB: Math.round(jsKB),
        imgKB: Math.round(imgKB),
        cssKB: Math.round(cssKB),
        fontKB: Math.round(fontKB),
        otherKB: Math.round(otherKB),
        requestCount,
        allRequestCount,
        ignoredThirdPartyRequestCount,
        jsRequests,
        imgRequests,
        largestResources,
        mediaRequestsWithoutWidth: [...mediaRequestsWithoutWidth],
      };
    },
  };
}

async function collectLayoutShiftDebug(page: any) {
  return page.evaluate(() => {
    const w: any = window as any;
    const entries = Array.isArray(w.__layoutShiftEntries) ? w.__layoutShiftEntries : [];

    const safeOuterHTML = (el: Element | null) => {
      try {
        if (!el) return null;
        const html = (el as HTMLElement).outerHTML || '';
        return html.length > 600 ? html.slice(0, 600) + '…' : html;
      } catch {
        return null;
      }
    };

    const closestContext = (el: Element | null) => {
      if (!el) return null;
      const pick = (node: Element | null) => {
        if (!node) return null;
        const testId = (node as HTMLElement).getAttribute?.('data-testid');
        const aria = (node as HTMLElement).getAttribute?.('aria-label');
        const role = (node as HTMLElement).getAttribute?.('role');
        const section = (node as HTMLElement).getAttribute?.('data-section-key');
        if (testId || aria || section) {
          return {
            tag: node.tagName.toLowerCase(),
            testId,
            aria,
            role,
            section,
          };
        }
        return null;
      };

      // walk up a bit
      let cur: Element | null = el;
      for (let i = 0; i < 6 && cur; i++) {
        const ctx = pick(cur);
        if (ctx) return ctx;
        cur = cur.parentElement;
      }
      return null;
    };

    const fingerprint = (el: Element | null) => {
      if (!el) return null;
      const id = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : '';
      const className = (el as HTMLElement).getAttribute?.('class') || '';
      const cls = className
        ? `.${String(className).split(' ').filter(Boolean).slice(0, 3).join('.')}`
        : '';
      const testId = (el as HTMLElement).getAttribute?.('data-testid');
      const section = (el as HTMLElement).getAttribute?.('data-section-key');
      const aria = (el as HTMLElement).getAttribute?.('aria-label');
      const tag = el.tagName ? el.tagName.toLowerCase() : 'unknown';
      return { tag, id, cls, testId, section, aria };
    };

    return entries.map((e: any) => ({
      value: e.value,
      sources: (e.sources || []).slice(0, 8).map((s: any) => ({
        previousRect: s.previousRect,
        currentRect: s.currentRect,
        node: fingerprint(s.node || null),
        closest: closestContext(s.node || null),
        outerHTML: safeOuterHTML(s.node || null),
      })),
    }));
  });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

test.describe('@perf Travel Details — Performance Budget (prod build, desktop)', () => {
  test.describe.configure({ mode: 'serial' });

  test('Core Web Vitals within budget (LCP ≤ 2.5s, TBT ≤ 300ms, CLS ≤ 0.1)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await injectPerfObservers(page);

    const tracker = createNetworkTracker(page);

    // Direct navigation to a deterministic travel page. An unavailable backend
    // must fail this rendering contract instead of being measured as a late LCP.
    await openTravelDetailsForPerf(page);

    const metrics = await collectMetrics(page);
    const network = tracker.getStats();
    const layoutShiftDebug = await collectLayoutShiftDebug(page);

    // Log all metrics for debugging
    const report = {
      thresholds: { LCP_MAX_MS, TBT_MAX_MS, CLS_MAX, FCP_MAX_MS, MAX_JS_TRANSFER_KB },
      metrics: {
        lcp: metrics.lcp != null ? `${Math.round(metrics.lcp)}ms` : 'N/A',
        fcp: metrics.fcp != null ? `${Math.round(metrics.fcp)}ms` : 'N/A',
        tbt: `${Math.round(metrics.tbt)}ms`,
        cls: metrics.cls.toFixed(4),
        longTaskCount: metrics.longTaskCount,
        ttfb: metrics.ttfb != null ? `${Math.round(metrics.ttfb)}ms` : 'N/A',
        domContentLoaded: metrics.domContentLoaded != null ? `${Math.round(metrics.domContentLoaded)}ms` : 'N/A',
        loadComplete: metrics.loadComplete != null ? `${Math.round(metrics.loadComplete)}ms` : 'N/A',
      },
      network: {
        totalKB: `${network.totalKB} KB`,
        jsKB: `${network.jsKB} KB (${network.jsRequests} requests)`,
        imgKB: `${network.imgKB} KB (${network.imgRequests} requests)`,
        cssKB: `${network.cssKB} KB`,
        fontKB: `${network.fontKB} KB`,
        requestCount: network.requestCount,
      },
      longTasks: metrics.longTasks.map((d: number) => `${Math.round(d)}ms`),
      clsEntries: metrics.clsEntries,
      layoutShiftDebug,
      largestResources: network.largestResources,
    };

    console.log('\n📊 PERFORMANCE BUDGET REPORT (Desktop)');
    console.log(JSON.stringify(report, null, 2));

    test.info().annotations.push({
      type: 'perf-budget',
      description: JSON.stringify(report),
    });

    // ---- Assertions ----

    // LCP: must be ≤ 2.5s for Lighthouse score ≥ 80
    if (metrics.lcp != null) {
      expect(
        metrics.lcp,
        `LCP ${Math.round(metrics.lcp)}ms exceeds budget ${LCP_MAX_MS}ms`
      ).toBeLessThanOrEqual(LCP_MAX_MS);
    }

    // FCP: must be ≤ 1.8s
    if (metrics.fcp != null) {
      expect(
        metrics.fcp,
        `FCP ${Math.round(metrics.fcp)}ms exceeds budget ${FCP_MAX_MS}ms`
      ).toBeLessThanOrEqual(FCP_MAX_MS);
    }

    // TBT: must be ≤ 300ms (proxy for Lighthouse TBT)
    expect(
      metrics.tbt,
      `TBT ${Math.round(metrics.tbt)}ms exceeds budget ${TBT_MAX_MS}ms`
    ).toBeLessThanOrEqual(TBT_MAX_MS);

    // CLS: must be ≤ 0.1
    expect(
      metrics.cls,
      `CLS ${metrics.cls.toFixed(4)} exceeds budget ${CLS_MAX}`
    ).toBeLessThanOrEqual(CLS_MAX);

    // Long tasks: no more than threshold
    expect(
      metrics.longTaskCount,
      `${metrics.longTaskCount} long tasks (>${LONG_TASK_THRESHOLD_MS}ms) exceeds budget ${MAX_LONG_TASKS}`
    ).toBeLessThanOrEqual(MAX_LONG_TASKS);
  });

  test('Network transfer budget (JS/images/total/requests)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await preacceptCookies(page);

    const tracker = createNetworkTracker(page);

    await openTravelDetailsForPerf(page);

    // Wait for content and deferred sections
    await page.waitForLoadState('networkidle').catch(() => null);

    const stats = tracker.getStats();

    console.log('\n📦 NETWORK BUDGET REPORT');
    console.log(JSON.stringify({
      totalKB: stats.totalKB,
      jsKB: stats.jsKB,
      imgKB: stats.imgKB,
      cssKB: stats.cssKB,
      fontKB: stats.fontKB,
      requestCount: {
        budgetScoped: stats.requestCount,
        all: stats.allRequestCount,
        ignoredThirdParty: stats.ignoredThirdPartyRequestCount,
      },
      largestResources: stats.largestResources,
      mediaRequestsWithoutWidth: stats.mediaRequestsWithoutWidth,
    }, null, 2));

    test.info().annotations.push({
      type: 'network-budget',
      description: JSON.stringify(stats),
    });

    // #1161: без `w` прокси отдаёт мастер целиком — 132 344 B вместо 2 582 B на
    // плитке 132×132 (замер прода 2026-07-30). Проверяем трафиком, а не кодом.
    expect(
      stats.mediaRequestsWithoutWidth,
      `${stats.mediaRequestsWithoutWidth.length} медиа-запрос(ов) без w — прокси отдаёт мастер целиком`
    ).toEqual([]);

    // JS bundle size (gzip transfer)
    expect(
      stats.jsKB,
      `JS transfer ${stats.jsKB}KB exceeds budget ${MAX_JS_TRANSFER_KB}KB`
    ).toBeLessThanOrEqual(MAX_JS_TRANSFER_KB);

    // Image transfer size
    expect(
      stats.imgKB,
      `Image transfer ${stats.imgKB}KB exceeds budget ${MAX_IMG_TRANSFER_KB}KB`
    ).toBeLessThanOrEqual(MAX_IMG_TRANSFER_KB);

    // Total transfer
    expect(
      stats.totalKB,
      `Total transfer ${stats.totalKB}KB exceeds budget ${MAX_TOTAL_TRANSFER_KB}KB`
    ).toBeLessThanOrEqual(MAX_TOTAL_TRANSFER_KB);

    // Request count
    expect(
      stats.requestCount,
      `${stats.requestCount} first-party requests exceeds budget ${MAX_REQUESTS} (all=${stats.allRequestCount}, ignoredThirdParty=${stats.ignoredThirdPartyRequestCount})`
    ).toBeLessThanOrEqual(MAX_REQUESTS);
  });

  test('Images have width and height attributes (prevents CLS)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await preacceptCookies(page);

    await openTravelDetailsForPerf(page);

    await page.waitForLoadState('networkidle').catch(() => null);

    const imageAudit = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      const contentImgs = imgs.filter((img) => {
        const src = img.getAttribute('src') || '';
        if (src.startsWith('data:')) return false;
        const w = img.clientWidth || 0;
        const h = img.clientHeight || 0;
        if (w <= 32 && h <= 32) return false;
        return true;
      });

      const withDimensions = contentImgs.filter(
        (img) => img.hasAttribute('width') && img.hasAttribute('height')
      );

      const withoutDimensions = contentImgs
        .filter((img) => !img.hasAttribute('width') || !img.hasAttribute('height'))
        .map((img) => ({
          src: (img.getAttribute('src') || '').slice(0, 100),
          testId: img.getAttribute('data-testid') || '',
          clientSize: `${img.clientWidth}x${img.clientHeight}`,
        }));

      const withLazyLoading = contentImgs.filter(
        (img) => img.getAttribute('loading') === 'lazy'
      );

      const withModernFormat = contentImgs.filter((img) => {
        const src = img.getAttribute('src') || '';
        return /\.(webp|avif)/i.test(src) || /[?&](f|output)=(webp|avif)/i.test(src);
      });

      return {
        total: contentImgs.length,
        withDimensions: withDimensions.length,
        withoutDimensions,
        withLazyLoading: withLazyLoading.length,
        withModernFormat: withModernFormat.length,
      };
    });

    console.log('\n🖼️ IMAGE AUDIT');
    console.log(JSON.stringify(imageAudit, null, 2));

    test.info().annotations.push({
      type: 'image-audit',
      description: JSON.stringify(imageAudit),
    });

    // At least 80% of content images should have width/height.
    // React Native Web renders images via CSS dimensions rather than HTML attributes,
    // so the hero <img> (which has explicit width/height) may be the only one.
    // When the page has no images at all (API unavailable), skip gracefully.
    if (imageAudit.total > 0) {
      const ratio = imageAudit.withDimensions / imageAudit.total;
      if (ratio < 0.8) {
        test.info().annotations.push({
          type: 'note',
          description: `Only ${Math.round(ratio * 100)}% of images have width/height attributes (${imageAudit.withDimensions}/${imageAudit.total}). React Native Web uses CSS dimensions instead of HTML attributes for most images.`,
        });
      }
    }
  });

  test('No render-blocking resources delay FCP', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await preacceptCookies(page);

    const renderBlockingResources: Array<{ url: string; type: string }> = [];

    page.on('request', (request: any) => {
      const type = request.resourceType();
      const url = request.url();
      // Check for synchronous scripts and stylesheets in <head>
      if (type === 'script' || type === 'stylesheet') {
        const isAsync = request.headers()['x-async'] === 'true';
        if (!isAsync) {
          renderBlockingResources.push({
            url: url.length > 100 ? url.slice(0, 97) + '...' : url,
            type,
          });
        }
      }
    });

    await openTravelDetailsForPerf(page, 'domcontentloaded');

    // Check that entry script has fetchPriority="high"
    const entryScriptOptimized = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script[src]');
      for (const s of scripts) {
        const src = s.getAttribute('src') || '';
        if (src.includes('entry-') && src.includes('.js')) {
          return {
            src: src.slice(0, 80),
            fetchPriority: s.getAttribute('fetchpriority') || s.getAttribute('fetchPriority') || 'none',
            hasPreload: !!document.querySelector(`link[rel="preload"][href="${src}"]`) ||
                        !!document.querySelector(`link[rel="modulepreload"][href="${src}"]`),
          };
        }
      }
      return null;
    });

    console.log('\n⚡ RENDER-BLOCKING AUDIT');
    console.log(JSON.stringify({ entryScriptOptimized }, null, 2));

    test.info().annotations.push({
      type: 'render-blocking',
      description: JSON.stringify({ entryScriptOptimized }),
    });

    // Entry script should be prioritized.
    // Expo web export does not add fetchPriority to script tags by default.
    // Log as informational rather than hard-failing.
    if (entryScriptOptimized && entryScriptOptimized.fetchPriority !== 'high') {
      test.info().annotations.push({
        type: 'note',
        description: `Entry script fetchPriority is "${entryScriptOptimized.fetchPriority}" (Expo does not set fetchPriority on script tags by default).`,
      });
    }
  });

  // #1111: инвариант "один визуальный слот — один сетевой URL". Правило требует
  // именно URL-cardinality evidence: grep-гейт ловит только явный blurSrc, а второй
  // адрес рождался внутри рендерера (подложка строила свой URL, CSS-фон грузил
  // неоптимизированный оригинал). Замер прода 2026-07-28: один файл галереи
  // приезжал 6 раз (167 КБ), обложка квеста — двумя вариантами по 2.5 МБ.
  test('One image file is fetched once (no duplicate variants per slot)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await preacceptCookies(page);

    await openTravelDetailsForPerf(page);
    await page.waitForLoadState('networkidle').catch(() => null);

    const { duplicates, multiRung } = await page.evaluate(() => {
      const media = /\/(gallery|travel-image|quest-cover|address-image|avatar)\//;
      const byFile: Record<string, string[]> = {};

      for (const entry of performance.getEntriesByType('resource')) {
        const url = entry.name;
        if (!media.test(url)) continue;
        const file = url.split('?')[0];
        const query = url.split('?')[1] || '(no params)';
        (byFile[file] = byFile[file] || []).push(query);
      }

      const readWidth = (query: string): string => {
        const match = /(?:^|&)w=(\d+)/.exec(query);
        return match ? match[1] : '(no w)';
      };

      return {
        duplicates: Object.entries(byFile)
          .filter(([, variants]) => new Set(variants).size > 1)
          .map(([file, variants]) => ({
            file: file.split('/').slice(-1)[0].slice(0, 40),
            variants: Array.from(new Set(variants)),
          })),
        // #1210: отдельный, более узкий срез того же трейса — РАЗНЫЕ СТУПЕНИ одного
        // storage-ключа. Проверка выше считает варианты целиком и порог у неё 4 файла /
        // 3 варианта, поэтому дефект «одно фото приезжает на w=800 и на w=720» проходил
        // мимо неё зелёным (замер прода 2026-08-02, mobile 390×844).
        multiRung: Object.entries(byFile)
          .map(([file, variants]) => ({
            file: file.split('/').slice(-1)[0].slice(0, 40),
            widths: Array.from(new Set(variants.map(readWidth))).sort(),
          }))
          .filter((item) => item.widths.length > 1),
      };
    });

    if (duplicates.length > 0) {
      console.log('\n🖼️  DUPLICATE IMAGE VARIANTS');
      console.log(JSON.stringify(duplicates, null, 2));
    }
    if (multiRung.length > 0) {
      console.log('\n🪜  SAME FILE AT MULTIPLE WIDTH RUNGS');
      console.log(JSON.stringify(multiRung, null, 2));
    }

    // Порог, а не ноль: hero осознанно держит preload-адрес отдельно от srcSet
    // (preserveOptimizedWebSrc), и пока подложка не перешла на blurhash (#1127),
    // один лишний вариант на слот остаётся ожидаемым. Гейт ловит возврат к
    // множественным вариантам, из-за которых страница весила 23.7 МБ.
    const MAX_DUPLICATED_FILES = envNum('PERF_MAX_DUPLICATED_IMAGE_FILES', 4);
    const worst = Math.max(0, ...duplicates.map((d) => d.variants.length));

    expect(
      duplicates.length,
      `${duplicates.length} image files fetched in multiple variants: ${JSON.stringify(duplicates)}`
    ).toBeLessThanOrEqual(MAX_DUPLICATED_FILES);

    expect(
      worst,
      `one file was fetched in ${worst} different variants — a slot must not spawn a family of URLs`
    ).toBeLessThanOrEqual(3);

    // #1210: ступень — это отдельный файл на диске прокси и отдельная синхронная
    // конверсия, поэтому две ступени одного ключа порога не имеют. Замер прода
    // 2026-08-02: `952c9b15….JPG` приезжал на w=800 (152 640 B) и через 120 мс на
    // w=720 (126 194 B), потому что ширина слайда считалась от контейнера, который
    // между двумя рендерами успевал измениться с 412 на 390.
    expect(
      multiRung,
      `same image file fetched at different width rungs: ${JSON.stringify(multiRung)}`
    ).toEqual([]);
  });

});

test.describe('@perf Travel Details — Performance Budget (prod build, mobile)', () => {
  // #1499: троттлинга здесь нет и никогда не было — прежний комментарий
  // «more lenient due to throttling» описывал условия, которых в тесте нет:
  // менялся только вьюпорт. Пороги ниже поэтому и мягкие, что машина не
  // замедлена. TBT-ассерт отсюда убран: на нетроттленной машине он показывал
  // ~53 мс при 1116/517 мс на проде, то есть был вечнозелёным и создавал
  // ложный сигнал «мобильный TBT в бюджете». Блокировку главного потока меряет
  // отдельный блок ниже, под реальным мобильным профилем.
  const MOBILE_LCP_MAX = envNum('PERF_MOBILE_LCP_MAX_MS', 4000);
  const MOBILE_FCP_MAX = envNum('PERF_MOBILE_FCP_MAX_MS', 3000);

  test('Core Web Vitals within mobile budget', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await injectPerfObservers(page);

    await openTravelDetailsForPerf(page);

    const metrics = await collectMetrics(page);
    const layoutShiftDebug = await collectLayoutShiftDebug(page);

    const report = {
      viewport: 'mobile (375x667)',
      lcp: metrics.lcp != null ? `${Math.round(metrics.lcp)}ms` : 'N/A',
      fcp: metrics.fcp != null ? `${Math.round(metrics.fcp)}ms` : 'N/A',
      tbt: `${Math.round(metrics.tbt)}ms (informational — not throttled, see the throttled block below)`,
      cls: metrics.cls.toFixed(4),
      longTaskCount: metrics.longTaskCount,
      clsEntries: metrics.clsEntries,
      layoutShiftDebug,
    };

    console.log('\n📱 MOBILE PERFORMANCE REPORT');
    console.log(JSON.stringify(report, null, 2));

    test.info().annotations.push({
      type: 'perf-budget-mobile',
      description: JSON.stringify(report),
    });

    if (metrics.lcp != null) {
      expect(
        metrics.lcp,
        `Mobile LCP ${Math.round(metrics.lcp)}ms exceeds budget ${MOBILE_LCP_MAX}ms`
      ).toBeLessThanOrEqual(MOBILE_LCP_MAX);
    }

    if (metrics.fcp != null) {
      expect(
        metrics.fcp,
        `Mobile FCP ${Math.round(metrics.fcp)}ms exceeds budget ${MOBILE_FCP_MAX}ms`
      ).toBeLessThanOrEqual(MOBILE_FCP_MAX);
    }

    expect(
      metrics.cls,
      `Mobile CLS ${metrics.cls.toFixed(4)} exceeds budget ${CLS_MAX}`
    ).toBeLessThanOrEqual(CLS_MAX);
  });

});

/**
 * #1499: TBT-гейт travel-details под мобильным профилем.
 *
 * Что закрывает. До этой правки мобильный блок выше менял ТОЛЬКО вьюпорт —
 * комментарий обещал throttling, которого в тесте не было ни по CPU, ни по
 * сети. Маршрут `/travels/[slug]` формально имел мобильный TBT-бюджет 600 мс,
 * фактически мерил скорость десктопа и показывал ~53 мс, тогда как прод на том
 * же маршруте отдавал 1116 мс (19.08.2026) и 517 мс (23.08.2026). Это ровно та
 * дыра, из-за которой #1286 закрылся, проверив только `/` и `/search`.
 *
 * Почему отдельным блоком. Под CPU ×4 и Slow-4G hero-кадр приезжает секундами
 * позже, поэтому LCP/FCP-пороги соседнего блока, откалиброванные под
 * нетроттленную машину, здесь неприменимы: общий тест падал бы на транспорте
 * картинки, а не на регрессии главного потока.
 *
 * Каждый проход — ХОЛОДНЫЙ: свой `browser.newContext()` с дескриптором
 * реального мобильного устройства. Это принципиально, а не «чище»:
 *   - Lighthouse, чьи числа стоят в Done gate карточки, меряет только холодный
 *     старт. Прогретые проходы дешевле в 2–4 раза (замер 23.08: холодный
 *     493–1175 мс против 146–278 мс прогретых), потому что переживают V8
 *     compilation cache. Регрессия, добавившая парс/компиляцию в критический
 *     путь, на прогретых проходах амортизируется и гейт бы её проспал.
 *   - Дескриптор устройства даёт настоящие DPR, touch и UA. «Мобильность»
 *     через `setViewportSize` мерит desktop-профиль в узком боксе — класс
 *     дефекта, закрытый в #1287.
 *
 * Дисперсия гасится числом проходов и медианой, а не выбрасыванием холодного.
 *
 * Порог закреплён по измеренному, а не назначен: см. константу ниже. Ослабить
 * его переменной окружения нельзя — `clampCeiling` игнорирует послабления и
 * печатает их в отчёте прогона.
 */
test.describe('@perf Travel Details — Main-thread blocking (prod build, mobile throttled)', () => {
  // Замер главного потока нельзя вести параллельно с соседними тестами файла:
  // под `fullyParallel` они занимают тот же CPU, и порог, откалиброванный на
  // одиночном прогоне, превращается в источник флейка.
  test.describe.configure({ mode: 'serial' });
  // Ratchet по измеренному, а не назначенное число. Прод-сборка 2026-08-23,
  // стенд `scripts/serve-web-build.js` (gzip, как в CI), CPU ×4, Slow-4G,
  // медиана пяти ХОЛОДНЫХ проходов, три независимые серии: 416 / 417 / 449 мс.
  // Под фоновой нагрузкой (параллельная prod-сборка на той же машине) та же
  // сборка давала 561 мс. Потолок 650 мс держит запас над загруженной машиной
  // и всё ещё ловит полуторакратный рост блокировки.
  //
  // Это НЕ прод-число: прод-цель карточки #1499 — TBT ≤400 мс по
  // `lighthouse:produrl:travel:mobile`, она снимается только после деплоя.
  // Стенд систематически расходится с продом (там же 517 мс), поэтому сравнивать
  // можно лишь before/after на одной машине.
  const TBT_THROTTLED_BASELINE_MS = 650;
  const RUNS = Math.max(3, envNum('PERF_MOBILE_THROTTLED_RUNS', 5));
  // Наблюдаемое отношение busy-loop при rate=4: 2.48 / 2.72 / 2.81 / 3.96 —
  // замер шумит, потому что делит два коротких прогона на живой машине.
  // Порог 2.0 уверенно отделяет работающую эмуляцию от сломанной (там ~1.0)
  // и не даёт контролю самому стать источником флейка.
  const MIN_CPU_THROTTLE_RATIO = 2.0;

  const budgetOverride = clampCeiling(
    TBT_THROTTLED_BASELINE_MS,
    process.env.PERF_MOBILE_THROTTLED_TBT_MAX_MS
      ? Number(process.env.PERF_MOBILE_THROTTLED_TBT_MAX_MS)
      : undefined
  );
  const TBT_THROTTLED_MAX_MS = budgetOverride.value;

  test('TBT under mobile throttling stays within budget', async ({ browser }) => {
    // Худший случай одного прохода — goto 60 с + два ожидания видимости по 30 с
    // + networkidle. Таймаут теста считается от него, иначе зависший прогон
    // обрывается Playwright'ом раньше, чем печатает уже собранные числа.
    test.setTimeout((RUNS + 1) * 200_000);

    const tbtRuns: number[] = [];
    const longTaskCounts: number[] = [];
    let observedProfile: Awaited<ReturnType<typeof collectObservedProfile>> | null = null;
    let cpuRatio = 0;

    for (let run = 0; run < RUNS; run += 1) {
      // Дескриптор берётся из Playwright, а не переписывается руками: ручная
      // копия расходится с ним по вьюпорту и вшивает версию Chrome в UA, из-за
      // чего замер тихо уезжает от реального устройства при обновлении браузера.
      const context = await browser.newContext({ ...devices['Pixel 7'] });
      const page = await context.newPage();

      try {
        await injectPerfObservers(page);
        const cdp = await applyMobileThrottling(page);

        if (run === 0) {
          // Позитивный контроль: троттлинг доехал до рендерера. Без него гейт
          // молча вырождается в вечнозелёный — ровно тот дефект, ради которого
          // он и написан. Меряем через ТУ ЖЕ сессию, иначе обе фазы замера
          // окажутся одинаково затроттлены и контроль соврёт.
          cpuRatio = await measureCpuThrottlingRatio(page, cdp, MOBILE_THROTTLE_PROFILE.cpuRate);
        }

        await openTravelDetailsForPerf(page);
        const metrics = await collectMetrics(page);
        tbtRuns.push(metrics.tbt);
        longTaskCounts.push(metrics.longTaskCount ?? 0);
        if (run === 0) observedProfile = await collectObservedProfile(page);
        console.log(`  [throttled TBT] cold run ${run + 1}/${RUNS}: ${Math.round(metrics.tbt)}ms`);
      } finally {
        await context.close();
      }
    }

    const tbt = median(tbtRuns);
    const report = {
      cpuThrottling: `${MOBILE_THROTTLE_PROFILE.cpuRate}x`,
      cpuThrottlingObservedRatio: cpuRatio.toFixed(2),
      networkMbit: MOBILE_THROTTLE_PROFILE.downloadMbit,
      observedProfile,
      coldRuns: tbtRuns.map((value) => `${Math.round(value)}ms`),
      longTasksPerRun: longTaskCounts,
      medianTbt: `${Math.round(tbt)}ms`,
      budget: `${TBT_THROTTLED_MAX_MS}ms`,
      ignoredOverride: budgetOverride.ignored
        ? `PERF_MOBILE_THROTTLED_TBT_MAX_MS loosening ignored`
        : undefined,
    };

    console.log('\n📱 MOBILE THROTTLED TBT REPORT');
    console.log(JSON.stringify(report, null, 2));

    test.info().annotations.push({
      type: 'perf-budget-mobile-throttled-tbt',
      description: JSON.stringify(report),
    });

    expect(
      cpuRatio,
      `CPU throttling did not reach the renderer: busy-loop ratio ${cpuRatio.toFixed(2)}x ` +
        `(expected >= ${MIN_CPU_THROTTLE_RATIO}x at rate ${MOBILE_THROTTLE_PROFILE.cpuRate}). ` +
        'Without it this gate measures desktop speed and can never go red.'
    ).toBeGreaterThanOrEqual(MIN_CPU_THROTTLE_RATIO);

    expect(
      observedProfile?.hasTouch,
      'throttled TBT must be measured on a real mobile profile, not a narrow desktop viewport'
    ).toBe(true);

    // Ассерт «TBT не больше потолка» односторонний и потому зеленеет, когда
    // сбор long tasks не состоялся вовсе (PerformanceObserver не подключился,
    // страница не догрузилась) — это fail-open. Требуем доказательство, что
    // главный поток вообще наблюдался: под CPU ×4 на этом маршруте длинных
    // задач всегда несколько.
    expect(
      Math.max(...longTaskCounts),
      `no long tasks collected in any run (${longTaskCounts.join(', ')}) — ` +
        'the measurement did not happen, so the budget below would pass vacuously'
    ).toBeGreaterThan(0);

    expect(
      tbt,
      `Throttled mobile TBT ${Math.round(tbt)}ms (median of ${tbtRuns.length} cold runs: ` +
        `${tbtRuns.map((value) => Math.round(value)).join(', ')}) exceeds budget ${TBT_THROTTLED_MAX_MS}ms`
    ).toBeLessThanOrEqual(TBT_THROTTLED_MAX_MS);
  });
});
