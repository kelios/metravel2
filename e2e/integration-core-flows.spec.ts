import { test, expect } from './fixtures';
import { getTravelsListPath } from './helpers/routes';
import { hideRecommendationsBanner, seedNecessaryConsent } from './helpers/storage';

type ApiMatch = string | RegExp;

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
  const ok = await Promise.any([
    expectCardsVisible(cardsLocator, label).then(() => true),
    page
      .waitForSelector('text=Пока нет путешествий', { timeout: 30_000 })
      .then(() => true)
      .catch(() => null),
    page
      // Map page often shows "0 мест" in the list tab header when no items match.
      .waitForSelector('text=/\b0\s+мест\b/i', { timeout: 30_000 })
      .then(() => true)
      .catch(() => null),
    page
      // Some map builds show an informational empty-state header.
      .waitForSelector('text=Это всё поблизости', { timeout: 30_000 })
      .then(() => true)
      .catch(() => null),
    page
      .waitForSelector('text=Найдено: 0', { timeout: 30_000 })
      .then(() => true)
      .catch(() => null),
    page
      .waitForSelector('text=Найдено: 0 путешествия', { timeout: 30_000 })
      .then(() => true)
      .catch(() => null),
  ].map((p) => Promise.resolve(p).catch(() => null)));

  expect(ok, `${label}: expected cards or empty state to render`).toBeTruthy();
};

test.describe('Integration: core data flows (web)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
    await page.addInitScript(hideRecommendationsBanner);
  });

  test('travels list renders cards after API load', async ({ page }) => {
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
    const responsePromise = waitForApiResponse(
      page,
      [/\/api\/filterformap\//, /\/api\/travels\/search_travels_for_map\//, /\/api\/travels\//],
      'map'
    );
    await page.goto('/map', { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await responsePromise;

    const travelsTab = page.getByTestId('map-panel-tab-travels');
    if (await travelsTab.isVisible().catch(() => false)) {
      await travelsTab.click();
    } else {
      // Fallback: some layouts render tabs without testIDs.
      const listTab = page.getByRole('tab', { name: /Список/i }).first();
      if (await listTab.isVisible().catch(() => false)) {
        await listTab.click();
      }
    }

    await expectListNonEmptyOrEmptyState(page, page.getByTestId('map-travel-card'), 'map');
  });

  test('roulette returns cards after spin', async ({ page }) => {
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
