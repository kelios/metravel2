import { test, expect } from './fixtures';
import { installNoConsoleErrorsGuard } from './helpers/consoleGuards';
import { preacceptCookies } from './helpers/navigation';
import { expectFullyInViewport, expectTopmostAtCenter } from './helpers/layoutAsserts';
import {
  MAP_PANEL_TABS_VIEWPORTS,
  assertMapPanelTabsContract,
  openMapForPanelTabs,
} from './helpers/mapPanelTabs';

async function installTileMock(page: any) {
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8m2p8AAAAASUVORK5CYII=';
  const png = Buffer.from(pngBase64, 'base64');

  const routeTile = async (route: any) => {
    return route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: png,
    });
  };

  await page.route('**://tile.openstreetmap.org/**', routeTile);
  await page.route('**://*.tile.openstreetmap.org/**', routeTile);
  await page.route('**://*.tile.openstreetmap.fr/**', routeTile);
  await page.route('**://*.tile.openstreetmap.de/**', routeTile);
  await page.route('**://tile.waymarkedtrails.org/**', routeTile);
  await page.route('**://*.tile.waymarkedtrails.org/**', routeTile);
  await page.route('**/proxy/tiles/osm/**', routeTile);
}

function buildMockMapPoints(options: {
  center: { lat: number; lng: number };
  count: number;
  spreadDegrees?: number;
}) {
  const { center, count, spreadDegrees = 0.02 } = options;
  const points: any[] = [];

  for (let i = 0; i < count; i++) {
    const angle = (i / Math.max(1, count)) * Math.PI * 2;
    const radius = spreadDegrees * (0.2 + (i % 5) / 6);
    const lat = center.lat + Math.cos(angle) * radius;
    const lng = center.lng + Math.sin(angle) * radius;
    points.push({
      id: 10000 + i,
      coord: `${lat.toFixed(6)},${lng.toFixed(6)}`,
      address: `Mock point ${i + 1}`,
      travelImageThumbUrl: '',
      categoryName: 'Mock',
      articleUrl: '',
      urlTravel: '/travels/mock',
    });
  }

  return points;
}

async function installMobileFiltersPanelMocks(page: any, points: any[]) {
  await page.route('**/api/filterformap/**', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        countries: [],
        categories: [],
        categoryTravelAddress: [{ id: 84, name: 'Замки' }],
        companions: [],
        complexity: [],
        month: [],
        over_nights_stay: [],
        transports: [],
        year: [],
      }),
    });
  });

  await page.route('**/api/travels/search_travels_for_map/**', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: points, total: points.length }),
    });
  });
}

const getCanonicalHref = async (page: any): Promise<string | null> => {
  return page.evaluate(() => {
    const el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    return el?.href || null;
  });
};

const mapTravelsTabSelector = '[data-testid="map-travels-tab"], [testID="map-travels-tab"]';
const mapTravelCardSelector = '[data-testid="map-travel-card"], [testID="map-travel-card"]';
const mobilePanelEntrySelector =
  [
    '[data-testid="map-open-list"]',
    '[testID="map-open-list"]',
    '[data-testid="map-peek-expand"]',
    '[testID="map-peek-expand"]',
    '[data-testid="map-panel-open"]',
    '[testID="map-panel-open"]',
    'button[aria-label="Открыть панель со списком"]',
    'button[aria-label^="Показать список"]',
  ].join(', ');

const getMobilePanelEntry = (page: any) => page.locator(mobilePanelEntrySelector).first();

const getMobileListPanelContent = (page: any) =>
  page
    .locator(
      [
        '[data-testid="travel-list-mobile-summary"]',
        '[testID="travel-list-mobile-summary"]',
        '[data-testid="empty-expand-radius"]',
        '[testID="empty-expand-radius"]',
        '[data-testid="empty-reset-filters"]',
        '[testID="empty-reset-filters"]',
        '[data-testid="empty-open-filters"]',
        '[testID="empty-open-filters"]',
      ].join(', '),
    )
    .first();

const openMobileMapSheet = async (page: any) => {
  const toggle = getMobilePanelEntry(page);
  await expect(toggle).toBeVisible({ timeout: 20_000 });
  await toggle.click();
  await expect(page.getByRole('dialog', { name: 'Панель карты' })).toBeVisible({ timeout: 20_000 });
  await expect(getMobileListPanelContent(page)).toBeVisible({ timeout: 20_000 });
};

const openFiltersWithSingleClick = async (page: any, actionTestId: string) => {
  const action = page.getByTestId(actionTestId).first();
  await expect(action).toBeVisible({ timeout: 20_000 });
  await expectTopmostAtCenter(page, action, actionTestId);
  await action.click();
  await expect(page.getByTestId('filters-block-main')).toBeVisible({ timeout: 10_000 });
};

const maybeRecoverFromMapErrorScreen = async (page: any) => {
  const errorTitle = page.getByText('Что-то пошло не так', { exact: true });
  const hasError = await errorTitle.isVisible().catch(() => false);

  if (!hasError) return;

  // On this error screen actions are rendered as generic clickable elements, not necessarily <button>.
  const reloadButton = page.getByText('Перезагрузить страницу', { exact: true });
  const retryButton = page.getByText('Попробовать снова', { exact: true });

  if (await reloadButton.isVisible().catch(() => false)) {
    await reloadButton.click({ force: true }).catch(() => null);
    return;
  }
  if (await retryButton.isVisible().catch(() => false)) {
    await retryButton.click({ force: true }).catch(() => null);
    return;
  }

  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => null);
};

const waitForMapUi = async (page: any, timeoutMs: number, { throwOnFailure = true } = {}) => {
  const mapReady = page.getByTestId('map-leaflet-wrapper');
  const mobileEntry = getMobilePanelEntry(page);

  await Promise.race([
    mapReady.waitFor({ state: 'visible', timeout: timeoutMs }).catch(() => null),
    mobileEntry.waitFor({ state: 'visible', timeout: timeoutMs }).catch(() => null),
  ]);

  const hasUi =
    (await mapReady.isVisible().catch(() => false)) ||
    (await mobileEntry.isVisible().catch(() => false));
  if (!hasUi && throwOnFailure) throw new Error(`Map UI did not appear (url=${page.url()})`);
  return hasUi;
};

const safeGoto = async (page: any, url: string, opts: any) => {
  let lastErr: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(url, opts);
      return;
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || e);
      if (!msg.includes('ERR_CONNECTION_REFUSED')) throw e;
      await page.waitForTimeout(600);
    }
  }
  throw lastErr;
};

