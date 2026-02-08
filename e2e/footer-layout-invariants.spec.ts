import { test, expect } from './fixtures';
import { installNoConsoleErrorsGuard } from './helpers/consoleGuards';
import { expectNoOverlap } from './helpers/layoutAsserts';
import { preacceptCookies, gotoWithRetry, assertNoHorizontalScroll } from './helpers/navigation';
import { getTravelsListPath } from './helpers/routes';

// Alias for backward compat within this file
const preacceptCookiesAndStabilize = preacceptCookies;

async function waitForNonNullBoundingBoxes(
  page: any,
  locators: any[],
  opts?: { timeoutMs?: number; stepMs?: number; label?: string }
): Promise<(any | null)[]> {
  const timeoutMs = opts?.timeoutMs ?? 5_000;
  const stepMs = opts?.stepMs ?? 100;
  const startedAt = Date.now();
  let last: (any | null)[] = [];

  while (Date.now() - startedAt < timeoutMs) {
    last = await Promise.all(locators.map((l) => l.boundingBox()));
    if (last.every((b) => b != null)) return last;
    await page.waitForTimeout(stepMs);
  }

  // Return the last sample so the caller can craft a helpful assertion message.
  return last;
}

test.describe('Footer layout invariants (web)', () => {
  test('initial load: footer height does not jump during the first second', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await preacceptCookiesAndStabilize(page);

    const guard = installNoConsoleErrorsGuard(page);

    await gotoWithRetry(page, getTravelsListPath());

    const desktopBar = page.getByTestId('footer-desktop-bar');
    await expect(desktopBar).toBeVisible({ timeout: 30_000 });

    // Sample height multiple times right after navigation.
    // This catches transient layout shifts (first frame vs settled state).
    const heights: number[] = [];
    for (let i = 0; i < 10; i++) {
       
      const h = await desktopBar.boundingBox().then((b) => (b ? b.height : 0));
      heights.push(h);
       
      await page.waitForTimeout(100);
    }

    const maxH = Math.max(...heights);
    const minH = Math.min(...heights);

    // Allow minor subpixel fluctuations, but not a real jump.
    expect(
      maxH - minH,
      `footer height must be stable during initial load (min=${minH}px max=${maxH}px samples=${heights.join(',')})`
    ).toBeLessThanOrEqual(6);

    guard.assertNoErrorsContaining('6000ms timeout exceeded');
  });

  test('desktop: footer renders within viewport and does not create horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await preacceptCookiesAndStabilize(page);

    const guard = installNoConsoleErrorsGuard(page);

    await gotoWithRetry(page, getTravelsListPath());

    await assertNoHorizontalScroll(page);

    const desktopBar = page.getByTestId('footer-desktop-bar');
    await expect(desktopBar).toBeVisible({ timeout: 30_000 });

    const desktopItems = page.locator('[data-testid^="footer-item-"]');

    // Stroboscopic guard: within the first second, footer must not become a tall vertical list.
    // This catches layout that persists long enough to be visible to users.
    for (let i = 0; i < 10; i++) {
       
      const h = await desktopBar.boundingBox().then((b) => (b ? b.height : 0));
      expect(h, `desktop footer must not be tall (height=${h}px, sample=${i})`).toBeLessThanOrEqual(140);
       
      await page.waitForTimeout(100);
    }

    const desktopCount = await desktopItems.count();
    expect(desktopCount, 'expected at least 2 items in desktop footer').toBeGreaterThanOrEqual(2);
    const [d0, d1] = await Promise.all([desktopItems.nth(0).boundingBox(), desktopItems.nth(1).boundingBox()]);
    expect(d0, 'expected first desktop footer item to have a bounding box').not.toBeNull();
    expect(d1, 'expected second desktop footer item to have a bounding box').not.toBeNull();
    if (d0 && d1) {
      const yDiff = Math.abs(d0.y - d1.y);
      expect(yDiff, `desktop footer items must be on the same row (yDiff=${yDiff}px)`).toBeLessThanOrEqual(8);
    }

    // Desktop footer contains the copyright text.
    const footerCopy = page.getByText(/©\s*MeTravel/i);
    await expect(footerCopy).toBeVisible({ timeout: 30_000 });

    // Icons must be rendered (no missing-glyph placeholder squares).
    await expect(page.locator('text=□')).toHaveCount(0);

    guard.assertNoErrorsContaining('6000ms timeout exceeded');

    const copyBox = await footerCopy.boundingBox();
    expect(copyBox, 'expected footer copyright to have a bounding box').not.toBeNull();
    if (copyBox) {
      const viewportW = page.viewportSize()!.width;
      expect(copyBox.x, 'footer should not start off-screen (left)').toBeGreaterThanOrEqual(-1);
      expect(copyBox.x + copyBox.width, 'footer should not overflow viewport (right)').toBeLessThanOrEqual(viewportW + 1);
    }

    // On desktop, mobile dock should not render.
    await expect(page.getByTestId('footer-dock-wrapper')).toHaveCount(0);
  });

  test('mobile: dock renders within viewport, has bottom-gutter, and does not create horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await preacceptCookiesAndStabilize(page);

    const guard = installNoConsoleErrorsGuard(page);

    await gotoWithRetry(page, getTravelsListPath());

    await assertNoHorizontalScroll(page);

    const dock = page.getByTestId('footer-dock-wrapper');
    await expect(dock).toBeVisible({ timeout: 30_000 });

    // Stroboscopic guard: dock must never become tall (half-screen regression).
    for (let i = 0; i < 10; i++) {
       
      await expect(page.getByTestId('footer-desktop-bar')).toHaveCount(0);

       
      const h = await dock.boundingBox().then((b) => (b ? b.height : 0));
      expect(h, `dock must be compact (height=${h}px, sample=${i})`).toBeLessThanOrEqual(120);
       
      await page.waitForTimeout(100);
    }

    // Dock must be a single-row compact nav (not a vertical list).
    const dockInteractive = dock.locator('[role="link"], [role="button"]');
    const cnt = await dockInteractive.count();
    expect(cnt, 'expected at least 2 interactive items in the dock').toBeGreaterThanOrEqual(2);
    const [b0, b1] = await Promise.all([
      dockInteractive.nth(0).boundingBox(),
      dockInteractive.nth(1).boundingBox(),
    ]);
    expect(b0, 'expected first dock item to have a bounding box').not.toBeNull();
    expect(b1, 'expected second dock item to have a bounding box').not.toBeNull();
    if (b0 && b1) {
      const yDiff = Math.abs(b0.y - b1.y);
      expect(yDiff, `dock items must be on the same row (yDiff=${yDiff}px)`).toBeLessThanOrEqual(8);
    }

    const dockMeasure = page.getByTestId('footer-dock-measure');
    await expect(dockMeasure).toBeVisible({ timeout: 30_000 });

    const gutter = page.getByTestId('bottom-gutter');
    await expect(gutter).toBeVisible({ timeout: 30_000 });

    // Icons must be rendered (no missing-glyph placeholder squares).
    await expect(page.locator('text=□')).toHaveCount(0);

    const dockBox = await dock.boundingBox();
    expect(dockBox, 'expected dock wrapper to have a bounding box').not.toBeNull();
    if (dockBox) {
      const viewportW = page.viewportSize()!.width;
      expect(dockBox.x, 'dock should align to the left edge').toBeGreaterThanOrEqual(-1);
      expect(dockBox.x + dockBox.width, 'dock should not overflow viewport (right)').toBeLessThanOrEqual(viewportW + 1);
    }

    guard.assertNoErrorsContaining('6000ms timeout exceeded');
  });

  test('breakpoint: web-mobile dock stays horizontal around 768px', async ({ page }) => {
    const guard = installNoConsoleErrorsGuard(page);

    const widths = [740, 767];
    for (const w of widths) {
      await page.setViewportSize({ width: w, height: 844 });
      await preacceptCookiesAndStabilize(page);
      await gotoWithRetry(page, getTravelsListPath());

      const dock = page.getByTestId('footer-dock-wrapper');
      await expect(dock).toBeVisible({ timeout: 30_000 });
      for (let i = 0; i < 10; i++) {
         
        await expect(page.getByTestId('footer-desktop-bar')).toHaveCount(0);

         
        const h = await dock.boundingBox().then((b) => (b ? b.height : 0));
        expect(h, `dock must be compact at width=${w} (height=${h}px, sample=${i})`).toBeLessThanOrEqual(120);
         
        await page.waitForTimeout(100);
      }

      const items = page.locator('[data-testid^="footer-item-"]');
      const count = await items.count();
      expect(count, `expected at least 3 footer items at width=${w}`).toBeGreaterThanOrEqual(3);

      // Bounding box is null when element is detached/hidden. Wait for stable rendering.
      for (const idx of [0, 1, 2]) {
        const item = items.nth(idx);
        await item.scrollIntoViewIfNeeded().catch(() => null);
        await expect(item).toBeVisible({ timeout: 10_000 });
      }

      const [b0, b1, b2] = await waitForNonNullBoundingBoxes(
        page,
        [items.nth(0), items.nth(1), items.nth(2)],
        { timeoutMs: 10_000, stepMs: 100, label: `footer items width=${w}` }
      );
      expect(b0, `expected footer item[0] to have a bounding box at width=${w}`).not.toBeNull();
      expect(b1, `expected footer item[1] to have a bounding box at width=${w}`).not.toBeNull();
      expect(b2, `expected footer item[2] to have a bounding box at width=${w}`).not.toBeNull();
      if (b0 && b1 && b2) {
        const yDiff01 = Math.abs(b0.y - b1.y);
        const yDiff02 = Math.abs(b0.y - b2.y);
        expect(Math.max(yDiff01, yDiff02), `dock items must be on one row at width=${w} (yDiff=${Math.max(yDiff01, yDiff02)}px)`).toBeLessThanOrEqual(10);
      }

      // Icons must be rendered (no missing-glyph placeholder squares).
      await expect(page.locator('text=□')).toHaveCount(0);

      guard.assertNoErrorsContaining('6000ms timeout exceeded');
    }
  });

  // Merged from footer-overlap.spec.ts — gutter height must match dock height.
  test('mobile: bottom-gutter height matches dock height', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await preacceptCookiesAndStabilize(page);

    await gotoWithRetry(page, getTravelsListPath());

    const dock = page.getByTestId('footer-dock-measure');
    await expect(dock).toBeVisible({ timeout: 30_000 });

    const gutter = page.getByTestId('bottom-gutter');
    await expect(gutter).toHaveCount(1, { timeout: 30_000 });
    await gutter.scrollIntoViewIfNeeded().catch(() => null);

    const { dockHeight, gutterHeight } = await page.evaluate(() => {
      const dockEl = document.querySelector('[data-testid="footer-dock-measure"]') as HTMLElement | null;
      const gutterEl = document.querySelector('[data-testid="bottom-gutter"]') as HTMLElement | null;
      return {
        dockHeight: dockEl ? dockEl.offsetHeight : 0,
        gutterHeight: gutterEl ? gutterEl.offsetHeight : 0,
      };
    });

    expect(dockHeight, 'footer dock height should be measurable').toBeGreaterThan(0);
    expect(gutterHeight).toBeGreaterThan(0);
    expect(gutterHeight).toBeGreaterThanOrEqual(dockHeight - 1);
    expect(gutterHeight, `bottom gutter should not be excessively large`).toBeLessThanOrEqual(dockHeight + 20);
  });

  // Merged from footer-last-card-overlap.spec.ts — last card must not overlap dock.
  test('mobile: last travel card does not overlap footer dock', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await preacceptCookiesAndStabilize(page);

    await gotoWithRetry(page, getTravelsListPath());

    const dock = page.getByTestId('footer-dock-wrapper');
    await expect(dock).toBeVisible({ timeout: 30_000 });

    const cards = page.locator('[data-testid="travel-card-link"]');
    await expect(cards.first()).toBeVisible({ timeout: 45_000 });

    const count = await cards.count();
    if (count === 0) {
      test.info().annotations.push({ type: 'note', description: 'No cards rendered; cannot verify overlap' });
      return;
    }

    const last = cards.nth(count - 1);
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeVisible();

    await expectNoOverlap(dock, last, { labelA: 'footer dock', labelB: 'last travel card' });
  });
});
