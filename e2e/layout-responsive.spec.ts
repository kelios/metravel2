import { test, expect } from './fixtures';
import { preacceptCookies as sharedPreacceptCookies, assertNoHorizontalScroll, waitForMainListRender } from './helpers/navigation';
import { getTravelsListPath } from './helpers/routes';

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

test.describe('@perf Responsive layout invariants', () => {
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

    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await waitForTravelsListToRender(page);

    await assertNoHorizontalScroll(page);

    // Resize down to tablet, then mobile.
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.waitForTimeout(200);
    await assertNoHorizontalScroll(page);

    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(200);
    await assertNoHorizontalScroll(page);
  });

});