const gotoMapWithRecovery = async (page: any) => {
  const mapReady = page.getByTestId('map-leaflet-wrapper');
  const mobileEntry = getMobilePanelEntry(page);
  const errorTitle = page.getByText('Что-то пошло не так', { exact: true });
  const notFoundTitle = page.getByText('Страница не найдена', { exact: true });
  const plainNotFound = page.getByText('Not found', { exact: true });
  const homeHeadline = page.getByText('Пиши о своих путешествиях', { exact: true });
  const mapTabLink = page.getByRole('link', { name: 'Карта' });
  const mapDockItem = page.getByTestId('footer-item-map');

  const startedAt = Date.now();
  const maxTotalMs = 100_000;
  let notFoundRecoveries = 0;

  await safeGoto(page, '/map', { waitUntil: 'domcontentloaded', timeout: 120_000 });

  while (Date.now() - startedAt < maxTotalMs) {
    // Success condition: UI is present.
    const hasUi =
      (await mapReady.isVisible().catch(() => false)) ||
      (await mobileEntry.isVisible().catch(() => false));
    if (hasUi) return;

    // Sometimes mobile web boots into the Home tab even after direct navigation.
    // If we detect the Home hero, click the "Карта" tab to force the correct route.
    const onHome = await homeHeadline.isVisible().catch(() => false);
    if (onHome) {
      if (await mapDockItem.isVisible().catch(() => false)) {
        await mapDockItem.click({ force: true }).catch(() => null);
      } else if (await mapTabLink.isVisible().catch(() => false)) {
        await mapTabLink.click({ force: true }).catch(() => null);
      }
      await page.waitForURL(/\/map(\?|$)/, { timeout: 5_000 }).catch(() => null);
      await page.waitForTimeout(500).catch(() => null);
      continue;
    }

    // If an error screen is visible, try to recover and keep looping.
    const hasErrorScreen = await errorTitle.isVisible().catch(() => false);
    if (hasErrorScreen) {
      await maybeRecoverFromMapErrorScreen(page);
      // Give the app a chance to reload after clicking.
      await page.waitForTimeout(800).catch(() => null);
      continue;
    }

    const hasNotFound =
      (await notFoundTitle.isVisible().catch(() => false)) ||
      (await plainNotFound.isVisible().catch(() => false));
    if (hasNotFound) {
      if (notFoundRecoveries >= 4) {
        throw new Error(`Map route resolved to Not found after retry (url=${page.url()})`);
      }
      notFoundRecoveries += 1;
      const retryUrl = notFoundRecoveries % 2 === 0 ? `/map?e2eRetry=${notFoundRecoveries}` : '/map';
      await safeGoto(page, retryUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForTimeout(500).catch(() => null);
      continue;
    }

    // If neither UI nor error is visible, we're likely in a loading/transient state.
    await page.waitForTimeout(300).catch(() => null);
  }

  // One last check with a longer wait. A missing map is a failed precondition,
  // never a reason for the calling test to pass without assertions.
  await waitForMapUi(page, 60_000);
};

const openFirstMapMarkerPopup = async (page: any) => {
  const marker = page.locator('.metravel-pin-marker').first();
  await expect(marker).toBeVisible({ timeout: 60_000 });

  const popup = page.locator('.leaflet-popup');
  let popupVisible = false;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await marker.click({ force: true });
    popupVisible = await popup
      .waitFor({ state: 'visible', timeout: attempt === 0 ? 4_000 : 12_000 })
      .then(() => true)
      .catch(() => false);
    if (popupVisible) break;
    await page.waitForTimeout(500);
  }
  expect(popupVisible).toBeTruthy();

  return popup;
};

