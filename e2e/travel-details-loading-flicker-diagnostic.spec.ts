import fs from 'node:fs/promises';

import { test, expect } from '@playwright/test';

import { preacceptCookies } from './helpers/navigation';

const DEFAULT_TRAVEL_DIAGNOSTIC_PATH =
  '/travels/marshrut-v-beskidakh-ot-parkovki-do-smotrovoi-cherez-vodopad';
const DEFAULT_BASE_URL = process.env.BASE_URL || 'http://localhost:8081';
const TARGET_URL =
  process.env.E2E_TRAVEL_DIAGNOSTIC_URL ||
  new URL(DEFAULT_TRAVEL_DIAGNOSTIC_PATH, DEFAULT_BASE_URL).toString();

const SCREENSHOT_TIMELINE_MS = [0, 300, 700, 1200, 2000, 3200];
const CPU_THROTTLE_RATE = Number(process.env.E2E_CPU_THROTTLE_RATE || 4);
const SLOW_3G = {
  offline: false,
  downloadThroughput: ((500 * 1024) / 8) * 0.8,
  uploadThroughput: ((500 * 1024) / 8) * 0.8,
  latency: 400,
};

test.use({ trace: 'off' });

type ShiftSource = {
  label: string;
  text: string;
  html: string;
  rect: { x: number; y: number; width: number; height: number } | null;
};

type LayoutShiftRecord = {
  value: number;
  startTime: number;
  hadRecentInput: boolean;
  sources: ShiftSource[];
  viewport: { width: number; height: number };
  scrollY: number;
};

async function captureTimelineScreenshots(page: any, testInfo: any) {
  const startedAt = Date.now();
  for (const ms of SCREENSHOT_TIMELINE_MS) {
    const waitMs = startedAt + ms - Date.now();
    if (waitMs > 0) {
      await page.waitForTimeout(waitMs);
    }
    const shotPath = testInfo.outputPath(`timeline-${String(ms).padStart(4, '0')}ms.png`);
    await page.screenshot({ path: shotPath, fullPage: false });
    await testInfo.attach(`timeline-${ms}ms`, {
      path: shotPath,
      contentType: 'image/png',
    });
  }
}

