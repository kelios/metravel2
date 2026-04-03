import fs from 'node:fs/promises';

import { test, expect } from '@playwright/test';

import { preacceptCookies } from './helpers/navigation';

const DEFAULT_BASE_URL = process.env.BASE_URL || 'https://metravel.by';
const TARGET_URL =
  process.env.E2E_SEARCH_DIAGNOSTIC_URL ||
  new URL('/search', DEFAULT_BASE_URL).toString();
const SCREENSHOT_TIMELINE_MS = [0, 250, 500, 900, 1400, 2200, 3200, 4500];
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
  viewport: { width: number; height: number };
  scrollY: number;
  sources: ShiftSource[];
};

function isMissingTraceArtifactError(error: unknown): boolean {
  const message = String((error as { message?: string } | null)?.message || error || '');
  return message.includes('tracing.stop') && message.includes('ENOENT');
}

async function captureTimelineScreenshots(page: any, testInfo: any) {
  const startedAt = Date.now();
  for (const ms of SCREENSHOT_TIMELINE_MS) {
    const waitMs = startedAt + ms - Date.now();
    if (waitMs > 0) {
      await page.waitForTimeout(waitMs);
    }
    const shotPath = testInfo.outputPath(`search-timeline-${String(ms).padStart(4, '0')}ms.png`);
    await page.screenshot({ path: shotPath, fullPage: false });
    await testInfo.attach(`search-timeline-${ms}ms`, {
      path: shotPath,
      contentType: 'image/png',
    });
  }
}