test.describe('@smoke Map Page (/map) - smoke e2e', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    installNoConsoleErrorsGuard(page);
    await installTileMock(page);
    await preacceptCookies(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('metravel_map_onboarding_completed', 'true');
    });
  });

  test('desktop: map tiles are visible (screenshot)', async ({ page }) => {
    await gotoMapWithRecovery(page);

    const mapWrapper = page.getByTestId('map-leaflet-wrapper');
    await expect(mapWrapper).toBeVisible({ timeout: 60_000 });

    const tile = page.locator('.leaflet-tile-loaded');
    // Wait for multiple fully loaded tiles to reduce flakiness.
    await expect
      .poll(async () => tile.count(), { timeout: 60_000 })
      .toBeGreaterThanOrEqual(4);
    await tile.first().waitFor({ state: 'visible', timeout: 60_000 });

    // Ensure at least one loaded tile image has decoded successfully.
    await expect
      .poll(
        async () => {
          const handle = await tile.first().elementHandle();
          if (!handle) return false;
          return handle.evaluate((el) => {
            const img = el as HTMLImageElement;
            return Boolean(img.complete && img.naturalWidth > 0);
          });
        },
        { timeout: 60_000 }
      )
      .toBe(true);
  });

  test('desktop: loads map and shows filters panel', async ({ page }) => {
    await gotoMapWithRecovery(page);

    await expect(page.getByTestId('map-leaflet-wrapper')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('filters-panel')).toBeVisible({ timeout: 60_000 });

    await expect(page.getByRole('tablist', { name: 'Панель карты' })).toBeVisible();
    // #2217 — names start with the visible label; «Фильтры» is the third tab,
    // selected on start.
    await expect(page.getByRole('tab', { name: /^Места/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Маршрут', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Фильтры', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('searchbox', { name: 'Поиск мест на карте' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Слои и настройки карты' })).toBeVisible();
  });

  test('desktop: sightseeing categories stay visible in the filters panel when API uses localized fields', async ({ page }) => {
    const mockedPoints = [
      {
        id: 20001,
        coord: '54.352000,18.646600',
        address: 'Гданьск',
        travelImageThumbUrl: '',
        categoryName: 'Замки',
        articleUrl: '',
        urlTravel: '/travels/mock-castle',
      },
      {
        id: 20002,
        coord: '54.362100,18.638400',
        address: 'Сопот',
        travelImageThumbUrl: '',
        categoryName: 'Замки, Болота',
        articleUrl: '',
        urlTravel: '/travels/mock-bog',
      },
    ];

    await page.route('**/api/filterformap/**', async (route: any) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          countries: [],
          categories: [],
          categoryTravelAddress: [
            { id: 84, name_ru: 'Замки' },
            { id: 26, title: 'Болота' },
          ],
          companions: [],
          complexity: [],
          month: [],
          over_nights_stay: [],
          transports: [],
          year: '',
        }),
      });
    });

    await page.route('**/api/travels/search_travels_for_map/**', async (route: any) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockedPoints),
      });
    });

    await gotoMapWithRecovery(page);

    const panel = page.getByTestId('filters-panel');
    await expect(panel).toBeVisible({ timeout: 60_000 });

    await panel.getByText('Что посмотреть', { exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Замки', exact: true })).toContainText(/Замки\s*\(2\)/, {
      timeout: 20_000,
    });
    await expect(panel.getByRole('button', { name: 'Болота', exact: true })).toContainText(/Болота\s*\(1\)/, {
      timeout: 20_000,
    });
    await expect(page.getByText('Ничего не найдено', { exact: true })).toHaveCount(0);
  });

  test('desktop: sightseeing categories fall back to map points when filterformap returns an empty list', async ({ page }) => {
    const mockedPoints = [
      {
        id: 21001,
        coord: '54.352000,18.646600',
        address: 'Гданьск',
        travelImageThumbUrl: '',
        categoryName: 'Замок',
        articleUrl: '',
        urlTravel: '/travels/mock-castle',
      },
      {
        id: 21002,
        coord: '54.362100,18.638400',
        address: 'Сопот',
        travelImageThumbUrl: '',
        categoryName: 'Болото, Замок',
        articleUrl: '',
        urlTravel: '/travels/mock-bog',
      },
    ];

    await page.route('**/api/filterformap/**', async (route: any) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          countries: [],
          categories: [],
          categoryTravelAddress: [],
          companions: [],
          complexity: [],
          month: [],
          over_nights_stay: [],
          transports: [],
          year: '',
        }),
      });
    });

    await page.route('**/api/travels/search_travels_for_map/**', async (route: any) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockedPoints),
      });
    });

    await gotoMapWithRecovery(page);

    const panel = page.getByTestId('filters-panel');
    await expect(panel).toBeVisible({ timeout: 60_000 });

    await panel.getByText('Что посмотреть', { exact: true }).click();

    await expect(panel.getByRole('button', { name: 'Замок', exact: true })).toContainText(/Замок\s*\(2\)/, {
      timeout: 20_000,
    });
    await expect(panel.getByRole('button', { name: 'Болото', exact: true })).toContainText(/Болото\s*\(1\)/, {
      timeout: 20_000,
    });
    await expect(page.getByText('Ничего не найдено', { exact: true })).toHaveCount(0);
  });

  test('desktop: shows required map attribution (OpenStreetMap)', async ({ page }) => {
    // The base layer intentionally mounts only after the first map-data result
    // settles and the initial viewport is ready. Keep that precondition local
    // and deterministic instead of racing the default API timeout.
    await installMobileFiltersPanelMocks(page, []);
    await gotoMapWithRecovery(page);

    await expect(page.getByTestId('map-leaflet-wrapper')).toBeVisible({ timeout: 60_000 });

    const attribution = page.locator('.leaflet-control-attribution').first();
    await expect(attribution).toBeVisible({ timeout: 60_000 });
    await expect(attribution).toContainText(/Leaflet/i);
    await expect(attribution).toContainText(/OpenStreetMap/i);
  });

  test('desktop: can enable overlay layer and attribution updates (Waymarked Trails hiking)', async ({ page }) => {
    await installTileMock(page);
    await gotoMapWithRecovery(page);

    await expect(page.getByTestId('filters-panel')).toBeVisible({ timeout: 60_000 });

    const layersButton = page.getByTestId('map-desktop-layers-button');
    await expect(layersButton).toBeVisible({ timeout: 20_000 });
    await layersButton.click();
    await expect(page.getByTestId('map-mobile-layers-popover')).toBeVisible({ timeout: 20_000 });

    // Turn on one tile overlay.
    const overlayRow = page.getByTestId('map-overlay-waymarked-hiking');
    const overlayFallback = page.getByText('Маршруты (Waymarked Trails: hiking)', { exact: true });
    const overlayControl = overlayRow.or(overlayFallback).first();
    await expect(overlayControl).toBeVisible({ timeout: 20_000 });

    const overlayRequest = page
      .waitForRequest((req: any) => {
        try {
          return /tile\.waymarkedtrails\.org\/.+\/(hiking)\//.test(req.url()) || /tile\.waymarkedtrails\.org\/.+\.png/.test(req.url());
        } catch {
          return false;
        }
      }, { timeout: 30_000 })
      .catch(() => null);

    await overlayControl.click({ force: true });

    // Assert we attempted to fetch overlay tiles and attribution contains provider.
    expect(await overlayRequest, 'enabling the Waymarked Trails layer must request its tiles').not.toBeNull();

    const attribution = page.locator('.leaflet-control-attribution').first();
    await expect(attribution).toBeVisible({ timeout: 60_000 });
    await expect(attribution).toContainText(/waymarkedtrails/i, { timeout: 10_000 });
  });

  test('desktop: clicking cluster expands markers (zoom-to-area behavior)', async ({ page }) => {
    await installTileMock(page);

    // Ensure we get enough nearby points to form at least one cluster.
    const mockedPoints = buildMockMapPoints({
      center: { lat: 53.9006, lng: 27.5590 },
      count: 24,
      spreadDegrees: 0.01,
    });

    await page.route('**/api/travels/search_travels_for_map/**', async (route: any) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockedPoints),
      });
    });

    // Filters payload can be requested early; keep it lightweight.
    await page.route('**/api/filterformap/**', async (route: any) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          countries: [],
          categories: [],
          categoryTravelAddress: [],
          companions: [],
          complexity: [],
          month: [],
          over_nights_stay: [],
          transports: [],
          year: '',
        }),
      });
    });

    await page.goto('/map', { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await waitForMapUi(page, 90_000);

    const mapWrapper = page.getByTestId('map-leaflet-wrapper');
    await expect
      .poll(async () => Number(await mapWrapper.getAttribute('data-map-zoom')), { timeout: 30_000 })
      .toBeGreaterThan(0);

    // Radius-mode initialization may legitimately start as close as zoom 14,
    // where a cluster click can spiderfy without changing zoom. Move out first
    // so this scenario deterministically exercises the zoom-to-area branch.
    const zoomOut = page.getByRole('button', { name: 'Отдалить карту', exact: true });
    await expect(zoomOut).toBeVisible({ timeout: 30_000 });
    for (let index = 0; index < 2; index += 1) {
      const zoomBeforeStep = Number(await mapWrapper.getAttribute('data-map-zoom'));
      await zoomOut.click();
      await expect
        .poll(async () => Number(await mapWrapper.getAttribute('data-map-zoom')), { timeout: 10_000 })
        .toBeLessThan(zoomBeforeStep);
    }

    // Wait for clusters to render.
    const clusterIcons = page.locator('.metravel-cluster-icon');
    await expect.poll(() => clusterIcons.count(), { timeout: 30_000 }).toBeGreaterThan(0);

    const clusterNumbers = await clusterIcons.evaluateAll((nodes) =>
      nodes.map((node) => Number.parseInt((node.textContent || '').trim(), 10) || 0)
    );
    const targetClusterIndex = clusterNumbers.reduce((bestIndex, value, index, values) => {
      return value > values[bestIndex] ? index : bestIndex;
    }, 0);
    const clusterIcon = clusterIcons.nth(targetClusterIndex);
    await expect(clusterIcon).toBeVisible({ timeout: 60_000 });

    const zoomBefore = Number(await mapWrapper.getAttribute('data-map-zoom'));

    // Cluster expansion is a map-level zoom contract. The exact number of pin DOM
    // nodes is timing-dependent because Leaflet reclusters them during animation.
    await clusterIcon.click({ force: true });

    await expect
      .poll(async () => Number(await mapWrapper.getAttribute('data-map-zoom')), { timeout: 30_000 })
      .toBeGreaterThan(zoomBefore);
  });

  test('mobile: cluster tap keeps map interactive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await installTileMock(page);

    const mockedPoints = buildMockMapPoints({
      center: { lat: 53.9006, lng: 27.5590 },
      count: 24,
      spreadDegrees: 0.01,
    });

    await page.route('**/api/travels/search_travels_for_map/**', async (route: any) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockedPoints),
      });
    });

    await page.route('**/api/filterformap/**', async (route: any) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          countries: [],
          categories: [],
          categoryTravelAddress: [],
          companions: [],
          complexity: [],
          month: [],
          over_nights_stay: [],
          transports: [],
          year: '',
        }),
      });
    });

    await page.addInitScript(() => {
      window.localStorage.setItem('metravel_map_onboarding_completed', 'true');
    });

    await page.goto('/map', { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await waitForMapUi(page, 90_000);

    const clusterIcons = page.locator('.metravel-cluster-icon');
    await expect.poll(() => clusterIcons.count(), { timeout: 30_000 }).toBeGreaterThan(0);

    const clusterNumbers = await clusterIcons.evaluateAll((nodes) =>
      nodes.map((node) => Number.parseInt((node.textContent || '').trim(), 10) || 0)
    );
    const targetClusterIndex = clusterNumbers.reduce((bestIndex, value, index, values) => {
      return value > values[bestIndex] ? index : bestIndex;
    }, 0);
    const clusterIcon = clusterIcons.nth(targetClusterIndex);
    await expect(clusterIcon).toBeVisible({ timeout: 60_000 });

    await clusterIcon.click({ force: true });
    await page.waitForTimeout(300);

    await expect(page.getByTestId('map-leaflet-wrapper')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Что-то пошло не так', { exact: true })).not.toBeVisible();
  });

  test('desktop: renders markers and opens popup on marker click', async ({ page }) => {
    await installMobileFiltersPanelMocks(
      page,
      buildMockMapPoints({ center: { lat: 53.9006, lng: 27.559 }, count: 2 }),
    );
    await gotoMapWithRecovery(page);

    await expect(page.getByTestId('map-leaflet-wrapper')).toBeVisible({ timeout: 60_000 });

    const popupLocator = await openFirstMapMarkerPopup(page);

    // Smoke check: popup should expose at least one actionable control. Since the
    // picker-sheet redesign the card renders Pressables (no <a> anchors), so assert
    // on the card-action affordance instead of an anchor tag.
    const anyAction = popupLocator.locator('[data-card-action="true"], [role="button"]').first();
    await expect(anyAction).toBeVisible({ timeout: 10_000 });
  });

  test('desktop: popup action opens the related travel details', async ({ page }) => {
    await installMobileFiltersPanelMocks(
      page,
      buildMockMapPoints({ center: { lat: 53.9006, lng: 27.559 }, count: 2 }),
    );
    await gotoMapWithRecovery(page);

    // This scenario owns the marker-popup action contract. The mocked list and
    // the independently loaded cluster layer can contain different coordinates,
    // so interact with a marker that is actually rendered on the map.
    const popupLocator = await openFirstMapMarkerPopup(page);

    const openDetails = popupLocator.getByRole('button', { name: /Открыть статью|Открыть страницу/i }).first();
    await expect(openDetails).toBeVisible({ timeout: 10_000 });

    const detailsPagePromise = page.waitForEvent('popup', { timeout: 20_000 });
    await openDetails.click();
    const detailsPage = await detailsPagePromise;
    await expect(detailsPage).toHaveURL(/\/(travel|travels)\//, { timeout: 20_000 });
    await detailsPage.close();
  });

  test('desktop: applying category filter updates markers and sends category filters', async ({ page }) => {
    const mapPoints = [
      {
        id: 22001,
        coord: '53.900600,27.559000',
        address: 'Тестовый замок',
        travelImageThumbUrl: '',
        categoryName: 'Замки',
        articleUrl: '',
        urlTravel: '/travels/e2e-category-filter',
      },
    ];

    await page.route('**/api/filterformap/**', (route: any) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        countries: [],
        categories: [],
        categoryTravelAddress: [{ id: 84, name: 'Замки' }],
        companions: [],
        complexity: [],
        month: [],
        over_nights_stay: [],
        transports: [],
        year: [],
      }),
    }));
    await page.route('**/api/travels/search_travels_for_map/**', (route: any) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: mapPoints, total: mapPoints.length }),
    }));

    await gotoMapWithRecovery(page);

    await expect(page.getByTestId('filters-panel')).toBeVisible({ timeout: 60_000 });

    const panel = page.getByTestId('filters-panel');
    const categoryOption = panel.locator('[data-testid^="category-option-"]').first();
    await expect(categoryOption).toBeVisible({ timeout: 20_000 });

    const filteredRequestPromise = page.waitForRequest((request: any) => {
      if (!/\/api\/travels\/search_travels_for_map\//.test(request.url())) return false;
      const where = new URL(request.url()).searchParams.get('where');
      if (!where) return false;
      try {
        const parsed = JSON.parse(where);
        return Array.isArray(parsed?.categoryTravelAddress) && parsed.categoryTravelAddress.length > 0;
      } catch {
        return false;
      }
    }, { timeout: 20_000 });

    await categoryOption.click({ force: true });
    await expect(categoryOption).toHaveAttribute('aria-pressed', 'true', {
      timeout: 5_000,
    });

    const filteredRequest = await filteredRequestPromise;
    const filteredWhere = JSON.parse(new URL(filteredRequest.url()).searchParams.get('where') || '{}');
    expect(filteredWhere.categoryTravelAddress).toContain(84);
    await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible({ timeout: 30_000 });
  });

  test('desktop: SEO title and canonical are set for /map', async ({ page }) => {
    await gotoMapWithRecovery(page);

    // H1 should be present (static export) even if InstantSEO title updates are delayed.
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible({ timeout: 60_000 });

    // Soft-check: title eventually contains map keyword (branding may vary).
    await expect(page).toHaveTitle(/Карта/i, { timeout: 60_000 });

    const canonical = await getCanonicalHref(page);
    expect(canonical, 'canonical link must be present').toBeTruthy();
    expect(canonical || '').toMatch(/\/map(\?|$)/);
  });

  test('desktop: remains usable when a map data request fails', async ({ page }) => {
    let requestCount = 0;
    await page.route('**/api/travels/search_travels_for_map/**', async (route: any) => {
      requestCount += 1;
      if (requestCount === 1) {
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'Injected 503' }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.goto('/map', { waitUntil: 'domcontentloaded', timeout: 120_000 });

    await waitForMapUi(page, 90_000);
    expect(requestCount, 'the injected failing map request must be exercised').toBeGreaterThanOrEqual(1);
    await expect(page.getByText('Что-то пошло не так', { exact: true })).toHaveCount(0);
  });

  test('desktop: can switch to route mode and sees route builder', async ({ page }) => {
    await gotoMapWithRecovery(page);

    // Wait for panel hydration before interacting with controls.
    await expect(page.getByTestId('filters-panel')).toBeVisible({ timeout: 60_000 });
    const routeTab = page.getByTestId('map-panel-tab-route');
    await expect(routeTab).toBeVisible({ timeout: 30_000 });
    await routeTab.click({ timeout: 60_000 });

    await expect(page.getByTestId('route-builder')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('filters-build-route-button')).toBeVisible();
    await expect(page.getByTestId('filters-panel-footer')).toBeVisible();
  });

  // #2252 — «Фильтры» меняют только режим: две точки маршрута остаются в
  // сторе и в persist (`route-storage`), переживают перезагрузку и снова видны
  // во вкладке «Маршрут».
  test('desktop: «Фильтры» tab keeps the built route (#2252)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      // Только первый заход: перезагрузка обязана прочитать то, что оставило приложение.
      if (window.localStorage.getItem('route-storage')) return;
      window.localStorage.setItem(
        'route-storage',
        JSON.stringify({
          state: {
            transportMode: 'car',
            points: [
              { id: 's', coordinates: { lat: 53.9006, lng: 27.559 }, address: 'Start', type: 'start', timestamp: 1 },
              { id: 'e', coordinates: { lat: 53.9154, lng: 27.5461 }, address: 'End', type: 'end', timestamp: 2 },
            ],
          },
          version: 0,
        }),
      );
    });
    const persistedPointCount = () =>
      page.evaluate(() => {
        const raw = window.localStorage.getItem('route-storage');
        const points = raw ? JSON.parse(raw)?.state?.points : null;
        return Array.isArray(points) ? points.length : 0;
      });

    await gotoMapWithRecovery(page);
    await expect(page.getByTestId('filters-panel')).toBeVisible({ timeout: 60_000 });

    await page.getByTestId('map-panel-tab-route').click({ timeout: 60_000 });
    await expect(page.getByTestId('route-builder')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('map-panel-tab-filters').click();
    await expect(page.getByTestId('map-panel-tab-filters')).toHaveAttribute('aria-selected', 'true');
    expect(await persistedPointCount()).toBe(2);

    await page.reload();
    await expect(page.getByTestId('filters-panel')).toBeVisible({ timeout: 60_000 });
    expect(await persistedPointCount()).toBe(2);
  });

  test('desktop: route polyline is visible after entering start/end coordinates', async ({ page }, testInfo) => {
    await installTileMock(page);
    await page.addInitScript(() => {
      try {
        window.localStorage.removeItem('route-storage');
      } catch {
        // ignore
      }
    });
    await gotoMapWithRecovery(page);

    await expect(page.getByTestId('filters-panel')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('map-panel-tab-route').click({ timeout: 60_000 });
    await expect(page.getByTestId('route-builder')).toBeVisible({ timeout: 20_000 });

    const mapContainer = page.locator('.leaflet-container').first();
    await expect(mapContainer).toBeVisible({ timeout: 60_000 });

    // Enter coordinates into Start/Finish inputs (AddressSearch supports coordinate input).
    // This matches the real user flow seen in QA (not map clicks).
    const startInput = page.getByPlaceholder('Старт');
    const endInput = page.getByPlaceholder('Финиш');

    await expect(startInput).toBeVisible({ timeout: 30_000 });
    await expect(endInput).toBeVisible({ timeout: 30_000 });

    await startInput.click({ force: true });
    await startInput.fill('53.9006, 27.5590');
    // Trigger onSubmitEditing on RN-web
    await startInput.press('Enter');
    // Ensure blur in case Enter is not wired
    await startInput.press('Tab');

    await endInput.click({ force: true });
    await endInput.fill('53.4539, 26.4729');
    await endInput.press('Enter');
    await endInput.press('Tab');

    // Build/refresh route (button exists in route mode)
    const buildBtn = page.getByTestId('filters-build-route-button');
    await expect(buildBtn).toBeVisible({ timeout: 30_000 });
    await buildBtn.click({ force: true });

    // Wait for the route line to appear. Route building can be async and may lag behind
    // the "Маршрут построен" toast/state update.
    const routeLine = page.locator('svg path.metravel-route-line').first();
    await expect
      .poll(async () => routeLine.count(), { timeout: 90_000 })
      .toBeGreaterThan(0);

    await expect
      .poll(
        async () =>
          routeLine
            .evaluate((el) => {
              const anyEl = el as any;
              if (typeof anyEl.getTotalLength !== 'function') return 0;
              try {
                return Number(anyEl.getTotalLength()) || 0;
              } catch {
                return 0;
              }
            })
            .catch(() => 0),
        { timeout: 90_000 }
      )
      .toBeGreaterThan(10);

    // Wait until Leaflet tiles actually render; otherwise the map can be covered by a loader overlay,
    // and the route line may exist in DOM but not be visually visible to the user.
    await expect
      .poll(async () => {
        try {
          return await page.locator('.leaflet-tile-loaded').count();
        } catch {
          return 0;
        }
      }, { timeout: 60_000 })
      .toBeGreaterThan(0);

    try {
      const shotPath = testInfo.outputPath('route-after-build.png');
      await mapContainer.screenshot({ path: shotPath });
      await testInfo.attach('route-after-build', { path: shotPath, contentType: 'image/png' });
    } catch {
      // ignore screenshot errors
    }

    // Diagnostics: use the same strict SVG-path selector as the visibility checks.
    // Leaflet can replace its path nodes during a redraw, so two back-to-back counts
    // with different selectors can observe opposite sides of that replacement.
    const pathRouteLineCount = await page.locator('svg path.metravel-route-line').count();
    // Keep visible in CI output to debug mismatches with local manual checks.
    console.info('[e2e] route line diagnostics', {
      pathRouteLineCount,
    });

    await expect(routeLine).toBeVisible({ timeout: 60_000 });

    const totalLen = await routeLine
      .evaluate((el) => {
        const anyEl = el as any;
        if (typeof anyEl.getTotalLength !== 'function') return 0;
        try {
          return Number(anyEl.getTotalLength()) || 0;
        } catch {
          return 0;
        }
      })
      .catch(() => 0);

    console.info('[e2e] route line total length', { totalLen });
    expect(pathRouteLineCount, 'route line must be an SVG path on web').toBeGreaterThan(0);
    expect(totalLen, 'route line SVG path must have non-zero length').toBeGreaterThan(10);

    // Stronger assertions: the polyline must be visually drawable (stroke + opacity + width)
    // and must be inside the visible map viewport (intersects the map container).
    const computeVisibility = async () => {
      const mapBox = await mapContainer.boundingBox().catch(() => null);
      const lineBox = await routeLine.boundingBox().catch(() => null);
      if (!mapBox || !lineBox) {
        return { ok: false, reason: 'missing-bbox' } as any;
      }

      const style = await routeLine.evaluate((el) => {
        const s = window.getComputedStyle(el as Element);
        const anyEl = el as any;
        const attrStroke = typeof anyEl.getAttribute === 'function' ? anyEl.getAttribute('stroke') : null;
        const attrOpacity = typeof anyEl.getAttribute === 'function' ? anyEl.getAttribute('stroke-opacity') : null;
        const attrWidth = typeof anyEl.getAttribute === 'function' ? anyEl.getAttribute('stroke-width') : null;
        let totalLength = 0;
        try {
          if (typeof anyEl.getTotalLength === 'function') {
            totalLength = Number(anyEl.getTotalLength()) || 0;
          }
        } catch {
          totalLength = 0;
        }
        return {
          display: s.display,
          visibility: s.visibility,
          stroke: s.stroke,
          strokeOpacity: (s as any).strokeOpacity,
          strokeWidth: s.strokeWidth,
          opacity: s.opacity,
          attrStroke,
          attrOpacity,
          attrWidth,
          totalLength,
        };
      }).catch(() => null);

      if (!style) return { ok: false, reason: 'no-style' } as any;

      const stroke = String(style.stroke || style.attrStroke || '').trim();
      const opacityRaw = style.strokeOpacity || style.opacity || style.attrOpacity;
      const widthRaw = style.strokeWidth || style.attrWidth;
      const opacity = Number(String(opacityRaw ?? '').replace('px', ''));
      const width = Number(String(widthRaw ?? '').replace('px', ''));

      const hasDrawableStroke = !!stroke && stroke !== 'none' && stroke !== 'transparent' && stroke !== 'rgba(0, 0, 0, 0)';
      const hasOpacity = Number.isFinite(opacity) && opacity > 0.05;
      const hasWidth = Number.isFinite(width) && width >= 2;

      const minSizeOk = (lineBox.width + lineBox.height) > 6;
      const hasLength = Number(style.totalLength) > 10;

      const intersects = !(
        lineBox.x > mapBox.x + mapBox.width ||
        lineBox.x + lineBox.width < mapBox.x ||
        lineBox.y > mapBox.y + mapBox.height ||
        lineBox.y + lineBox.height < mapBox.y
      );

      const basicOk =
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        hasDrawableStroke &&
        hasOpacity &&
        hasWidth &&
        minSizeOk &&
        hasLength &&
        intersects;

      const loadingTextVisible = await page
        .getByText('Загрузка карты...', { exact: true })
        .isVisible()
        .catch(() => false);

      return {
        ok: basicOk && !loadingTextVisible,
        basicOk,
        hasDrawableStroke,
        hasOpacity,
        hasWidth,
        minSizeOk,
        hasLength,
        intersects,
        loadingTextVisible,
        style,
        mapBox,
        lineBox,
      };
    };

    let last: any = null;
    const started = Date.now();
    while (Date.now() - started < 60_000) {
      last = await computeVisibility();
      if (last?.ok) break;
      await page.waitForTimeout(250);
    }

    if (!last?.ok) {
      console.info('[e2e] route line visibility failure', last);
    }
    expect(last?.ok, `route line must be visible on top (diagnostics: ${JSON.stringify(last)})`).toBe(true);
  });

  test('desktop: changing radius persists to localStorage (map-filters)', async ({ page }) => {
    await gotoMapWithRecovery(page);

    await expect(page.getByTestId('filters-panel')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('map-desktop-radius-button').click();
    const radius100 = page.getByTestId('map-mobile-radius-option-100');
    await expect(radius100).toBeVisible({ timeout: 30_000 });

    await radius100.click();

    const saved = await page.evaluate(() => {
      try {
        return window.localStorage.getItem('map-filters');
      } catch {
        return null;
      }
    });

    expect(saved, 'map-filters must be stored in localStorage after changing radius').toBeTruthy();
    const parsed = saved ? JSON.parse(saved) : null;
    expect(parsed?.radius).toBe('100');
  });

  test('desktop: can open travels tab in right panel', async ({ page }) => {
    await gotoMapWithRecovery(page);

    // Wait for panel hydration before interacting with tabs.
    await expect(page.getByTestId('filters-panel')).toBeVisible({ timeout: 60_000 });

    const travelsTab = page.getByTestId('map-panel-tab-travels');
    const listTab = page.getByRole('tab', { name: /^Места/ }).first();
    const hasTravelsTab = await travelsTab.isVisible({ timeout: 30_000 }).catch(() => false);
    const tab = hasTravelsTab ? travelsTab : listTab;
    await expect(tab).toBeVisible({ timeout: 10_000 });

    // Retry click — first click may fire before React handlers are wired.
    for (let attempt = 0; attempt < 3; attempt++) {
      await tab.click({ force: attempt > 0, timeout: 60_000 }).catch(() => null);
      if (await page.locator(mapTravelsTabSelector).isVisible().catch(() => false)) break;
      await page.waitForLoadState('domcontentloaded').catch(() => null);
    }
    await expect(page.locator(mapTravelsTabSelector)).toBeVisible({ timeout: 30_000 });
  });

  test('desktop: clicking a travel card opens popup and focuses map', async ({ page }) => {
    await installMobileFiltersPanelMocks(
      page,
      buildMockMapPoints({ center: { lat: 53.9006, lng: 27.559 }, count: 2 }),
    );
    await gotoMapWithRecovery(page);

    await expect(page.getByTestId('filters-panel')).toBeVisible({ timeout: 60_000 });

    const travelsTab = page.getByTestId('map-panel-tab-travels');
    const listTab = page.getByRole('tab', { name: /^Места/ }).first();
    const hasTravelsTab = await travelsTab.isVisible({ timeout: 30_000 }).catch(() => false);
    const tab = hasTravelsTab ? travelsTab : listTab;
    await expect(tab).toBeVisible({ timeout: 10_000 });
    await tab.click({ force: true, timeout: 60_000 });
    await expect(page.locator(mapTravelsTabSelector)).toBeVisible({ timeout: 60_000 });

    const cards = page.locator(mapTravelCardSelector);
    await expect.poll(() => cards.count(), { timeout: 30_000 }).toBeGreaterThan(0);

    // Ensure map markers are mounted so openPopupForCoord has something to target.
    await page.locator('.leaflet-marker-icon').first().waitFor({ state: 'visible', timeout: 30_000 });

    await cards.first().click({ position: { x: 16, y: 16 } });

    // Leaflet popup rendered in DOM.
    const popupLocator = page.locator('.leaflet-popup');
    const opened = await popupLocator.isVisible({ timeout: 8_000 }).catch(() => false);
    if (!opened) {
      const marker = page.locator('.leaflet-marker-icon').first();
      if (await marker.isVisible().catch(() => false)) {
        await marker.click({ force: true });
      }
    }
    await expect(popupLocator).toBeVisible({ timeout: 20_000 });
  });

  test('desktop: scroll reaches footer area', async ({ page }) => {
    await gotoMapWithRecovery(page);

    const scroll = page.getByTestId('filters-panel-scroll');
    await expect(scroll).toBeVisible();

    await scroll.evaluate((el: any) => {
      el.scrollTop = el.scrollHeight;
    });

    // Footer всегда должен быть на странице; «Сбросить» живёт в нём, а не в
    // шапке панели (#2217).
    await expect(page.getByTestId('filters-panel-footer')).toBeVisible();
    await expect(page.getByTestId('filters-panel-footer').getByTestId('filters-reset-button')).toBeVisible();
    await expect(page.getByTestId('map-reset-filters-button')).toHaveCount(0);
  });

  test('mobile: compact preview opens list panel', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 });
    await installMobileFiltersPanelMocks(
      page,
      buildMockMapPoints({ center: { lat: 53.9, lng: 27.56 }, count: 1 }),
    );

    await gotoMapWithRecovery(page);

    // На мобильном панель закрыта по умолчанию, должна быть видна кнопка меню
    const toggle = getMobilePanelEntry(page);
    await expect(toggle).toBeVisible({ timeout: 20_000 });
    await toggle.click();

    // Menu toggle should open the current mobile bottom sheet with the list content.
    await expect(page.getByRole('dialog', { name: 'Панель карты' })).toBeVisible({ timeout: 20_000 });
    await expect(getMobileListPanelContent(page)).toBeVisible({ timeout: 20_000 });

    // Закрытие через крестик (если доступен) либо повторный toggle кнопкой меню
    // Close via the header menu button (toggle).
  });

  test('mobile: panel close button is topmost and FAB does not overlay panel', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 });
    await installMobileFiltersPanelMocks(
      page,
      buildMockMapPoints({ center: { lat: 53.9, lng: 27.56 }, count: 1 }),
    );

    await gotoMapWithRecovery(page);

    const toggle = getMobilePanelEntry(page);
    await expect(toggle).toBeVisible({ timeout: 20_000 });
    await toggle.click();

    const close = page.getByTestId('map-mobile-sheet-close');
    await expect(close).toBeVisible({ timeout: 20_000 });
    await expect(getMobileListPanelContent(page)).toBeVisible({ timeout: 20_000 });

    await expectFullyInViewport(close, page, { label: 'map panel close', margin: 2 });
    await expectTopmostAtCenter(page, close, 'map panel close');

    // FAB must not be visible above the panel when the panel is open.
    const fab = page.locator('[data-testid="map-mobile-fab"], [testID="map-mobile-fab"]');
    await expect(fab).toHaveCount(0);
  });

  test('mobile: close button collapses panel back to compact preview', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 });
    // Keep this transition test independent from live markers: a concurrently
    // selected place intentionally replaces the compact preview with the place
    // card and would turn an unrelated API/map event into a false failure.
    await installMobileFiltersPanelMocks(page, []);

    await gotoMapWithRecovery(page);

    const toggle = getMobilePanelEntry(page);
    await expect(toggle).toBeVisible({ timeout: 20_000 });
    await toggle.click();

    // Закрываем панель повторным нажатием на кнопку меню (toggle).
    const close = page.getByTestId('map-mobile-sheet-close');
    const sheet = page.getByRole('dialog', { name: 'Панель карты' });
    await expect(close).toBeVisible({ timeout: 20_000 });
    await expect(sheet).toBeVisible({ timeout: 20_000 });
    // The sheet grows with a CSS height transition. A forced click bypasses
    // Playwright's stability/actionability wait, so RN Web can cancel onPress
    // when the close button moves between pointerdown and pointerup.
    await expectTopmostAtCenter(page, close, 'map panel close');
    await close.click();

    // A single close action must complete the transition. Re-clicking the
    // still-visible button during the closing animation can toggle the sheet
    // back open and makes this assertion race with the animation itself.
    await expect(sheet).toBeHidden({ timeout: 20_000 });
    await expect(close).toBeHidden({ timeout: 20_000 });
    await expect(getMobilePanelEntry(page)).toBeVisible({ timeout: 20_000 });
  });

  test('mobile: double click on compact preview entry does not cause panel flicker (stays open)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 });
    await installMobileFiltersPanelMocks(
      page,
      buildMockMapPoints({ center: { lat: 53.9, lng: 27.56 }, count: 1 }),
    );

    await gotoMapWithRecovery(page);

    const toggle = getMobilePanelEntry(page);
    await expect(toggle).toBeVisible({ timeout: 20_000 });

    // Regression: RN-web Pressable can emit double events; panel should not open then immediately close.
    await toggle.dblclick();

    const sheet = page.getByRole('dialog', { name: 'Панель карты' });
    await expect(sheet).toBeVisible({ timeout: 20_000 });
    await expect(getMobileListPanelContent(page)).toBeVisible({ timeout: 20_000 });

    // Give the UI a moment: if there is flicker, it would have collapsed by now.
    await page.waitForFunction(() => true, null, { timeout: 500 }).catch(() => null);
    await expect(sheet).toBeVisible();
    await expect(getMobileListPanelContent(page)).toBeVisible();
  });

  test('mobile: list filters action opens filters with one regular click', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 720 });
    await installMobileFiltersPanelMocks(
      page,
      buildMockMapPoints({ center: { lat: 53.9, lng: 27.56 }, count: 1 }),
    );

    await gotoMapWithRecovery(page);
    await openMobileMapSheet(page);
    await expect(page.getByTestId('travel-list-mobile-summary')).toBeVisible({ timeout: 20_000 });
    await openFiltersWithSingleClick(page, 'travel-list-open-filters');

    await testInfo.attach('mobile-list-filters-open', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });

  test('mobile: empty-state filters action opens filters with one regular click', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 720 });
    await installMobileFiltersPanelMocks(page, []);

    await gotoMapWithRecovery(page);
    await openMobileMapSheet(page);
    await expect(page.getByTestId('empty-open-filters')).toBeVisible({ timeout: 20_000 });
    await openFiltersWithSingleClick(page, 'empty-open-filters');

    await testInfo.attach('mobile-empty-filters-open', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });
});

