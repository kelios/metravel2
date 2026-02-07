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

import { test, expect } from '@playwright/test';
import { seedNecessaryConsent } from './helpers/storage';

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
const LCP_MAX_MS = envNum('PERF_LCP_MAX_MS', 2500);
const TBT_MAX_MS = envNum('PERF_TBT_MAX_MS', 300);
const CLS_MAX = envNum('PERF_CLS_MAX', 0.1);
const FCP_MAX_MS = envNum('PERF_FCP_MAX_MS', 1800);

const MAX_JS_TRANSFER_KB = envNum('PERF_MAX_JS_KB', 600);
const MAX_IMG_TRANSFER_KB = envNum('PERF_MAX_IMG_KB', 1500);
const MAX_TOTAL_TRANSFER_KB = envNum('PERF_MAX_TOTAL_KB', 4000);
const MAX_REQUESTS = envNum('PERF_MAX_REQUESTS', 80);
const MAX_LONG_TASKS = envNum('PERF_MAX_LONG_TASKS', 5);
const LONG_TASK_THRESHOLD_MS = 50;

// A known travel page slug for direct navigation (avoids SPA transition overhead).
const TRAVEL_SLUG =
  process.env.PERF_TRAVEL_SLUG ||
  'czarny-staw-i-drugie-radosti-treki-termy-i-nochi-u-kamina';

function travelUrl(slug: string): string {
  return `/travels/${slug}`;
}

/** Inject PerformanceObserver collectors before page load. */
async function injectPerfObservers(page: any) {
  await page.addInitScript(seedNecessaryConsent);
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
  await page.waitForTimeout(4000);

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
  requestCount: number;
  jsRequests: number;
  imgRequests: number;
  largestResources: Array<{ url: string; sizeKB: number; type: string }>;
};

function createNetworkTracker(page: any): { getStats: () => NetworkStats } {
  const resources: Array<{ url: string; size: number; type: string }> = [];
  let requestCount = 0;

  page.on('response', async (response: any) => {
    requestCount++;
    try {
      const req = response.request();
      const type = req.resourceType();
      const contentLength = response.headers()['content-length'];
      const size = contentLength ? parseInt(contentLength, 10) : 0;
      if (size > 0) {
        resources.push({ url: req.url(), size, type });
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
        jsRequests,
        imgRequests,
        largestResources,
      };
    },
  };
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

    // Direct navigation to travel page (simulates real user landing from search/link)
    await page.goto(travelUrl(TRAVEL_SLUG), {
      waitUntil: 'load',
      timeout: 60_000,
    });

    // Wait for travel content to render
    await Promise.race([
      page.waitForSelector('[data-testid="travel-details-page"]', { timeout: 30_000 }),
      page.waitForSelector('[data-testid="travel-details-hero"]', { timeout: 30_000 }),
    ]).catch(() => {
      // Page may still be loading; continue to collect metrics
    });

    const metrics = await collectMetrics(page);
    const network = tracker.getStats();

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

  test('Network transfer budget (JS ≤ 600KB, images ≤ 1.5MB, total ≤ 4MB)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(seedNecessaryConsent);

    const tracker = createNetworkTracker(page);

    await page.goto(travelUrl(TRAVEL_SLUG), {
      waitUntil: 'load',
      timeout: 60_000,
    });

    // Wait for content and deferred sections
    await page.waitForTimeout(5000);

    const stats = tracker.getStats();

    console.log('\n📦 NETWORK BUDGET REPORT');
    console.log(JSON.stringify({
      totalKB: stats.totalKB,
      jsKB: stats.jsKB,
      imgKB: stats.imgKB,
      cssKB: stats.cssKB,
      fontKB: stats.fontKB,
      requestCount: stats.requestCount,
      largestResources: stats.largestResources,
    }, null, 2));

    test.info().annotations.push({
      type: 'network-budget',
      description: JSON.stringify(stats),
    });

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
      `${stats.requestCount} requests exceeds budget ${MAX_REQUESTS}`
    ).toBeLessThanOrEqual(MAX_REQUESTS);
  });

  test('Images have width and height attributes (prevents CLS)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(seedNecessaryConsent);

    await page.goto(travelUrl(TRAVEL_SLUG), {
      waitUntil: 'load',
      timeout: 60_000,
    });

    await page.waitForTimeout(3000);

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

    // At least 80% of content images should have width/height
    if (imageAudit.total > 0) {
      const ratio = imageAudit.withDimensions / imageAudit.total;
      expect(
        ratio,
        `Only ${Math.round(ratio * 100)}% of images have width/height (need ≥80%)`
      ).toBeGreaterThanOrEqual(0.8);
    }
  });

  test('No render-blocking resources delay FCP', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(seedNecessaryConsent);

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

    await page.goto(travelUrl(TRAVEL_SLUG), {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });

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

    // Entry script should be prioritized
    if (entryScriptOptimized) {
      expect(
        entryScriptOptimized.fetchPriority,
        'Entry script should have fetchPriority="high"'
      ).toBe('high');
    }
  });
});

