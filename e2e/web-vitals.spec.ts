import { test, expect } from '@playwright/test';

type WebVitalsResult = {
  clsTotal: number;
  clsAfterRender: number;
  lcp: number | null;
  inp: number | null;
  clsEntries: Array<{
    value: number;
    hadRecentInput: boolean;
    sources: string[];
  }>;
};

function getNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const v = Number(raw);
  return Number.isFinite(v) ? v : fallback;
}

const CLS_MAX = getNumberEnv('E2E_CLS_MAX', 0.02);
const LCP_MAX_MS = process.env.CI
  ? getNumberEnv('E2E_LCP_MAX_MS', 3500)
  : getNumberEnv('E2E_LCP_MAX_MS', 45_000);
const INP_MAX_MS = getNumberEnv('E2E_INP_MAX_MS', 200);

test.describe('Web Vitals (CLS/LCP/INP)', () => {
  test('travels page stays stable and fast', async ({ page }: any) => {
    await page.addInitScript(() => {
      // Hide cookie consent banner by pre-setting consent.
      // See components/ConsentBanner.tsx (CONSENT_KEY = 'metravel_consent_v1').
      try {
        window.localStorage.setItem(
          'metravel_consent_v1',
          JSON.stringify({ necessary: true, analytics: false, date: new Date().toISOString() })
        );
      } catch {
        // ignore
      }

      // Reduce LCP noise in local/dev by disabling the heavy recommendations block.
      // The app reads this from sessionStorage on web (see ListTravel.tsx).
      try {
        sessionStorage.setItem('recommendations_visible', 'false');
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
            const parts: string[] = [];
            if ((el as any).tagName) parts.push(String((el as any).tagName).toLowerCase());
            const testId = (el as any).getAttribute?.('data-testid');
            if (testId) parts.push(`[data-testid="${testId}"]`);
            const id = (el as any).id;
            if (id) parts.push(`#${id}`);
            const className = (el as any).className;
            if (typeof className === 'string' && className.trim()) {
              parts.push(`.${className.trim().split(/\s+/).slice(0, 3).join('.')}`);
            }
            return parts.join('');
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

              // Keep a small list of the biggest CLS entries for debugging.
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
      } catch (e) {
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

        // finalize after load + small delay (captures final LCP)
        window.addEventListener('load', () => {
          setTimeout(() => {
            (window as any).__e2eVitals._lcpFinalized = true;
          }, 1500);
        });
      } catch (e) {
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
      } catch (e) {
        // ignore
      }
    });

    // NOTE: In this app, the travels list route is '/'.
    // '/travels/[param]' is the details page.
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Wait for some travel cards or skeletons to render.
    // The list can be empty in local/dev environments.
    // So we treat either (cards/skeleton) OR (empty state) as a successful "page rendered" signal.
    await page.waitForTimeout(500);
    await Promise.race([
      page.waitForSelector('[data-testid="travel-card-link"], [data-testid="travel-card-skeleton"]', {
        timeout: 30_000,
      }),
      page.waitForSelector('text=Пока нет путешествий', { timeout: 30_000 }),
      page.waitForSelector('text=Найдено:', { timeout: 30_000 }),
    ]);

    // Give LCP observer some time to settle.
    await page.waitForTimeout(2500);

    // Reset CLS after initial render so we can assert on "post-render" stability separately.
    await page.evaluate(() => {
      if ((window as any).__e2eVitals) {
        (window as any).__e2eVitals._phase = 'afterRender';
        (window as any).__e2eVitals.clsAfterRender = 0;
      }
    });

    // Let the page settle a bit more in the "afterRender" phase
    await page.waitForTimeout(1000);

    // Freeze CLS before interaction so the CLS assertion is about load/layout stability,
    // not about post-input reflows.
    await page.evaluate(() => {
      if ((window as any).__e2eVitals) {
        (window as any).__e2eVitals._clsFinalized = true;
      }
    });

    // Trigger a simple interaction to produce an INP sample.
    // The search box exists even when the list is empty.
    const searchBox = page.getByRole('textbox', { name: /Поиск путешествий/i });
    await searchBox.click({ timeout: 15_000 });
    await searchBox.type('тест', { delay: 25 });

    await page.waitForTimeout(500);

    const vitals = await page.evaluate(() => {
      const v = (window as any).__e2eVitals;
      return {
        clsTotal: typeof v?.clsTotal === 'number' ? v.clsTotal : 0,
        clsAfterRender: typeof v?.clsAfterRender === 'number' ? v.clsAfterRender : 0,
        lcp: typeof v?.lcp === 'number' ? v.lcp : null,
        inp: typeof v?.inp === 'number' ? v.inp : null,
        clsEntries: Array.isArray(v?._clsEntries) ? v._clsEntries : [],
      } as WebVitalsResult;
    });

    // Helpful debug output in CI / local runs
    // eslint-disable-next-line no-console
    console.log('E2E Web Vitals:', vitals);

    // Hard assertions (regression guards)
    expect(vitals.clsAfterRender).toBeLessThanOrEqual(CLS_MAX);

    // LCP can be null in some environments (e.g. if observer unsupported), but in Chromium it should exist.
    expect(vitals.lcp).not.toBeNull();
    if (vitals.lcp != null) {
      expect(vitals.lcp).toBeLessThanOrEqual(LCP_MAX_MS);
    }

    // INP can be null if no event entries; after click it should generally exist.
    expect(vitals.inp).not.toBeNull();
    if (vitals.inp != null) {
      expect(vitals.inp).toBeLessThanOrEqual(INP_MAX_MS);
    }
  });
});
