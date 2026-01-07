import { test, expect } from '@playwright/test';
import { getTravelsListPath } from './helpers/routes';

type WebVitalsResult = {
  clsTotal: number;
  clsAfterRender: number;
  lcp: number | null;
  inp: number | null;
  clsEntries: Array<{
    value: number;
    hadRecentInput: boolean;
    sources: any[];
  }>;
};

function getNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const v = Number(raw);
  return Number.isFinite(v) ? v : fallback;
}

async function gotoWithRetry(page: any, url: string) {
  let lastError: any = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      const msg = String((error as any)?.message ?? error ?? '');
      const isTransient =
        msg.includes('ERR_CONNECTION_REFUSED') ||
        msg.includes('ERR_EMPTY_RESPONSE') ||
        msg.includes('NS_ERROR_NET_RESET') ||
        msg.includes('net::');

      if (typeof page?.isClosed === 'function' && page.isClosed()) break;

      try {
        await page.waitForTimeout(isTransient ? Math.min(1200 + attempt * 600, 8000) : 500);
      } catch {
        break;
      }
    }
  }
  if (lastError) throw lastError;
}

const CLS_MAX = getNumberEnv('E2E_CLS_MAX', 0.02);
const LCP_MAX_MS = process.env.CI
  ? getNumberEnv('E2E_LCP_MAX_MS', 3500)
  : getNumberEnv('E2E_LCP_MAX_MS', 45_000);
const INP_MAX_MS = process.env.CI
  ? getNumberEnv('E2E_INP_MAX_MS', 200)
  : getNumberEnv('E2E_INP_MAX_MS', 500);

async function setupVitalsCollection(page: any) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem(
        'metravel_consent_v1',
        JSON.stringify({ necessary: true, analytics: false, date: new Date().toISOString() })
      );
    } catch {
      // ignore
    }

    (window as any).__e2eVitals = {
      clsTotal: 0,
      clsAfterRender: 0,
      lcp: null,
      inp: null,
      _lcpFinalized: false,
      _clsFinalized: false,
      _phase: 'total',
      _clsEntries: [] as any[],
    };

    // CLS
    try {
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
            if (r) rect = { x: r.x, y: r.y, w: r.width, h: r.height };
          } catch {
            rect = null;
          }

          const parts: string[] = [tag];
          if (testId) parts.push(`[data-testid="${testId}"]`);
          if (id) parts.push(`#${id}`);
          if (className.trim()) parts.push(`.${className.trim().split(/\s+/).slice(0, 3).join('.')}`);

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

      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if ((window as any).__e2eVitals._clsFinalized) return;
          if (entry && !entry.hadRecentInput && typeof entry.value === 'number') {
            (window as any).__e2eVitals.clsTotal += entry.value;
            if ((window as any).__e2eVitals._phase === 'afterRender') {
              (window as any).__e2eVitals.clsAfterRender += entry.value;
            }

            try {
              const sources = Array.isArray(entry.sources)
                ? entry.sources
                    .map((s: any) => s?.node)
                    .filter(Boolean)
                    .map(describeNode)
                : [];

              const arr = (window as any).__e2eVitals._clsEntries as any[];
              arr.push({
                value: entry.value,
                hadRecentInput: !!entry.hadRecentInput,
                sources,
              });
              arr.sort((a, b) => b.value - a.value);
              (window as any).__e2eVitals._clsEntries = arr.slice(0, 8);
            } catch {
              // ignore
            }
          }
        }
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true } as any);
    } catch {
      // ignore
    }

    // LCP
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1] as any;
        if (!last) return;
        (window as any).__e2eVitals.lcp = typeof last.startTime === 'number' ? last.startTime : null;
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true } as any);

      window.addEventListener('load', () => {
        setTimeout(() => {
          (window as any).__e2eVitals._lcpFinalized = true;
        }, 1500);
      });
    } catch {
      // ignore
    }

    // INP
    try {
      const inpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (!entry) continue;
          const duration = typeof entry.duration === 'number' ? entry.duration : null;
          if (duration == null) continue;
          const prev = (window as any).__e2eVitals.inp as number | null;
          (window as any).__e2eVitals.inp = prev == null ? duration : Math.max(prev, duration);
        }
      });
      inpObserver.observe({ type: 'event', buffered: true, durationThreshold: 40 } as any);
    } catch {
      // ignore
    }
  });
}

