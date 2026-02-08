import { test, expect } from './fixtures';
import {
  expectFullyInViewport,
  expectNoHorizontalScroll,
  expectNoOverlap,
  expectTopmostAtCenter,
} from './helpers/layoutAsserts';
import { installNoConsoleErrorsGuard } from './helpers/consoleGuards';
import { preacceptCookies, gotoWithRetry, waitForMainListRender } from './helpers/navigation';
import { getTravelsListPath } from './helpers/routes';

// Alias for backward compat within this file
const preacceptCookiesAndStabilize = preacceptCookies;

// Use shared helper
const waitForMainToRender = waitForMainListRender;

function getSearchLocator(page: any) {
  // Prefer accessibility label (stable across layouts). Fallback to web id.
  return page
    .getByRole('textbox', { name: /Поиск путешествий/i })
    .or(page.getByRole('textbox', { name: /Поле поиска путешествий/i }))
    .or(page.locator('#search-input'));
}

test.describe('@perf UI layout regression guards (overlap/cutoff/viewport)', () => {
  const VIEWPORTS = [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1280, height: 800 },
  ] as const;

  for (const vp of VIEWPORTS) {
    test(`no horizontal scroll + key elements not clipped (${vp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await preacceptCookiesAndStabilize(page);

      const guard = installNoConsoleErrorsGuard(page);
      await gotoWithRetry(page, getTravelsListPath());
      await waitForMainToRender(page);

      await expectNoHorizontalScroll(page);

      // Header should be present and on top.
      const header = page.getByTestId('main-header');
      await expect(header).toBeVisible({ timeout: 30_000 });
      await expectFullyInViewport(header, page, { label: 'main header', margin: 2 });

      // Search should be visible and clickable (not covered by some overlay).
      const search = getSearchLocator(page);
      await expect(search).toBeVisible({ timeout: 30_000 });
      await expectTopmostAtCenter(page, search, 'search input');

      // Footer: web "tablet" currently renders the mobile dock (see useResponsive/isTablet).
      // Therefore assert based on what is actually present.
      const dock = page.getByTestId('footer-dock-wrapper');
      if ((await dock.count()) > 0) {
        await expect(dock).toBeVisible({ timeout: 30_000 });
        await dock.scrollIntoViewIfNeeded();
        await expectFullyInViewport(dock, page, { label: 'footer dock' });

        // Bottom gutter is only required when the dock is fixed over scrollable content.
        // On some web/tablet layouts it may be absent.
        const { dockHeight, gutterHeight, hasGutter } = await page.evaluate(() => {
          const dockEl = document.querySelector('[data-testid="footer-dock-measure"]') as HTMLElement | null;
          const gutterEl = document.querySelector('[data-testid="bottom-gutter"]') as HTMLElement | null;
          return {
            dockHeight: dockEl ? dockEl.offsetHeight : 0,
            gutterHeight: gutterEl ? gutterEl.offsetHeight : 0,
            hasGutter: !!gutterEl,
          };
        });
        expect(dockHeight, 'footer dock height should be measurable').toBeGreaterThan(0);
        if (hasGutter) {
          expect(gutterHeight, 'bottom gutter height should be measurable').toBeGreaterThan(0);
          expect(gutterHeight).toBeGreaterThanOrEqual(dockHeight - 1);
        }

        // Dock must not overlap the search bar (common z-index regression).
        await expectNoOverlap(dock, search, { labelA: 'footer dock', labelB: 'search input' });
      } else {
        const bar = page.getByTestId('footer-desktop-bar');
        await expect(bar).toBeVisible({ timeout: 30_000 });
        await bar.scrollIntoViewIfNeeded();
        await expectFullyInViewport(bar, page, { label: 'footer desktop bar', margin: 2 });
      }

      // Travel cards: if any exist, first card must be fully visible in viewport after scrollIntoView.
      const cardLink = page.locator('[data-testid="travel-card-link"]').first();
      if ((await cardLink.count()) > 0) {
        await cardLink.scrollIntoViewIfNeeded();
        await expect(cardLink).toBeVisible();
        await expectFullyInViewport(cardLink, page, { label: 'first travel card' });
        await expectTopmostAtCenter(page, cardLink, 'first travel card');

        // Guard against right-edge clipping (card partially off-screen even if visible).
        const box = await cardLink.boundingBox();
        expect(box, 'first travel card must have a bounding box').not.toBeNull();
        if (box) {
          const viewportW = page.viewportSize()!.width;
          expect(
            box.x + box.width,
            `first travel card must not overflow viewport (right). right=${box.x + box.width}, viewportW=${viewportW}`
          ).toBeLessThanOrEqual(viewportW + 1);
        }
      }

      // Mobile/tablet dock: at the bottom of the list, the last card must not be covered by the fixed dock.
      if ((await dock.count()) > 0) {
        const cards = page.locator('[data-testid="travel-card-link"]');
        const count = await cards.count();
        if (count > 0 && (await dock.isVisible().catch(() => false))) {
          const last = cards.nth(count - 1);
          await last.scrollIntoViewIfNeeded();
          await expect(last).toBeVisible();
          await expectNoOverlap(dock, last, { labelA: 'footer dock', labelB: 'last travel card' });
        }
      }

      guard.assertNoErrorsContaining('6000ms timeout exceeded');
    });

    test(`menu does not cause overlap/cutoff when opened (${vp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await preacceptCookiesAndStabilize(page);

      await gotoWithRetry(page, getTravelsListPath());
      await waitForMainToRender(page);

      // Baseline: before opening menu there should be no horizontal overflow.
      await expectNoHorizontalScroll(page);

      const header = page.getByTestId('main-header');
      await expect(header).toBeVisible({ timeout: 30_000 });

      if (vp.name === 'desktop') {
        const before = await page.evaluate(() => {
          const docEl = document.documentElement;
          return {
            clientWidth: docEl?.clientWidth ?? 0,
            scrollWidth: docEl?.scrollWidth ?? 0,
          };
        });

        const accountMenu = page.getByTestId('account-menu-anchor');
        await expect(accountMenu).toBeVisible({ timeout: 30_000 });
        await accountMenu.click();

        // Menu must not cover the trigger (account menu anchor).
        const webPanel = page.getByTestId('web-menu-panel');
        if ((await webPanel.count()) > 0) {
          await expect(webPanel).toBeVisible({ timeout: 10_000 });
          const [anchorBox, panelBox] = await Promise.all([accountMenu.boundingBox(), webPanel.boundingBox()]);
          expect(anchorBox, 'account menu anchor must have a bounding box').not.toBeNull();
          expect(panelBox, 'web menu panel must have a bounding box').not.toBeNull();
          if (anchorBox && panelBox) {
            expect(
              panelBox.y,
              `web menu panel must start below account menu anchor (panelTop=${panelBox.y}, anchorBottom=${anchorBox.y + anchorBox.height})`
            ).toBeGreaterThanOrEqual(anchorBox.y + anchorBox.height - 1);
          }
        }

        // Opening account menu must not introduce horizontal scroll.
        await expectNoHorizontalScroll(page);

        const after = await page.evaluate(() => {
          const docEl = document.documentElement;
          return {
            clientWidth: docEl?.clientWidth ?? 0,
            scrollWidth: docEl?.scrollWidth ?? 0,
          };
        });

        expect(
          after.clientWidth,
          `AccountMenu open must not change documentElement.clientWidth (before=${before.clientWidth}, after=${after.clientWidth})`
        ).toBe(before.clientWidth);
        expect(
          after.scrollWidth,
          `AccountMenu open must not increase documentElement.scrollWidth (before=${before.scrollWidth}, after=${after.scrollWidth})`
        ).toBeLessThanOrEqual(before.scrollWidth);

        // Close by clicking outside.
        await page.mouse.click(10, 10);
        await expectNoHorizontalScroll(page);
        return;
      }

      // Use stable testIDs from CustomHeader mobile menu.
      const burger = page.getByTestId('mobile-menu-open');
      await expect(burger).toBeVisible({ timeout: 30_000 });

      await burger.click();

      const overlay = page.getByTestId('mobile-menu-overlay');
      const panel = page.getByTestId('mobile-menu-panel');
      const close = page.getByTestId('mobile-menu-close');

      await expect(overlay).toBeVisible({ timeout: 10_000 });
      await expect(panel).toBeVisible({ timeout: 10_000 });
      await expect(close).toBeVisible({ timeout: 10_000 });

      // Opening menu must not introduce horizontal scroll.
      await expectNoHorizontalScroll(page);

      // We expect a close button to appear when the menu opens.
      await expect(close).toBeVisible({ timeout: 10_000 });

      // Menu controls should be within viewport (no off-screen/cutoff issues).
      await expectFullyInViewport(close, page, { label: 'menu close button', margin: 2 });

      // At least one nav item should be present and in viewport.
      const menuNavAnyVisible = page.getByRole('button', { name: /Путешествия|Беларусь|Карта|Квесты/i });
      if (await menuNavAnyVisible.isVisible().catch(() => false)) {
        await expectFullyInViewport(menuNavAnyVisible, page, { label: 'menu nav item', margin: 2 });
        await expectTopmostAtCenter(page, menuNavAnyVisible, 'menu nav item');
      }

      // When menu is open, it must be topmost (not behind content).
      await expectTopmostAtCenter(page, close, 'menu close button');

      // And the header should not be visually covered by footer (rare but happens with fixed/sticky stacks).
      const footerDock = page.getByTestId('footer-dock-wrapper');
      if (await footerDock.isVisible().catch(() => false)) {
        await expectNoOverlap(footerDock, header, { labelA: 'footer dock', labelB: 'header' });
      }

      // Close menu and ensure search is clickable again.
      await close.click();
      await expect(overlay).toHaveCount(0);
      const search = getSearchLocator(page);
      await expect(search).toBeVisible({ timeout: 30_000 });
      await expectTopmostAtCenter(page, search, 'search input after closing menu');

      await expectNoHorizontalScroll(page);
    });
  }
});