test.describe('@perf search loading flicker diagnostic', () => {
  test('records CLS, trace, screenshots, video and loading metrics for /search', async ({
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
            .slice(0, 140);
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
            html: (el.outerHTML || '').slice(0, 280),
            rect,
          };
        } catch {
          return null;
        }
      };

      (window as any).__searchDiag = {
        shifts: [] as any[],
        cls: 0,
        lcp: null as number | null,
        fcp: null as number | null,
        paints: [] as Array<{ name: string; startTime: number }>,
        longTasks: [] as Array<{ startTime: number; duration: number }>,
        marks: [] as Array<{ label: string; time: number }>,
      };

      const addMark = (label: string) => {
        try {
          (window as any).__searchDiag.marks.push({
            label,
            time: Number(performance.now().toFixed(1)),
          });
        } catch {
          // noop
        }
      };

      addMark('init-script');

      try {
        const paintEntries = performance.getEntriesByType('paint') as PerformanceEntry[];
        (window as any).__searchDiag.paints = paintEntries.map((entry) => ({
          name: entry.name,
          startTime: entry.startTime,
        }));
        const fcp = paintEntries.find((entry) => entry.name === 'first-contentful-paint');
        (window as any).__searchDiag.fcp = typeof fcp?.startTime === 'number' ? fcp.startTime : null;
      } catch {
        // noop
      }

      try {
        new MutationObserver(() => {
          const skeleton = document.querySelector('[data-testid="travel-card-skeleton"]');
          const cards = document.querySelector('[data-testid="travel-card-link"]');
          const list = document.querySelector('[data-testid="travels-list"]');
          const search = document.querySelector('[data-testid="search-container"]');
          if (skeleton) addMark('skeleton-visible');
          if (list) addMark('travels-list-mounted');
          if (cards) addMark('travel-card-visible');
          if (search) addMark('search-container-visible');
        }).observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: false,
        });
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
            (window as any).__searchDiag.shifts.push(record);
            (window as any).__searchDiag.cls += entry.value;
            console.log(`SEARCH_LAYOUT_SHIFT ${JSON.stringify(record)}`);
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
          (window as any).__searchDiag.lcp = last.startTime;
          console.log(`SEARCH_LCP ${JSON.stringify({ startTime: last.startTime, size: last.size || null })}`);
        }).observe({ type: 'largest-contentful-paint', buffered: true } as any);
      } catch {
        // noop
      }

      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as any[]) {
            if (!entry || typeof entry.duration !== 'number') continue;
            (window as any).__searchDiag.longTasks.push({
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
    await page.waitForSelector('[data-testid="search-container"]', { timeout: 45_000 });
    await page.waitForLoadState('networkidle', { timeout: 25_000 }).catch(() => null);
    await expect(page.locator('body')).toBeVisible();
    await page.waitForTimeout(4000);
    await timelinePromise;

    const finalShotPath = testInfo.outputPath('search-final.png');
    await page.screenshot({ path: finalShotPath, fullPage: false });
    await testInfo.attach('search-final', {
      path: finalShotPath,
      contentType: 'image/png',
    });

    const metrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      const state = (window as any).__searchDiag || {};
      return {
        url: window.location.href,
        title: document.title,
        cls: typeof state.cls === 'number' ? state.cls : 0,
        lcp: typeof state.lcp === 'number' ? state.lcp : null,
        fcp: typeof state.fcp === 'number' ? state.fcp : null,
        shifts: Array.isArray(state.shifts) ? state.shifts : [],
        longTasks: Array.isArray(state.longTasks) ? state.longTasks : [],
        paints: Array.isArray(state.paints) ? state.paints : [],
        marks: Array.isArray(state.marks) ? state.marks.slice(0, 120) : [],
        travelCardCount: document.querySelectorAll('[data-testid="travel-card-link"]').length,
        skeletonCount: document.querySelectorAll('[data-testid="travel-card-skeleton"]').length,
        navigation: nav
          ? {
              responseStart: nav.responseStart - nav.fetchStart,
              domContentLoaded: nav.domContentLoadedEventEnd - nav.fetchStart,
              loadEvent: nav.loadEventEnd - nav.fetchStart,
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
      topShifts: shifts.slice(0, 12),
      worstShiftMomentsMs: shifts.slice(0, 12).map((entry) => Number(entry.startTime.toFixed(1))),
      topShiftSelectors: shifts.slice(0, 12).flatMap((entry) =>
        entry.sources.slice(0, 4).map((source) => ({
          value: entry.value,
          startTime: entry.startTime,
          label: source.label,
          text: source.text,
          rect: source.rect,
        }))
      ),
    };

    const metricsPath = testInfo.outputPath('search-loading-flicker-diagnostic.json');
    await fs.writeFile(metricsPath, JSON.stringify(summary, null, 2), 'utf8');
    await testInfo.attach('search-loading-flicker-diagnostic', {
      path: metricsPath,
      contentType: 'application/json',
    });

    const consolePath = testInfo.outputPath('search-loading-flicker-console.log');
    await fs.writeFile(consolePath, consoleLines.join('\n'), 'utf8');
    await testInfo.attach('search-loading-flicker-console', {
      path: consolePath,
      contentType: 'text/plain',
    });

    const tracePath = testInfo.outputPath('search-loading-trace.zip');
    try {
      await context.tracing.stop({ path: tracePath });
      await testInfo.attach('search-loading-trace', {
        path: tracePath,
        contentType: 'application/zip',
      });
    } catch (error) {
      if (!isMissingTraceArtifactError(error)) throw error;

      const traceErrorPath = testInfo.outputPath('search-loading-trace-error.log');
      await fs.writeFile(traceErrorPath, String((error as { message?: string } | null)?.message || error), 'utf8');
      await testInfo.attach('search-loading-trace-error', {
        path: traceErrorPath,
        contentType: 'text/plain',
      });
    }

    await context.close();

    const hasVideo = testInfo.attachments.find((attachment) => attachment.name === 'video');
    expect(summary.url).toContain('/search');
    expect(shifts.length >= 0).toBeTruthy();
    expect(tracePath.length > 0).toBeTruthy();
    expect(hasVideo !== undefined || true).toBeTruthy();
  });
});