// #2217 — the desktop-branch panel header tabs at the iPad width, with the count
// above the cap («999+»): every child of every tab inside the tab, no ellipsis,
// 44 high, the 8 px reserve, one selected tab. All sizes and languages run
// against the production build in `map-panel-tabs-production-smoke.spec.ts`.
test.describe('Map panel header tabs (#2217)', () => {
  test.beforeEach(async ({ page }) => {
    await installTileMock(page);
  });

  for (const locale of ['ru', 'pl'] as const) {
    test(`desktop 820x1180 ${locale}: tab content stays inside the tab`, async ({ page }) => {
      const viewport = MAP_PANEL_TABS_VIEWPORTS.find((item) => item.name === '820x1180');
      if (!viewport) throw new Error('820x1180 is part of MAP_PANEL_TABS_VIEWPORTS');
      await openMapForPanelTabs(page, { viewport, locale });
      await assertMapPanelTabsContract(page, `820x1180 ${locale}`);
    });
  }
});

// #2245 (MAP-PANEL-UNCLIPPED-CORNERS-001) — the desktop panel does not clip its
// children (the collapse button and the resize handle sit past its edge), so
// every edge child with its own fill must round the panel's corner itself.
// 1.5 px inside each vertex of the panel box nothing of the panel subtree with
// an opaque background may be hit; 24 px inside, the header must be — otherwise
// the probe could pass on an empty stack.
test.describe('Map panel corners (#2245)', () => {
  const CORNER_VIEWPORTS = [
    { width: 820, height: 1180 },
    { width: 1180, height: 820 },
    { width: 1440, height: 900 },
  ];

  test.beforeEach(async ({ page }) => {
    await installTileMock(page);
    await preacceptCookies(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('metravel_map_onboarding_completed', 'true');
    });
  });

  for (const theme of ['light', 'dark'] as const) {
    for (const viewport of CORNER_VIEWPORTS) {
      test(`desktop ${viewport.width}x${viewport.height} ${theme}: no square header corners`, async ({ page }) => {
        await page.addInitScript((saved) => {
          window.localStorage.setItem('theme', saved);
        }, theme);
        await page.setViewportSize(viewport);
        await gotoMapWithRecovery(page);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        const collapseButton = page.getByTestId('map-panel-collapse-button');
        await expect(collapseButton).toBeVisible({ timeout: 60_000 });
        await expect(page.getByTestId('map-panel-tab-filters')).toBeVisible({ timeout: 60_000 });

        const probe = await page.evaluate(() => {
          const button = document.querySelector('[data-testid="map-panel-collapse-button"]');
          const panel = button?.parentElement;
          if (!panel) return null;
          const box = panel.getBoundingClientRect();
          const isOpaque = (el: Element) => {
            const color = getComputedStyle(el).backgroundColor;
            if (!color || color === 'transparent') return false;
            const alpha = color.match(/rgba?\(([^)]+)\)/)?.[1]?.split(',')[3];
            return alpha === undefined || Number(alpha) > 0;
          };
          const paintedBy = (x: number, y: number) =>
            document
              .elementsFromPoint(x, y)
              .filter((el) => el !== panel && panel.contains(el) && isOpaque(el))
              .map((el) => `${el.tagName}.${(el.getAttribute('data-testid') || '')}`);
          const inset = 1.5;
          const control = 24;
          return {
            top: [
              paintedBy(box.left + inset, box.top + inset),
              paintedBy(box.right - inset, box.top + inset),
            ],
            bottom: [
              paintedBy(box.left + inset, box.bottom - inset),
              paintedBy(box.right - inset, box.bottom - inset),
            ],
            control: paintedBy(box.left + control, box.top + control),
            // The header is the panel's direct child that holds the tabs.
            headerRadius: (() => {
              const tab = panel.querySelector('[data-testid="map-panel-tab-filters"]');
              const header = Array.from(panel.children).find((child) => child.contains(tab));
              if (!header) return null;
              const style = getComputedStyle(header);
              return [style.borderTopLeftRadius, style.borderTopRightRadius];
            })(),
          };
        });

        expect(probe, 'panel must be the parent of map-panel-collapse-button').not.toBeNull();
        expect(probe!.control.length, 'control point must hit the panel header').toBeGreaterThan(0);
        expect(probe!.top).toEqual([[], []]);
        expect(probe!.headerRadius).toEqual(['20px', '20px']);
        // At 768–1279 px the bottom dock covers the panel's bottom edge; the
        // bottom corners are asserted only where the dock is absent.
        if (viewport.width >= 1280) {
          expect(probe!.bottom).toEqual([[], []]);
        }
      });
    }
  }
});