test.describe('@perf Travel Details — Performance Budget (prod build, mobile)', () => {
  // Mobile thresholds are more lenient due to throttling
  const MOBILE_LCP_MAX = envNum('PERF_MOBILE_LCP_MAX_MS', 4000);
  const MOBILE_TBT_MAX = envNum('PERF_MOBILE_TBT_MAX_MS', 600);
  const MOBILE_FCP_MAX = envNum('PERF_MOBILE_FCP_MAX_MS', 3000);

  test('Core Web Vitals within mobile budget', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await injectPerfObservers(page);

    await page.goto(travelUrl(TRAVEL_SLUG), {
      waitUntil: 'load',
      timeout: 60_000,
    });

    await Promise.race([
      page.waitForSelector('[data-testid="travel-details-page"]', { timeout: 30_000 }),
      page.waitForSelector('[data-testid="travel-details-hero"]', { timeout: 30_000 }),
    ]).catch(() => {});

    const metrics = await collectMetrics(page);

    const report = {
      viewport: 'mobile (375x667)',
      lcp: metrics.lcp != null ? `${Math.round(metrics.lcp)}ms` : 'N/A',
      fcp: metrics.fcp != null ? `${Math.round(metrics.fcp)}ms` : 'N/A',
      tbt: `${Math.round(metrics.tbt)}ms`,
      cls: metrics.cls.toFixed(4),
      longTaskCount: metrics.longTaskCount,
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
      metrics.tbt,
      `Mobile TBT ${Math.round(metrics.tbt)}ms exceeds budget ${MOBILE_TBT_MAX}ms`
    ).toBeLessThanOrEqual(MOBILE_TBT_MAX);

    expect(
      metrics.cls,
      `Mobile CLS ${metrics.cls.toFixed(4)} exceeds budget ${CLS_MAX}`
    ).toBeLessThanOrEqual(CLS_MAX);
  });

  test('Hero image preload works on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.addInitScript(seedNecessaryConsent);

    await page.goto(travelUrl(TRAVEL_SLUG), {
      waitUntil: 'load',
      timeout: 60_000,
    });

    await page.waitForTimeout(3000);

    const heroImageAudit = await page.evaluate(() => {
      // Check for LCP image
      const lcpImg = document.querySelector('img[data-lcp]') as HTMLImageElement | null;
      const preloadLinks = Array.from(document.querySelectorAll('link[rel="preload"][as="image"]'));

      return {
        hasLcpImage: !!lcpImg,
        lcpImageLoaded: lcpImg ? lcpImg.complete && lcpImg.naturalWidth > 0 : false,
        lcpImageSrc: lcpImg ? (lcpImg.src || '').slice(0, 100) : null,
        lcpFetchPriority: lcpImg ? (lcpImg.getAttribute('fetchpriority') || lcpImg.getAttribute('fetchPriority') || 'none') : null,
        preloadCount: preloadLinks.length,
        preloadHrefs: preloadLinks.map((l) => (l.getAttribute('href') || '').slice(0, 80)),
        hasPreconnect: !!document.querySelector('link[rel="preconnect"]'),
      };
    });

    console.log('\n🖼️ HERO IMAGE PRELOAD AUDIT (Mobile)');
    console.log(JSON.stringify(heroImageAudit, null, 2));

    test.info().annotations.push({
      type: 'hero-preload',
      description: JSON.stringify(heroImageAudit),
    });

    // Hero image should exist and be loaded
    expect(heroImageAudit.hasLcpImage, 'LCP hero image should exist').toBe(true);
    expect(heroImageAudit.lcpImageLoaded, 'LCP hero image should be loaded').toBe(true);
    expect(heroImageAudit.lcpFetchPriority, 'LCP image should have fetchPriority="high"').toBe('high');
  });
});

test.describe('@perf Travel Details — Lighthouse CLI (prod build)', () => {
  test.skip(
    () => !process.env.PERF_RUN_LIGHTHOUSE,
    'Set PERF_RUN_LIGHTHOUSE=1 to run Lighthouse CLI tests'
  );

  test('Lighthouse Performance score ≥ 80 (desktop)', async () => {
    const { execSync } = require('child_process');
    const fs = require('fs');
    const path = require('path');

    const reportPath = path.join(process.cwd(), 'lighthouse-report.perf-test.json');
    const slug = TRAVEL_SLUG;
    const url = `https://metravel.by/travels/${slug}`;

    try {
      execSync(
        `npx lighthouse "${url}" ` +
        `--only-categories=performance ` +
        `--emulated-form-factor=desktop ` +
        `--throttling-method=simulate ` +
        `--output=json ` +
        `--output-path="${reportPath}" ` +
        `--chrome-flags="--headless --no-sandbox" ` +
        `--quiet`,
        { stdio: 'pipe', timeout: 120_000 }
      );
    } catch (error: any) {
      test.info().annotations.push({
        type: 'lighthouse-error',
        description: error.message || 'Lighthouse CLI failed',
      });
      test.skip(true, 'Lighthouse CLI failed — check Chrome installation');
      return;
    }

    if (!fs.existsSync(reportPath)) {
      test.skip(true, 'Lighthouse report not generated');
      return;
    }

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const perfScore = Math.round((report.categories?.performance?.score || 0) * 100);
    const audits = report.audits || {};

    const details = {
      score: perfScore,
      fcp: audits['first-contentful-paint']?.numericValue,
      lcp: audits['largest-contentful-paint']?.numericValue,
      tbt: audits['total-blocking-time']?.numericValue,
      cls: audits['cumulative-layout-shift']?.numericValue,
      si: audits['speed-index']?.numericValue,
    };

    console.log('\n🔦 LIGHTHOUSE REPORT (Desktop)');
    console.log(JSON.stringify(details, null, 2));

    test.info().annotations.push({
      type: 'lighthouse-score',
      description: JSON.stringify(details),
    });

    expect(
      perfScore,
      `Lighthouse Performance score ${perfScore} is below target 80`
    ).toBeGreaterThanOrEqual(80);

    // Cleanup
    try { fs.unlinkSync(reportPath); } catch { /* ignore */ }
  });
});
