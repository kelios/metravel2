import { test } from '@playwright/test';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

const URL = process.env.AUDIT_URL || 'http://localhost:8081/travels/kostel-svyatogo-antoniya-paduanskogo';
const SHOTS_DIR = join(__dirname, '_flicker-shots');
const KEEP_SHOTS = process.env.AUDIT_KEEP_SHOTS === '1';

test.afterAll(() => {
  if (!KEEP_SHOTS) {
    rmSync(SHOTS_DIR, { recursive: true, force: true });
  }
});

test('flicker audit: production travel detail', async ({ page }) => {
  test.setTimeout(120_000);

  // Slow 4G-ish to magnify jank
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 60,
    downloadThroughput: (4 * 1024 * 1024) / 8,
    uploadThroughput: (1 * 1024 * 1024) / 8,
  });

  await page.addInitScript(() => {
    (window as any).__cls = 0;
    (window as any).__shifts = [];
    (window as any).__longTasks = [];
    (window as any).__paints = [];
    (window as any).__lcp = null;

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any[]) {
        if (!entry.hadRecentInput) {
          (window as any).__cls += entry.value;
          (window as any).__shifts.push({
            t: Math.round(entry.startTime),
            value: +entry.value.toFixed(4),
            sources: (entry.sources || []).map((s: any) => {
              const n = s.node as Element | null;
              const r = s.currentRect || {};
              const p = s.previousRect || {};
              return {
                tag: n ? (n as any).tagName : null,
                id: n ? (n as any).id : null,
                cls: n ? ((n as any).className?.toString?.().slice(0, 80)) : null,
                from: `${Math.round(p.x)},${Math.round(p.y)} ${Math.round(p.width)}x${Math.round(p.height)}`,
                to:   `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`,
              };
            }),
          });
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any[]) {
        (window as any).__longTasks.push({ t: Math.round(entry.startTime), dur: Math.round(entry.duration) });
      }
    }).observe({ type: 'longtask', buffered: true });

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any[]) {
        (window as any).__paints.push({ name: entry.name, t: Math.round(entry.startTime) });
      }
    }).observe({ type: 'paint', buffered: true });

    new PerformanceObserver((list) => {
      const entries = list.getEntries() as any[];
      const last = entries[entries.length - 1];
      if (last) {
        (window as any).__lcp = {
          t: Math.round(last.startTime),
          size: last.size,
          element: last.element ? (last.element.tagName + (last.element.id ? '#' + last.element.id : '')) : null,
          url: last.url || null,
        };
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });

  const isMobile = process.env.AUDIT_MOBILE === '1';
  await page.setViewportSize(isMobile ? { width: 390, height: 844 } : { width: 1280, height: 800 });
  if (isMobile) {
    await page.context().setExtraHTTPHeaders({});
    await page.emulateMedia({ media: 'screen' });
  }

  const t0 = Date.now();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });

  // Capture sequential screenshots to see flicker
  const shots: { ms: number }[] = [];
  for (const ms of [200, 500, 800, 1200, 1800, 2500, 3500, 5000, 7000, 9000]) {
    const wait = ms - (Date.now() - t0);
    if (wait > 0) await page.waitForTimeout(wait);
    await page.screenshot({ path: `e2e/_flicker-shots/${String(ms).padStart(5, '0')}.png`, fullPage: false });
    shots.push({ ms });
  }

  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const data = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    return {
      cls: +((window as any).__cls).toFixed(4),
      shifts: (window as any).__shifts,
      longTasks: (window as any).__longTasks,
      paints: (window as any).__paints,
      lcp: (window as any).__lcp,
      nav: nav ? {
        ttfb: Math.round(nav.responseStart),
        domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
        load: Math.round(nav.loadEventEnd),
        transferSize: nav.transferSize,
      } : null,
      docHeight: document.documentElement.scrollHeight,
      heroImg: (() => {
        const img = document.querySelector('img');
        if (!img) return null;
        const r = img.getBoundingClientRect();
        return { src: img.currentSrc?.slice(0, 120), w: Math.round(r.width), h: Math.round(r.height), naturalW: img.naturalWidth, naturalH: img.naturalHeight, loading: img.loading };
      })(),
      fonts: (document as any).fonts ? Array.from((document as any).fonts).slice(0,8).map((f: any) => ({ family: f.family, status: f.status, weight: f.weight })) : [],
      // sample layout: any elements without explicit dimensions in viewport that contain images
      suspectImgs: Array.from(document.querySelectorAll('img')).slice(0, 12).map(img => {
        const cs = getComputedStyle(img);
        const parent = img.parentElement;
        const ps = parent ? getComputedStyle(parent) : null;
        return {
          src: (img.currentSrc || img.src || '').slice(0, 100),
          width: cs.width, height: cs.height, aspectRatio: cs.aspectRatio,
          loading: img.loading, decoding: img.decoding,
          parentMinH: ps?.minHeight, parentH: ps?.height,
        };
      }),
    };
  });

  console.log('=== FLICKER AUDIT REPORT ===');
  console.log(JSON.stringify(data, null, 2));
});