async function openFirstTravelFromList(page: any) {
  await gotoWithRetry(page, getTravelsListPath());

  await page.waitForTimeout(500);

  const cards = page.locator('[data-testid="travel-card-link"]');
  const count = await cards.count();
  if (count === 0) {
    test.info().annotations.push({
      type: 'note',
      description: 'No travel cards available in this environment; cannot open details page',
    });
    return false;
  }

  await cards.first().click();
  await page.waitForURL((url: URL) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

  await Promise.race([
    page.waitForSelector('[data-testid="travel-details-page"]', { timeout: 30_000 }),
    page.waitForSelector('[data-testid="travel-details-scroll"]', { timeout: 30_000 }),
    page.waitForSelector('[data-testid="travel-details-hero"]', { timeout: 30_000 }),
  ]);

  return true;
}

async function collectAndAssert(page: any) {
  await page.waitForTimeout(3000);

  await page.evaluate(() => {
    if ((window as any).__e2eVitals) {
      (window as any).__e2eVitals._phase = 'afterRender';
      (window as any).__e2eVitals.clsAfterRender = 0;
    }
  });

  await page.waitForTimeout(1200);

  await page.evaluate(() => {
    if ((window as any).__e2eVitals) {
      (window as any).__e2eVitals._clsFinalized = true;
    }
  });

  // Produce at least one user interaction for INP sampling.
  await page.locator('body').click({ timeout: 15_000 });

  await page.waitForTimeout(600);

  const vitals = await page.evaluate(() => {
    const v = (window as any).__e2eVitals;
    return {
      clsTotal: typeof v?.clsTotal === 'number' ? v.clsTotal : 0,
      clsAfterRender: typeof v?.clsAfterRender === 'number' ? v.clsAfterRender : 0,
      lcp: typeof v?.lcp === 'number' ? v.lcp : null,
      inp: typeof v?.inp === 'number' ? v.inp : null,
      clsEntries: Array.isArray(v?._clsEntries) ? v._clsEntries : [],
    };
  });

  const result: WebVitalsResult = {
    clsTotal: vitals.clsTotal,
    clsAfterRender: vitals.clsAfterRender,
    lcp: vitals.lcp,
    inp: vitals.inp,
    clsEntries: vitals.clsEntries,
  };

  console.log('E2E Web Vitals (travel details):');
  console.log(
    JSON.stringify(
      {
        ...result,
        clsEntries: (result.clsEntries || []).map((e) => ({
          ...e,
          sources: Array.isArray(e.sources)
            ? e.sources.slice(0, 5).map((s: any) => {
                if (typeof s === 'string') return s;
                const label = String((s as any)?.label ?? 'unknown');
                const rect = (s as any)?.rect;
                const rectStr = rect
                  ? ` @(${Number(rect.x).toFixed(0)},${Number(rect.y).toFixed(0)} ${Number(rect.w).toFixed(0)}x${Number(rect.h).toFixed(0)})`
                  : '';
                const text = (s as any)?.text ? ` "${String((s as any).text)}"` : '';
                return `${label}${rectStr}${text}`;
              })
            : [],
        })),
      },
      null,
      2
    )
  );

  expect(result.clsAfterRender).toBeLessThanOrEqual(CLS_MAX);

  if (result.lcp != null) {
    expect(result.lcp).toBeLessThanOrEqual(LCP_MAX_MS);
  }

  // INP can be null in some environments; keep the same expectation as the main web-vitals spec.
  expect(result.inp).not.toBeNull();
  if (result.inp != null) {
    expect(result.inp).toBeLessThanOrEqual(INP_MAX_MS);
  }
}

test.describe('Web Vitals (CLS/LCP/INP) - travel details', () => {
  test('travel details stays stable and fast (desktop)', async ({ page }: any) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setupVitalsCollection(page);

    const ok = await openFirstTravelFromList(page);
    if (!ok) return;

    await collectAndAssert(page);
  });

  test('travel details stays stable and fast (mobile)', async ({ page }: any) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await setupVitalsCollection(page);

    const ok = await openFirstTravelFromList(page);
    if (!ok) return;

    await collectAndAssert(page);
  });
});
