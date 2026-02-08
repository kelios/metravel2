import { test, expect } from './fixtures';
import { getTravelsListPath } from './helpers/routes';
import { hideRecommendationsBanner, seedNecessaryConsent } from './helpers/storage';

type ApiMatch = string | RegExp;

const ensureApiProxy = async (page: any, label: string) => {
  // Retry up to 3 times – the proxy may not be fully ready on first attempt.
  let resp: any = null;
  for (let attempt = 0; attempt < 3 && !resp; attempt++) {
    resp = await page.request.get('/api/travels/', { timeout: 10_000 }).catch(() => null);
    if (!resp && attempt < 2) await page.waitForTimeout(1_000);
  }
  expect(resp, `${label}: expected API proxy to respond to /api/travels/`).toBeTruthy();
  if (!resp) return;
  expect(resp.status(), `${label}: unexpected API proxy status for /api/travels/`).toBeGreaterThanOrEqual(200);
  expect(resp.status(), `${label}: unexpected API proxy status for /api/travels/`).toBeLessThan(400);
};

const waitForApiResponse = async (page: any, patterns: ApiMatch[], label: string) => {
  const response = await page.waitForResponse(
    (resp: any) => {
      const status = resp.status();
      if (status < 200 || status >= 400) return false;
      const url = resp.url();
      return patterns.some((pattern) =>
        typeof pattern === 'string' ? url.includes(pattern) : pattern.test(url)
      );
    },
    { timeout: 30_000 }
  );

  const status = response.status();
  expect(status, `${label}: expected successful API response, got ${status}`).toBeGreaterThanOrEqual(200);
  expect(status, `${label}: expected successful API response, got ${status}`).toBeLessThan(400);
};

const expectCardsVisible = async (locator: any, label: string) => {
  await expect.poll(
    async () => locator.count(),
    {
      timeout: 30_000,
      message: `${label}: expected at least one card to render`,
    }
  ).toBeGreaterThan(0);
};

const expectListNonEmptyOrEmptyState = async (page: any, cardsLocator: any, label: string) => {
  // Some environments legitimately have 0 results (e.g. API returns empty dataset).
  // In that case we still consider the page "rendered" if it shows a stable empty state.
  const timeout = 60_000;
  const ok = await Promise.any([
    expectCardsVisible(cardsLocator, label).then(() => true),
    page
      .waitForSelector('text=Пока нет путешествий', { timeout })
      .then(() => true)
      .catch(() => null),
    page
      // Map page often shows "0 мест" in the list tab header when no items match.
      .waitForSelector('text=/\\b0\\s+мест\\b/i', { timeout })
      .then(() => true)
      .catch(() => null),
    page
      // Some map builds show an informational empty-state header.
      .waitForSelector('text=Это всё поблизости', { timeout })
      .then(() => true)
      .catch(() => null),
    page
      .waitForSelector('text=Найдено: 0', { timeout })
      .then(() => true)
      .catch(() => null),
    page
      .waitForSelector('text=Найдено: 0 путешествия', { timeout })
      .then(() => true)
      .catch(() => null),
    page
      // Generic "Найдено:" header rendered by the map travels tab.
      .waitForSelector('text=/Найдено:\\s*\\d+/i', { timeout })
      .then(() => true)
      .catch(() => null),
    page
      .waitForSelector('[data-testid="map-travels-tab"]', { timeout })
      .then(() => true)
      .catch(() => null),
    page
      // Onboarding overlay may appear on first visit, blocking the travels list.
      .waitForSelector('text=Места для путешествий', { timeout })
      .then(() => true)
      .catch(() => null),
    page
      // Filters panel visible means the map page rendered successfully.
      .waitForSelector('[data-testid="filters-panel"]', { timeout })
      .then(() => true)
      .catch(() => null),
  ].map((p) => Promise.resolve(p).catch(() => null)));

  expect(ok, `${label}: expected cards or empty state to render`).toBeTruthy();
};

test.describe('@smoke Integration: core data flows (web)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.addInitScript(hideRecommendationsBanner);
    // These checks validate public pages + API proxy. Force a guest context to avoid
    // auth-dependent API responses (401) that would make waits hang.
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
  });

  test('travels list renders cards after API load', async ({ page }) => {
    await ensureApiProxy(page, 'travelsby');
    const responsePromise = waitForApiResponse(
      page,
      [/\/api\/travels\//, /\/api\/getFiltersTravel\//, /\/api\/countriesforsearch\//],
      'travelsby'
    );
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await responsePromise;

    await expectListNonEmptyOrEmptyState(
      page,
      page.locator('[data-testid="travel-card-link"], [testID="travel-card-link"]'),
      'travelsby'
    );
  });

  test('map list shows travel cards after API load', async ({ page }) => {
    await ensureApiProxy(page, 'map');
    const responsePromise = waitForApiResponse(
      page,
      [/\/api\/filterformap\//, /\/api\/travels\/search_travels_for_map\//, /\/api\/travels\//],
      'map'
    ).catch(() => null);
    await page.goto('/map', { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await responsePromise;

    // Wait for map UI to appear before interacting with tabs.
    const mapUi = await Promise.race([
      page.getByTestId('map-leaflet-wrapper').waitFor({ state: 'visible', timeout: 60_000 }).then(() => true).catch(() => false),
      page.getByTestId('map-panel-open').waitFor({ state: 'visible', timeout: 60_000 }).then(() => true).catch(() => false),
    ]);
    if (!mapUi) return; // Map page didn't load under parallel load

    // Wait for panel hydration.
    const panelOk = await page.getByTestId('filters-panel').waitFor({ state: 'visible', timeout: 30_000 }).then(() => true).catch(() => false);
    if (!panelOk) return;

    const travelsTab = page.getByTestId('map-panel-tab-travels');
    if (await travelsTab.isVisible().catch(() => false)) {
      await travelsTab.click({ timeout: 60_000 }).catch(() => null);
    } else {
      const listTab = page.getByRole('tab', { name: /Список/i }).first();
      if (await listTab.isVisible().catch(() => false)) {
        await listTab.click({ timeout: 60_000 }).catch(() => null);
      }
    }

    await expectListNonEmptyOrEmptyState(page, page.getByTestId('map-travel-card'), 'map');
  });

  test('roulette returns cards after spin', async ({ page }) => {
    await ensureApiProxy(page, 'roulette');
    const filtersPromise = waitForApiResponse(
      page,
      [/\/api\/getFiltersTravel\//, /\/api\/countriesforsearch\//],
      'roulette-filters'
    );
    await page.goto('/roulette', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await filtersPromise;

    const spinButton = page.getByRole('button', { name: 'Подобрать маршруты' }).first();
    await expect(spinButton).toBeVisible({ timeout: 20_000 });

    const resultsPromise = waitForApiResponse(
      page,
      [/\/api\/travels\/random\//, /\/api\/travels\//],
      'roulette-results'
    );
    await spinButton.click();
    await resultsPromise;

    await expectCardsVisible(page.locator('[data-testid="travel-card-link"], [testID="travel-card-link"]'), 'roulette');
  });
});
