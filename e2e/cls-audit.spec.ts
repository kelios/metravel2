import { test, expect } from './fixtures';

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

test.describe('CLS audit', () => {
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

      await routePage.addInitScript(() => {
        // Hide cookie consent banner by pre-setting consent.
        try {
          window.localStorage.setItem(
            'metravel_consent_v1',
            JSON.stringify({ necessary: true, analytics: false, date: new Date().toISOString() })
          );
        } catch {
          // ignore
        }

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
        await routePage.waitForTimeout(3000);

        try {
          const beforePath = testInfo.outputPath(`cls-${route.replace(/\W+/g, '_')}-before.png`);
          await routePage.screenshot({ path: beforePath, fullPage: true });
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
        });

        // Let the route settle (lazy components / images).
        await routePage.waitForTimeout(2000);

        try {
          const afterPath = testInfo.outputPath(`cls-${route.replace(/\W+/g, '_')}-after.png`);
          await routePage.screenshot({ path: afterPath, fullPage: true });
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
        });

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
});