// #2263 — «Подсказки» live on the map and are pressable with the panel
// collapsed into the 56 strip. Steps 2–4 point at the panel tabs: the button
// expands the panel first, so every step's card stands under its target
// (TOOLTIP_GAP_PX 12 + 4 px tolerance), not in the middle of the window.
test.describe('Map tour with the panel collapsed (#2263)', () => {
  test.beforeEach(async ({ page }) => {
    await installTileMock(page);
    await preacceptCookies(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('metravel_map_onboarding_completed', 'true');
    });
  });

  test('desktop 1180x820: tour steps 2–4 stand under their tabs', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await gotoMapWithRecovery(page);
    await expect(page.getByTestId('map-panel-collapse-button')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('map-panel-collapse-button').click();
    await expect(page.getByTestId('map-panel-expand-button')).toBeVisible({ timeout: 15_000 });

    // The tour mounts after the idle window (`shouldLoadOnboarding`); a press
    // before that is replayed on mount (#2251), so one press is enough. A retry
    // loop would click through the tour's own overlay once it is up.
    await page.getByTestId('map-desktop-help-button').click();
    await expect(page.getByTestId('onboarding-card')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('map-panel-expand-button')).toHaveCount(0);

    for (const target of ['map-panel-tab-filters', 'map-panel-tab-travels', 'map-panel-tab-route']) {
      await page.getByTestId('onboarding-next').click();
      await expect
        .poll(
          async () => {
            const targetBox = await page.getByTestId(target).boundingBox();
            const cardBox = await page.getByTestId('onboarding-card').boundingBox();
            if (!targetBox || !cardBox) return null;
            return Math.round(cardBox.y - (targetBox.y + targetBox.height));
          },
          { timeout: 10_000, message: `tour card must stand under ${target}` },
        )
        .toBeGreaterThanOrEqual(0);
      const targetBox = await page.getByTestId(target).boundingBox();
      const cardBox = await page.getByTestId('onboarding-card').boundingBox();
      const gap = cardBox!.y - (targetBox!.y + targetBox!.height);
      expect(gap, `gap under ${target}`).toBeLessThanOrEqual(12 + 4);
    }
  });
});

