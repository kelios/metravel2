import { test, expect } from './fixtures';
import { preacceptCookies } from './helpers/navigation';

// #701 — verify the map text search is server-side:
//  1) typing a query sends where.query to search_travels_for_map
//  2) debounce: fast typing does not issue one request per keystroke
//  3) the "На карте подходит" counter reflects the server total, not the loaded page length

async function installTileMock(page: any) {
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8m2p8AAAAASUVORK5CYII=';
  const png = Buffer.from(pngBase64, 'base64');
  const routeTile = async (route: any) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: png });
  await page.route('**://*.tile.openstreetmap.org/**', routeTile);
  await page.route('**://tile.openstreetmap.org/**', routeTile);
  await page.route('**/proxy/tiles/osm/**', routeTile);
}

const parseWhere = (url: string): any => {
  try {
    const u = new URL(url);
    const where = u.searchParams.get('where');
    return where ? JSON.parse(where) : null;
  } catch {
    return null;
  }
};

const readServerTotal = async (resp: any): Promise<number> => {
  const body = await resp.json().catch(() => null);
  return body && typeof body === 'object'
    ? Number((body as any).total ?? (body as any).count)
    : NaN;
};

const mockPoint = (id: number, address: string) => ({
  id,
  coord: `53.90${id},27.55${id}`,
  address,
  travelImageThumbUrl: '',
  categoryName: 'Природа',
  articleUrl: '',
  urlTravel: `/travels/e2e-map-search-${id}`,
});

async function installMapApiMock(page: any) {
  await page.route('**/api/filterformap/**', (route: any) => route.fulfill({
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
      year: [],
    }),
  }));
  await page.route('**/api/travels/search_travels_for_map/**', (route: any) => {
    const query = String(parseWhere(route.request().url())?.query ?? '').trim();
    const results = query
      ? [mockPoint(1, `${query}: тестовое озеро`), mockPoint(2, `${query}: тестовый парк`)]
      : [mockPoint(1, 'Тестовое озеро'), mockPoint(2, 'Тестовый парк')];

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results, total: query ? 57 : 75 }),
    });
  });
  await page.route('**/api/map/clusters/**', (route: any) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ clusters: [], markers: [], total_count: 0 }),
  }));
  await page.route('**/api/getFiltersTravel/**', (route: any) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({}),
  }));
  await page.route('**/api/countries/**', (route: any) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([]),
  }));
}

const gotoMap = async (page: any) => {
  await page.goto('/map', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  const panel = page.getByTestId('filters-panel');
  const mobileEntry = page
    .locator('[data-testid="map-open-list"], [data-testid="map-peek-expand"], button[aria-label^="Показать список"]')
    .first();
  await Promise.race([
    panel.waitFor({ state: 'visible', timeout: 90_000 }).catch(() => null),
    mobileEntry.waitFor({ state: 'visible', timeout: 90_000 }).catch(() => null),
  ]);
};

test.describe('@smoke #701 map text search is server-side', () => {
  test.beforeEach(async ({ page }) => {
    await installTileMock(page);
    await installMapApiMock(page);
    await preacceptCookies(page);
  });

  test('desktop: typing query sends where.query and does not spam per-keystroke', async ({ page }) => {
    await gotoMap(page);
    const panel = page.getByTestId('filters-panel');
    await expect(panel).toBeVisible({ timeout: 90_000 });

    // Record every search request URL from now on.
    const searchRequests: string[] = [];
    page.on('request', (req: any) => {
      const url = req.url();
      if (/\/api\/travels\/search_travels_for_map\//.test(url)) {
        searchRequests.push(url);
      }
    });

    const search = page.getByTestId('map-search-input');
    await expect(search).toBeVisible({ timeout: 30_000 });

    const queryRequestPromise = page.waitForRequest((req: any) => {
      const url = req.url();
      if (!/\/api\/travels\/search_travels_for_map\//.test(url)) return false;
      return parseWhere(url)?.query === 'замок';
    });

    // Type "замок" character-by-character quickly (simulate real typing).
    await search.click();
    await search.pressSequentially('замок', { delay: 40 });

    const queryReq = await queryRequestPromise;

    const where = parseWhere(queryReq.url());
    expect(where?.query).toBe('замок');

    // Debounce assertion: 5 keystrokes must NOT produce ~5 query requests.
    // Give the debounce window time to flush, then count query-bearing requests.
    await page.waitForTimeout(1200);
    const queryBearing = searchRequests.filter((url) => {
      const w = parseWhere(url);
      return typeof w?.query === 'string' && w.query.trim().length > 0;
    });
     
    const distinctQueries = [...new Set(queryBearing.map((url) => parseWhere(url)?.query))];
    expect(distinctQueries, 'debounce must not send intermediate per-keystroke queries')
      .toEqual(['замок']);
  });

  test('desktop: counter matches server total (not the ≤30 loaded page)', async ({ page }) => {
    await gotoMap(page);
    const panel = page.getByTestId('filters-panel');
    await expect(panel).toBeVisible({ timeout: 90_000 });

    const search = page.getByTestId('map-search-input');
    await expect(search).toBeVisible({ timeout: 30_000 });

    const responsePromise = page.waitForResponse((response: any) => {
      if (!response.ok()) return false;
      if (!/\/api\/travels\/search_travels_for_map\//.test(response.url())) return false;
      return parseWhere(response.url())?.query === 'озеро';
    });

    await search.fill('озеро');
    const response = await responsePromise;
    const serverTotal = await readServerTotal(response);
    expect(serverTotal).toBe(57);

    // The counter hint should reflect the (large) server total, not a ≤30 page.
    const hint = panel.getByText(/На карте подходит:\s*\d+/);
    await expect(hint).toBeVisible({ timeout: 20_000 });
    const hintText = (await hint.textContent()) || '';
    const shown = Number((hintText.match(/(\d+)/) || [])[1]);

     
    expect(Number.isFinite(shown)).toBe(true);
    expect(shown, `hint=${shown} serverTotal=${serverTotal}`).toBe(serverTotal);
  });

  test('mobile (390): query goes to where.query from the filters sheet', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await page.addInitScript(() => {
      window.localStorage.setItem('metravel_map_onboarding_completed', 'true');
    });
    await gotoMap(page);

    // Open the mobile list panel, then the filters view.
    const entry = page
      .locator('[data-testid="map-open-list"], [data-testid="map-peek-expand"], button[aria-label^="Показать список"]')
      .first();
    await expect(entry).toBeVisible({ timeout: 60_000 });
    await entry.click();

    // Reach the filters body (search input lives there).
    await expect
      .poll(
        async () => {
          if (await page.getByTestId('filters-block-main').isVisible().catch(() => false)) return true;
          const openFilters = page
            .locator('[data-testid="travel-list-open-filters"], [data-testid="empty-open-filters"]')
            .first();
          if (await openFilters.isVisible().catch(() => false)) {
            await openFilters.click({ force: true }).catch(() => null);
          }
          return page.getByTestId('filters-block-main').isVisible().catch(() => false);
        },
        { timeout: 30_000 },
      )
      .toBe(true);

    const search = page.getByTestId('map-search-input');
    await expect(search).toBeVisible({ timeout: 20_000 });
    const queryRequestPromise = page.waitForRequest((req: any) => {
      const url = req.url();
      if (!/\/api\/travels\/search_travels_for_map\//.test(url)) return false;
      return parseWhere(url)?.query === 'озеро';
    });

    await search.click();
    await search.pressSequentially('озеро', { delay: 40 });

    const queryReq = await queryRequestPromise;
    expect(parseWhere(queryReq.url())?.query).toBe('озеро');
  });
});
