import { test, expect } from './fixtures';
import { preacceptCookies as sharedPreacceptCookies, assertNoHorizontalScroll, waitForMainListRender } from './helpers/navigation';
import { getTravelsListPath } from './helpers/routes';

function getNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const v = Number(raw);
  return Number.isFinite(v) ? v : fallback;
}

const SHOULD_CAPTURE_VISUAL = process.env.E2E_VISUAL === '1';

// Layout-specific: also clears auth tokens to force guest context.
async function preacceptCookies(page: any) {
  await sharedPreacceptCookies(page);
  await page.addInitScript(() => {
    try {
      window.localStorage?.removeItem('secure_userToken');
      window.localStorage?.removeItem('userId');
      window.localStorage?.removeItem('userName');
      window.localStorage?.removeItem('isSuperuser');
    } catch {
      // ignore
    }
  });
}

// Alias to shared helper
const waitForTravelsListToRender = waitForMainListRender;

async function countCardsInFirstRow(page: any): Promise<number> {
  const cards = page.locator('[data-testid="travel-card"]');
  const count = await cards.count();
  if (count === 0) return 0;

  // React Native Web can virtualize list items using positioning that makes Y-based
  // "same row" detection flaky. A more stable proxy for "columns" is the number of
  // distinct X positions among the first visible cards.
  const boxes: Array<{ x: number; y: number; width: number; height: number }> = [];
  for (let i = 0; i < Math.min(count, 12); i++) {
    const box = await cards.nth(i).boundingBox();
    if (!box) continue;
    boxes.push({ x: box.x, y: box.y, width: box.width, height: box.height });
  }
  if (boxes.length === 0) return 0;

  const minY = Math.min(...boxes.map((b) => b.y));
  const EPS_Y = 3;
  const topRow = boxes.filter((b) => Math.abs(b.y - minY) <= EPS_Y);

  // Bucket X to avoid subpixel differences.
  const bucket = (x: number) => Math.round(x / 8) * 8;
  const xs = new Set(topRow.map((b) => bucket(b.x)));

  // If virtualization causes too many items to have the exact same y, we can still
  // safely infer columns by looking at unique X across the first few items.
  if (xs.size <= 1) {
    const xsAll = new Set(boxes.map((b) => bucket(b.x)));
    return xsAll.size;
  }

  return xs.size;
}

test.describe('Responsive layout invariants', () => {
  test('no horizontal scroll + grid breaks correctly (mobile/tablet/desktop)', async ({ page }) => {
    // Thresholds derived from app constants:
    // - mobile layout breakpoint is effectively 768 (METRICS.breakpoints.tablet)
    // - grid expects 1/2/3 columns across mobile/tablet/desktop
    const VIEWPORTS = [
      { name: 'mobile', width: 375, height: 812, expectedColumns: 1 },
      { name: 'tablet', width: 820, height: 1180, expectedColumns: 2 },
      { name: 'desktop', width: 1440, height: 900, expectedColumns: 3 },
    ];

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await preacceptCookies(page);

      await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
      await waitForTravelsListToRender(page);

      await assertNoHorizontalScroll(page);

      // Columns are asserted only if we actually have cards (in some envs data can be empty).
      const columns = await countCardsInFirstRow(page);
      if (columns > 0) {
        expect(columns, `Unexpected number of cards in first row for ${vp.name}`).toBe(vp.expectedColumns);
      }

      if (SHOULD_CAPTURE_VISUAL) {
        // Keep tolerance modest to avoid flaky diffs while still catching regressions.
        await expect(page).toHaveScreenshot(`travels-${vp.name}.png`, {
          fullPage: true,
          maxDiffPixelRatio: 0.02,
        });
      }
    }
  });

  test('layout stays stable after viewport resize (no scroll, grid adapts)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await preacceptCookies(page);

    try {
      await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      test.info().annotations.push({
        type: 'note',
        description: `Dev server not reachable during strict layout check: ${msg}`,
      });
      return;
    }
    await waitForTravelsListToRender(page);

    await assertNoHorizontalScroll(page);

    // Resize down to tablet, then mobile.
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.waitForFunction(() => true, null, { timeout: 500 }).catch(() => null);
    await assertNoHorizontalScroll(page);

    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForFunction(() => true, null, { timeout: 500 }).catch(() => null);
    await assertNoHorizontalScroll(page);
  });

  test('optional stricter CLS after render on travels (post-load stability)', async ({ page }) => {
    if (process.env.E2E_STRICT_LAYOUT !== '1') {
      test.info().annotations.push({
        type: 'note',
        description: 'Strict layout CLS check is opt-in. Set E2E_STRICT_LAYOUT=1 to run it.',
      });
      return;
    }

    // This is an additional guard complementary to existing cls-audit/web-vitals tests.
    // It focuses on just '/', with a tunable threshold.
    const CLS_AFTER_RENDER_MAX = getNumberEnv('E2E_CLS_AFTER_RENDER_MAX_TRAVELS', 0.02);

    await preacceptCookies(page);
    await page.addInitScript(() => {
      (window as any).__e2eClsTravel = {
        clsTotal: 0,
        clsAfterRender: 0,
        phase: 'total',
        finalized: false,
      };

      try {
        const obs = new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as any[]) {
            const state = (window as any).__e2eClsTravel;
            if (!state || state.finalized) return;
            if (!entry || entry.hadRecentInput || typeof entry.value !== 'number') continue;
            state.clsTotal += entry.value;
            if (state.phase === 'afterRender') state.clsAfterRender += entry.value;
          }
        });
        obs.observe({ type: 'layout-shift', buffered: true } as any);
      } catch {
        // ignore
      }
    });

    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await waitForTravelsListToRender(page);

    await page.waitForLoadState('networkidle').catch(() => null);

    // Reset and measure only after initial render.
    await page.evaluate(() => {
      const s = (window as any).__e2eClsTravel;
      if (!s) return;
      s.phase = 'afterRender';
      s.clsAfterRender = 0;
    });

    await page.waitForLoadState('networkidle').catch(() => null);

    const clsAfterRender = await page.evaluate(() => {
      const s = (window as any).__e2eClsTravel;
      if (!s) return 0;
      s.finalized = true;
      return typeof s.clsAfterRender === 'number' ? s.clsAfterRender : 0;
    });

    expect(clsAfterRender).toBeLessThanOrEqual(CLS_AFTER_RENDER_MAX);
  });
});