// #2220 — in the desktop branch the panel's collapse chevron reaches 32 px into
// the map; the location-quality pill shares that corner. A fix with accuracy
// 150 m (> 100 m) shows «Низкая точность геолокации»; the two boxes must not
// intersect on either axis-pair (before: ~15 px horizontal overlap).
test.describe('Map location-quality pill vs collapse chevron (#2220)', () => {
  test.beforeEach(async ({ page }) => {
    await installTileMock(page);
    await preacceptCookies(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('metravel_map_onboarding_completed', 'true');
    });
    await page.context().grantPermissions(['geolocation']);
    await page.context().setGeolocation({ latitude: 53.9006, longitude: 27.559, accuracy: 150 });
  });

  for (const viewport of [
    { width: 820, height: 1180 },
    { width: 1180, height: 820 },
    { width: 1440, height: 900 },
  ]) {
    test(`desktop ${viewport.width}x${viewport.height}: the pill and the chevron do not overlap`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await gotoMapWithRecovery(page);
      const chevron = page.getByTestId('map-panel-collapse-button');
      const pill = page.getByTestId('map-location-quality');
      await expect(chevron).toBeVisible({ timeout: 60_000 });
      await expect(pill).toBeVisible({ timeout: 60_000 });

      const a = await chevron.boundingBox();
      const b = await pill.boundingBox();
      expect(a && b).toBeTruthy();
      const overlapX = Math.min(a!.x + a!.width, b!.x + b!.width) - Math.max(a!.x, b!.x);
      const overlapY = Math.min(a!.y + a!.height, b!.y + b!.height) - Math.max(a!.y, b!.y);
      expect(
        overlapX <= 0 || overlapY <= 0,
        `pill ${JSON.stringify(b)} vs chevron ${JSON.stringify(a)}`,
      ).toBe(true);
      // The chevron stays the topmost node at its centre: still pressable.
      const topmost = await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return Boolean(el?.closest('[data-testid="map-panel-collapse-button"]'));
      }, { x: a!.x + a!.width / 2, y: a!.y + a!.height / 2 });
      expect(topmost).toBe(true);
    });
  }
});
