/**
 * mobile-regression-android-qa.spec.ts
 *
 * Регресс-сьют для классов багов, выявленных в Android QA раунде 2.
 * Запускается в mobile-viewport 390×844 (iPhone 14 / средний Android).
 *
 * Покрытые классы:
 *  BUG-CLASS-1  – Active tab-bar state (правильный таб подсвечен)
 *  BUG-CLASS-2  – Шапка ≤20% высоты вьюпорта на мобильном
 *  BUG-CLASS-3  – Back-навигация возвращает на источник, не на Главную
 *  BUG-CLASS-7  – Дубли секций на странице деталей / мёртвые ссылки
 *  BUG-CLASS-8  – Layout-артефакты на мобильном (белый блок внизу /places)
 *
 * BUG-CLASS-4 (действия карточки точки) покрыт
 * __tests__/components/travel/PointList.web.test.tsx.
 * BUG-CLASS-6 (нормализация обёрток API) покрыт юнит-тестами:
 *   __tests__/components/listTravel/listTravelHelpers.api-envelope.test.ts
 *   __tests__/api/messages.test.ts  (уже есть: results/data/bare-array)
 */

import { test, expect } from './fixtures';
import {
  FALLBACK_TRAVEL_SLUG,
  preacceptCookies,
  gotoWithRetry,
  mockFallbackTravelDetails,
  openFallbackTravelDetails,
} from './helpers/navigation';
import { ensureAuthedStorageFallback, mockFakeAuthApis } from './helpers/auth';
import { getTravelsListPath } from './helpers/routes';

const MOBILE_VIEWPORT = { width: 390, height: 844 };

// ─── helpers ────────────────────────────────────────────────────────────────

async function setMobileViewport(page: any) {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await preacceptCookies(page);
}

function isTravelDetailsPath(pathname: string) {
  return /^\/travels\/[^/]+/.test(pathname);
}

async function getDockTabBackground(tab: import('@playwright/test').Locator) {
  return tab.evaluate((element) => window.getComputedStyle(element).backgroundColor);
}

async function installEmptyTravelListMock(page: import('@playwright/test').Page) {
  await page.route('**/api/travels/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== 'GET' || url.pathname !== '/api/travels/') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], total: 0 }),
    });
  });
}

// ─── BUG-CLASS-1: Active tab-bar state ──────────────────────────────────────

