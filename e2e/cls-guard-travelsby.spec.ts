import { test, expect } from './fixtures';
import { getTravelsListPath } from './helpers/routes';
import { seedNecessaryConsent } from './helpers/storage';

type ClsEntry = {
  value: number;
  hadRecentInput: boolean;
  sources: string[];
};

type ClsData = {
  clsTotal: number;
  clsAfterRender: number;
  entries: ClsEntry[];
};

function getNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const v = Number(raw);
  return Number.isFinite(v) ? v : fallback;
}

const ROUTE = getTravelsListPath();
const CLS_TOTAL_MAX = getNumberEnv('E2E_CLS_GUARD_TOTAL_MAX', 0.35);
const CLS_AFTER_RENDER_MAX = getNumberEnv('E2E_CLS_GUARD_AFTER_RENDER_MAX', 0.02);

async function waitForMainToRender(page: any) {
  await Promise.race([
    page.waitForSelector('#search-input', { timeout: 30_000 }),
    page.waitForSelector(
      '[data-testid="travel-card-link"], [data-testid="travel-card-skeleton"], [data-testid="list-travel-skeleton"]',
      { timeout: 30_000 }
    ),
    page.waitForSelector('text=Пока нет путешествий', { timeout: 30_000 }),
    page.waitForSelector('text=Найдено:', { timeout: 30_000 }),
    page.waitForSelector('text=Пиши о своих путешествиях', { timeout: 30_000 }),
  ]);
}

async function initClsCollector(page: any) {
  await page.addInitScript(seedNecessaryConsent);
  await page.addInitScript(() => {
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
            state.entries = state.entries.slice(0, 10);
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
}

async function collectCls(page: any): Promise<ClsData> {
  await page.waitForTimeout(3000);

  await page.evaluate(() => {
    const s = (window as any).__e2eCls;
    if (!s) return;
    s.phase = 'afterRender';
    s.clsAfterRender = 0;
  });

  await page.waitForTimeout(2000);

  return page.evaluate(() => {
    const s = (window as any).__e2eCls;
    if (!s) return { clsTotal: 0, clsAfterRender: 0, entries: [] };
    s.finalized = true;
    return {
      clsTotal: typeof s.clsTotal === 'number' ? s.clsTotal : 0,
      clsAfterRender: typeof s.clsAfterRender === 'number' ? s.clsAfterRender : 0,
      entries: Array.isArray(s.entries) ? s.entries : [],
    };
  });
}

test.describe('CLS guard', () => {
  test(`route ${ROUTE} should not exceed CLS thresholds`, async ({ page }) => {
    test.setTimeout(2 * 60_000);

    // Reproduce the problematic responsive layout reliably (web mobile / narrow width).
    // CLS can differ drastically between breakpoints.
    await page.setViewportSize({ width: 390, height: 844 });

    await initClsCollector(page);

    let lastError: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await page.goto(ROUTE, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        await waitForMainToRender(page);
        lastError = null;
        break;
      } catch (e) {
        lastError = e;
        // If the page was closed (e.g. due to Playwright timeouts), don't keep waiting.
        if (typeof page?.isClosed === 'function' && page.isClosed()) break;

        try {
          await page.waitForTimeout(700 + attempt * 400);
        } catch {
          break;
        }
      }
    }
    if (lastError) throw lastError;

    const data = await collectCls(page);

    const top = (data.entries || [])
      .slice(0, 5)
      .map((e) => `  - ${e.value.toFixed(4)}: ${Array.isArray(e.sources) ? e.sources.join(', ') : ''}`)
      .join('\n');

    expect(
      data.clsTotal,
      `CLS total too high for ${ROUTE}. clsTotal=${data.clsTotal.toFixed(4)} (max ${CLS_TOTAL_MAX.toFixed(
        4
      )})\nTop entries:\n${top}`
    ).toBeLessThanOrEqual(CLS_TOTAL_MAX);

    expect(
      data.clsAfterRender,
      `CLS afterRender too high for ${ROUTE}. clsAfterRender=${data.clsAfterRender.toFixed(4)} (max ${CLS_AFTER_RENDER_MAX.toFixed(
        4
      )})\nTop entries:\n${top}`
    ).toBeLessThanOrEqual(CLS_AFTER_RENDER_MAX);
  });
});