test.describe('@perf travel details loading flicker diagnostic', () => {
  test('records CLS, trace, video and loading timeline for travel details', async ({
    browser,
  }, testInfo) => {
    test.setTimeout(180_000);

    const videoDir = testInfo.outputPath('video');
    await fs.mkdir(videoDir, { recursive: true });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      recordVideo: {
        dir: videoDir,
        size: { width: 1440, height: 900 },
      },
      serviceWorkers: 'block',
      colorScheme: 'light',
    });

    const page = await context.newPage();
    await preacceptCookies(page);

    const consoleLines: string[] = [];
    page.on('console', (msg) => {
      consoleLines.push(`[${msg.type()}] ${msg.text()}`);
    });

    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', SLOW_3G);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE_RATE });

    await context.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: true,
    });

    await page.addInitScript(() => {
      const describeNode = (node: any) => {
        try {
          if (!node) return null;
          const el = node as HTMLElement;
          const tag = (el.tagName || 'unknown').toLowerCase();
          const testId = el.getAttribute?.('data-testid') || '';
          const id = el.id || '';
          const className = typeof el.className === 'string' ? el.className.trim() : '';
          const text = String(el.innerText || el.textContent || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 120);
          const rectRaw = el.getBoundingClientRect?.();
          const rect = rectRaw
            ? {
                x: Number(rectRaw.x.toFixed(1)),
                y: Number(rectRaw.y.toFixed(1)),
                width: Number(rectRaw.width.toFixed(1)),
                height: Number(rectRaw.height.toFixed(1)),
              }
            : null;
          const labelParts = [tag];
          if (testId) labelParts.push(`[data-testid="${testId}"]`);
          if (id) labelParts.push(`#${id}`);
          if (className) labelParts.push(`.${className.split(/\s+/).slice(0, 3).join('.')}`);
          return {
            label: labelParts.join(''),
            text,
            html: (el.outerHTML || '').slice(0, 240),
            rect,
          };
        } catch {
          return null;
        }
      };

      (window as any).__tdDiag = {
        shifts: [] as any[],
        cls: 0,
        lcp: null as number | null,
        fcp: null as number | null,
        longTasks: [] as Array<{ startTime: number; duration: number }>,
        paints: [] as Array<{ name: string; startTime: number }>,
      };

      try {
        const paintEntries = performance.getEntriesByType('paint') as PerformanceEntry[];
        (window as any).__tdDiag.paints = paintEntries.map((entry) => ({
          name: entry.name,
          startTime: entry.startTime,
        }));
        const fcp = paintEntries.find((entry) => entry.name === 'first-contentful-paint');
        (window as any).__tdDiag.fcp = typeof fcp?.startTime === 'number' ? fcp.startTime : null;
      } catch {
        // noop
      }

      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as any[]) {
            if (!entry || entry.hadRecentInput || typeof entry.value !== 'number') continue;
            const record = {
              value: entry.value,
              startTime: entry.startTime,
              hadRecentInput: !!entry.hadRecentInput,
              viewport: {
                width: window.innerWidth,
                height: window.innerHeight,
              },
              scrollY: window.scrollY,
              sources: Array.isArray(entry.sources)
                ? entry.sources
                    .map((source: any) => describeNode(source?.node))
                    .filter(Boolean)
                : [],
            };
            (window as any).__tdDiag.shifts.push(record);
            (window as any).__tdDiag.cls += entry.value;
            console.log(`TD_LAYOUT_SHIFT ${JSON.stringify(record)}`);
          }
        }).observe({ type: 'layout-shift', buffered: true } as any);
      } catch {
        // noop
      }

      try {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1] as any;
          if (!last || typeof last.startTime !== 'number') return;
          (window as any).__tdDiag.lcp = last.startTime;
          console.log(`TD_LCP ${JSON.stringify({ startTime: last.startTime, size: last.size || null })}`);
        }).observe({ type: 'largest-contentful-paint', buffered: true } as any);
      } catch {
        // noop
      }

      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as any[]) {
            if (!entry || typeof entry.duration !== 'number') continue;
            (window as any).__tdDiag.longTasks.push({
              startTime: entry.startTime,
              duration: entry.duration,
            });
          }
        }).observe({ type: 'longtask', buffered: true } as any);
      } catch {
        // noop
      }
    });

    const timelinePromise = captureTimelineScreenshots(page, testInfo);

    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await Promise.race([
      page.waitForSelector('[data-testid="travel-details-page"]', { timeout: 45_000 }),
      page.waitForSelector('[data-testid="travel-details-hero"]', { timeout: 45_000 }),
    ]);

    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => null);
    await page.waitForTimeout(3500);
    await timelinePromise;

    const metrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      const state = (window as any).__tdDiag || {};
      return {
        url: window.location.href,
        cls: typeof state.cls === 'number' ? state.cls : 0,
        lcp: typeof state.lcp === 'number' ? state.lcp : null,
        fcp: typeof state.fcp === 'number' ? state.fcp : null,
        shifts: Array.isArray(state.shifts) ? state.shifts : [],
        longTasks: Array.isArray(state.longTasks) ? state.longTasks : [],
        paints: Array.isArray(state.paints) ? state.paints : [],
        navigation: nav
          ? {
              domContentLoaded: nav.domContentLoadedEventEnd - nav.fetchStart,
              loadEvent: nav.loadEventEnd - nav.fetchStart,
              responseStart: nav.responseStart - nav.fetchStart,
            }
          : null,
      };
    });

    const shifts = (metrics.shifts as LayoutShiftRecord[])
      .filter((entry) => entry.value > 0)
      .sort((a, b) => b.value - a.value);

    const summary = {
      ...metrics,
      shiftCount: shifts.length,
      topShifts: shifts.slice(0, 10),
      worstShiftMomentsMs: shifts.slice(0, 10).map((entry) => Number(entry.startTime.toFixed(1))),
    };

    const metricsPath = testInfo.outputPath('travel-details-flicker-diagnostic.json');
    await fs.writeFile(metricsPath, JSON.stringify(summary, null, 2), 'utf8');
    await testInfo.attach('travel-details-flicker-diagnostic', {
      path: metricsPath,
      contentType: 'application/json',
    });

    const consolePath = testInfo.outputPath('travel-details-flicker-console.log');
    await fs.writeFile(consolePath, consoleLines.join('\n'), 'utf8');
    await testInfo.attach('travel-details-flicker-console', {
      path: consolePath,
      contentType: 'text/plain',
    });

    const finalPath = testInfo.outputPath('travel-details-final.png');
    await page.screenshot({ path: finalPath, fullPage: true });
    await testInfo.attach('travel-details-final', {
      path: finalPath,
      contentType: 'image/png',
    });

    const tracePath = testInfo.outputPath('travel-details-flicker-trace.zip');
    await context.tracing.stop({ path: tracePath });
    await testInfo.attach('travel-details-flicker-trace', {
      path: tracePath,
      contentType: 'application/zip',
    });

    await expect(metrics.url).toContain('/travels/');

    await page.close();
    await context.close();
  });
});