test.describe('@mobile BUG-CLASS-1: active tab-bar state', () => {
  test('home / root route does not highlight "Маршруты" tab as active', async ({ page }) => {
    await setMobileViewport(page);
    await gotoWithRetry(page, '/');

    const dock = page.getByTestId('footer-dock-wrapper');
    await expect(dock).toBeVisible({ timeout: 30_000 });
    await expect(dock.getByTestId('footer-item-home')).toHaveAttribute('aria-selected', 'false');
  });

  test('map route highlights map tab', async ({ page }) => {
    await setMobileViewport(page);
    await gotoWithRetry(page, '/map');

    const dock = page.getByTestId('footer-dock-wrapper');
    await expect(dock).toBeVisible({ timeout: 30_000 });

    const mapTab = dock.getByTestId('footer-item-map');
    const homeTab = dock.getByTestId('footer-item-home');
    await expect(mapTab).toBeVisible();
    await expect(mapTab).toHaveAttribute('aria-selected', 'true');
    await expect(homeTab).toHaveAttribute('aria-selected', 'false');
    expect(await getDockTabBackground(mapTab)).not.toBe(await getDockTabBackground(homeTab));

    // The dock itself must be visible and not have zero height (regression: full-screen dock)
    const dockBox = await dock.boundingBox();
    expect(dockBox, 'dock must have a bounding box on /map').not.toBeNull();
    expect(dockBox!.height, 'dock must be compact on /map').toBeLessThanOrEqual(120);
  });

  test('quests route highlights the quests tab instead of the map tab', async ({ page }) => {
    await setMobileViewport(page);
    await gotoWithRetry(page, '/quests');

    const dock = page.getByTestId('footer-dock-wrapper');
    await expect(dock).toBeVisible({ timeout: 30_000 });

    await expect(page).toHaveURL(/\/quests(?:[/?#]|$)/);
    const questsTab = dock.getByTestId('footer-item-quests');
    const mapTab = dock.getByTestId('footer-item-map');
    await expect(questsTab).toBeVisible();
    await expect(questsTab).toHaveAttribute('aria-selected', 'true');
    await expect(mapTab).toHaveAttribute('aria-selected', 'false');
    expect(await getDockTabBackground(questsTab)).not.toBe(await getDockTabBackground(mapTab));

    const dockBox = await dock.boundingBox();
    expect(dockBox).not.toBeNull();
    expect(dockBox!.height).toBeLessThanOrEqual(120);
  });
});

// ─── BUG-CLASS-2: Header ≤20% viewport height ───────────────────────────────

test.describe('@mobile BUG-CLASS-2: header ≤20% viewport height', () => {
  const MAX_HEADER_RATIO = 0.20; // 20% of 844 = 168.8px

  test('search page: sticky header does not exceed 20% of viewport on mobile', async ({ page }) => {
    await setMobileViewport(page);
    await installEmptyTravelListMock(page);
    await gotoWithRetry(page, '/search');

    const viewportHeight = MOBILE_VIEWPORT.height;
    const maxHeaderPx = viewportHeight * MAX_HEADER_RATIO;

    // The toolbar testID is `toolbar-results-count` (inside ListCatalogToolbar).
    // We measure the combined height of all fixed/sticky elements above the scroll area.
    // Strategy: find the bounding box of the toolbar and assert it stays compact.
    const toolbar = page.locator('[data-testid="toolbar-results-count"]').first();
    await expect(toolbar).toBeVisible({ timeout: 30_000 });

    const toolbarBox = await toolbar.boundingBox();
    expect(toolbarBox, 'search toolbar must have a bounding box').not.toBeNull();
    // The toolbar itself must sit within the first 20% from the top.
    expect(
      toolbarBox!.y + toolbarBox!.height,
      `Search toolbar bottom must be within ${maxHeaderPx}px from top (20% of ${viewportHeight}px viewport). Got ${toolbarBox!.y + toolbarBox!.height}px`
    ).toBeLessThanOrEqual(maxHeaderPx);
  });

  test('travel wizard header does not exceed 20% of viewport on mobile', async ({ page }) => {
    await setMobileViewport(page);
    await ensureAuthedStorageFallback(page);
    await mockFakeAuthApis(page);

    await gotoWithRetry(page, '/travel/new');

    // Measure the actual top context header. The wizard progress bar is part of
    // the form body, below the page title/subtitle, so it is not header chrome.
    const contextHeader = page.getByTestId('header-context-bar').first();
    await expect(contextHeader).toBeVisible({ timeout: 30_000 });

    const headerBox = await contextHeader.boundingBox();
    expect(headerBox, 'wizard context header must have a bounding box').not.toBeNull();
    const viewportHeight = MOBILE_VIEWPORT.height;
    const maxHeaderPx = viewportHeight * MAX_HEADER_RATIO;
    expect(
      headerBox!.y + headerBox!.height,
      `Wizard context header bottom must be within top ${MAX_HEADER_RATIO * 100}% of viewport`
    ).toBeLessThanOrEqual(maxHeaderPx);
  });
});

// ─── BUG-CLASS-3: Back navigation goes to source, not Home ──────────────────

test.describe('@mobile BUG-CLASS-3: back navigation returns to source', () => {
  test('back from travel details honors the list returnTo path', async ({ page }) => {
    await setMobileViewport(page);

    const expectedReturnPath = getTravelsListPath();
    await mockFallbackTravelDetails(page);
    await gotoWithRetry(page, expectedReturnPath);
    await gotoWithRetry(
      page,
      `/travels/${FALLBACK_TRAVEL_SLUG}?returnTo=${encodeURIComponent(expectedReturnPath)}`,
    );

    // We're now on /travels/<slug>
    expect(isTravelDetailsPath(new URL(page.url()).pathname)).toBe(true);
    await expect(page.getByTestId('travel-details-page')).toBeVisible({ timeout: 30_000 });

    // Click the details context-bar back button if available, otherwise use browser history.
    // A broad aria-label search can match unrelated in-page controls and make this flaky.
    const backBtn = page
      .getByTestId('header-context-bar')
      .getByRole('button', { name: /^Назад$/ })
      .first();
    await expect(backBtn).toBeVisible({ timeout: 10_000 });
    await backBtn.click();

    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
      .not.toMatch(/^\/travels\//);

    // After going back from a travel detail reached from /search,
    // we must land on something other than / (i.e. back to the list source)
    const finalUrl = new URL(page.url());
    expect(
      finalUrl.pathname,
      'Back from travel details must return to the previous list'
    ).toBe(expectedReturnPath);
    expect(
      finalUrl.pathname,
      'Back from travel details must not land on / (should be the previous list)'
    ).not.toBe('/');
  });

  test('browser back from /map returns to the previous screen', async ({ page }) => {
    await setMobileViewport(page);

    // Ensure there's a history entry before /map
    await gotoWithRetry(page, getTravelsListPath());
    await gotoWithRetry(page, '/map');

    expect(page.url()).toContain('/map');

    await page.goBack();
    await page.waitForURL((url) => !url.pathname.includes('/map'), { timeout: 15_000 });

    const finalPath = new URL(page.url()).pathname;
    expect(
      finalPath,
      'Back from /map must return to the previous screen, not /'
    ).not.toBe('/');
  });
});

// ─── BUG-CLASS-7: Duplicate sections in travel details ───────────────────────

test.describe('@mobile BUG-CLASS-7: no duplicate sections in travel details', () => {
  test('travel detail renders exactly one author block', async ({ page }) => {
    await setMobileViewport(page);

    const opened = await openFallbackTravelDetails(page);
    expect(opened, 'fallback travel details must load').toBe(true);

    // Scroll to trigger all sections
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(800);

    // Author blocks — count visible elements with author-related testID
    const authorBlocks = page.getByTestId('travel-details-author-mobile');
    const authorCount = await authorBlocks.count();
    expect(
      authorCount,
      'Travel details must show exactly one author block (duplicate = BUG-CLASS-7)'
    ).toBe(1);
  });
});

// ─── BUG-CLASS-8: Layout artifacts (white block, overlap) ────────────────────

test.describe('@mobile BUG-CLASS-8: no layout artifacts on mobile', () => {
  test('/places: no large empty white block at the bottom', async ({ page }) => {
    await setMobileViewport(page);
    await gotoWithRetry(page, '/places');

    // The layout invariant is valid for success and recoverable API-error states.
    await expect(page.getByRole('heading', { name: 'Места', level: 1 })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('textbox', { name: 'Найти место' })).toBeVisible();

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Measure: document height vs viewport height.
    // A "white block" regression manifests as the page scrollHeight being
    // much taller than the content (empty space at the bottom).
    const measurements = await page.evaluate(() => {
      const docHeight = document.documentElement.scrollHeight;
      const viewH = window.innerHeight;
      const scrollTop = window.scrollY;
      return { docHeight, viewH, scrollTop };
    });

    // The white-block bug showed up as ~300px of extra blank space.
    // We check: after scrolling to the bottom, the remaining scroll space
    // doesn't imply an unreasonably large gap.
    // This is a heuristic guard, not an absolute layout check.
    const extraSpace = measurements.docHeight - measurements.viewH - measurements.scrollTop;
    expect(
      extraSpace,
      `/places: extra scroll space after bottom should be minimal (<200px). Got ${extraSpace}px — possible white-block regression`
    ).toBeLessThan(200);
  });

  test('/places: page does not produce horizontal overflow on mobile', async ({ page }) => {
    await setMobileViewport(page);
    await gotoWithRetry(page, '/places');

    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(
      hasHorizontalScroll,
      '/places must not produce horizontal overflow on 390px viewport'
    ).toBe(false);
  });
});

// ─── Combined smoke: dock visible and compact on all main routes ───────────────

test.describe('@mobile dock presence on primary routes', () => {
  const routes = ['/search', '/map', '/quests', '/profile'];

  for (const route of routes) {
    test(`dock is visible and compact on ${route}`, async ({ page }) => {
      await setMobileViewport(page);
      await gotoWithRetry(page, route);

      const dock = page.getByTestId('footer-dock-wrapper');
      await expect(dock).toBeVisible({ timeout: 30_000 });

      const box = await dock.boundingBox();
      expect(box, `dock bounding box must exist on ${route}`).not.toBeNull();
      expect(
        box!.height,
        `dock must be compact on ${route} (height=${box!.height}px)`
      ).toBeLessThanOrEqual(120);
      expect(
        box!.width,
        `dock must span the full viewport on ${route}`
      ).toBeGreaterThanOrEqual(MOBILE_VIEWPORT.width - 10);
    });
  }
});
