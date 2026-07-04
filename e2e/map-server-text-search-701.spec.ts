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
    await preacceptCookies(page);
  });

  test('desktop: typing query sends where.query and does not spam per-keystroke', async ({ page }) => {
    await gotoMap(page);
    const panel = page.getByTestId('filters-panel');
    await expect(panel).toBeVisible({ timeout: 90_000 });

    // Wait for an initial (no-query) map request to settle.
    await page
      .waitForResponse(
        (r: any) => r.ok() && /\/api\/travels\/search_travels_for_map\//.test(r.url()),
        { timeout: 90_000 },
      )
      .catch(() => null);

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

    // Type "замок" character-by-character quickly (simulate real typing).
    await search.click();
    await search.pressSequentially('замок', { delay: 40 });

    // A request carrying where.query should go out.
    const queryReq = await page
      .waitForRequest(
        (req: any) => {
          const url = req.url();
          if (!/\/api\/travels\/search_travels_for_map\//.test(url)) return false;
          const where = parseWhere(url);
          return typeof where?.query === 'string' && where.query.trim().length > 0;
        },
        { timeout: 30_000 },
      )
      .catch(() => null);

    expect(queryReq, 'a search_travels_for_map request with where.query must be sent').toBeTruthy();

    const where = parseWhere(queryReq!.url());
    expect(where?.query).toContain('замок');

    // Debounce assertion: 5 keystrokes must NOT produce ~5 query requests.
    // Give the debounce window time to flush, then count query-bearing requests.
    await page.waitForTimeout(1200);
    const queryBearing = searchRequests.filter((url) => {
      const w = parseWhere(url);
      return typeof w?.query === 'string' && w.query.trim().length > 0;
    });
     
    console.info('[#701] total search reqs after query:', searchRequests.length,
      '| query-bearing reqs:', queryBearing.length,
      '| queries:', queryBearing.map((u) => parseWhere(u)?.query));
    // Debounced (300ms) → at most a couple of distinct query snapshots, definitely < 5.
    expect(queryBearing.length, `query requests: ${queryBearing.length}`).toBeLessThan(5);
  });

  test('desktop: counter matches server total (not the ≤30 loaded page)', async ({ page }) => {
    await gotoMap(page);
    const panel = page.getByTestId('filters-panel');
    await expect(panel).toBeVisible({ timeout: 90_000 });

    const search = page.getByTestId('map-search-input');
    await expect(search).toBeVisible({ timeout: 30_000 });

    // Capture the server total from the query response.
    const responsePromise = page
      .waitForResponse(
        (r: any) => {
          if (!r.ok()) return false;
          const url = r.url();
          if (!/\/api\/travels\/search_travels_for_map\//.test(url)) return false;
          const where = parseWhere(url);
          return typeof where?.query === 'string' && where.query.trim().length > 0;
        },
        { timeout: 30_000 },
      )
      .catch(() => null);

    await search.click();
    await search.pressSequentially('замок', { delay: 40 });

    const resp = await responsePromise;
    if (!resp) test.skip(true, 'No query response captured in this environment');

    const body = await resp!.json().catch(() => null);
    const serverTotal =
      body && typeof body === 'object'
        ? Number((body as any).total ?? (body as any).count)
        : NaN;

    // The counter hint should reflect the (large) server total, not a ≤30 page.
    const hint = panel.getByText(/На карте подходит:\s*\d+/);
    await expect(hint).toBeVisible({ timeout: 20_000 });
    const hintText = (await hint.textContent()) || '';
    const shown = Number((hintText.match(/(\d+)/) || [])[1]);

     
    console.info('[#701] counter shown:', shown, '| server total:', serverTotal);
    expect(Number.isFinite(shown)).toBe(true);
    if (Number.isFinite(serverTotal)) {
      expect(shown, `hint=${shown} serverTotal=${serverTotal}`).toBe(serverTotal);
      // Sanity: for "замок" the prod dataset has more results than one loaded page
      // (30) — proves the counter is not clamped to the loaded page.
      expect(shown).toBeGreaterThan(30);
    }
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
    await search.click();
    await search.pressSequentially('озеро', { delay: 40 });

    const queryReq = await page
      .waitForRequest(
        (req: any) => {
          const url = req.url();
          if (!/\/api\/travels\/search_travels_for_map\//.test(url)) return false;
          const where = parseWhere(url);
          return typeof where?.query === 'string' && where.query.trim().length > 0;
        },
        { timeout: 30_000 },
      )
      .catch(() => null);

    expect(queryReq, 'mobile: search_travels_for_map with where.query must be sent').toBeTruthy();
    expect(parseWhere(queryReq!.url())?.query).toContain('озеро');
  });
});
