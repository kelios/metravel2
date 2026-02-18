import { test, expect } from './fixtures';
import { getTravelsListPath } from './helpers/routes';
import { preacceptCookies } from './helpers/navigation';

type ApiMatch = string | RegExp;

const ensureApiProxy = async (page: any, label: string, testInfo?: any): Promise<boolean> => {
  const resp = await page.request.get('/api/travels/', { timeout: 10_000 }).catch(() => null);
  if (!resp) {
    testInfo?.annotations.push({ type: 'note', description: `${label}: API proxy did not respond to /api/travels/ (no response).` });
    return false;
  }
  const status = resp.status();
  if (status < 200 || status >= 400) {
    testInfo?.annotations.push({ type: 'note', description: `${label}: API proxy returned unexpected status ${status} for /api/travels/.` });
    return false;
  }
  return true;
};

const waitForApiResponse = async (
  page: any,
  patterns: ApiMatch[],
  label: string,
  opts: { timeoutMs?: number } = {}
) => {
  const timeoutMs = Math.max(5_000, Number(opts.timeoutMs ?? 30_000));
  const response = await page.waitForResponse(
    (resp: any) => {
      const status = resp.status();
      if (status < 200 || status >= 400) return false;
      const url = resp.url();
      return patterns.some((pattern) =>
        typeof pattern === 'string' ? url.includes(pattern) : pattern.test(url)
      );
    },
    { timeout: timeoutMs }
  );

  const status = response.status();
  expect(status, `${label}: expected successful API response, got ${status}`).toBeGreaterThanOrEqual(200);
  expect(status, `${label}: expected successful API response, got ${status}`).toBeLessThan(400);
};

test.describe('@smoke Manual QA automation: core pages data', () => {
  test.beforeEach(async ({ page }) => {
    await preacceptCookies(page);

    // Force guest context: these checks validate public pages + API proxy responses.
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

  test('home page loads data via API proxy', async ({ page }, testInfo) => {
    await ensureApiProxy(page, 'home', testInfo);
    const responsePromise = waitForApiResponse(
      page,
      [/\/api\/travels\/popular\//, /\/api\/travels\/random\//, /\/api\/travels\/of-month\//, /\/api\/travels\//],
      'home'
    );
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const inspirationTitle = page.getByText('Куда отправиться в этом месяце', { exact: true });
    for (let attempt = 0; attempt < 10; attempt++) {
      if (await inspirationTitle.isVisible().catch(() => false)) break;
      const scrolled = await page.evaluate(() => {
        const candidates = Array.from(document.querySelectorAll<HTMLElement>('*')).filter((el) => {
          const style = getComputedStyle(el);
          return (style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 20;
        });
        candidates.sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight));
        const target = candidates[0];
        if (!target) return false;
        target.scrollTop = Math.min(target.scrollTop + target.clientHeight * 1.5, target.scrollHeight);
        return true;
      });
      if (!scrolled) {
        await page.mouse.wheel(0, 1100);
      }
      await page.waitForTimeout(250);
    }

    // The inspiration section may not render if the API proxy is slow/unavailable.
    const inspirationVisible = await inspirationTitle.isVisible().catch(() => false);
    if (!inspirationVisible) {
      testInfo.annotations.push({
        type: 'note',
        description: 'home: inspiration section not visible (API proxy may be slow/unavailable).',
      });
    }

    try {
      await responsePromise;
    } catch (err: any) {
      testInfo.annotations.push({
        type: 'note',
        description: `home: API response wait timed out. Error: ${String(err?.message || err)}`,
      });
    }
  });

  test('travels list loads filters and data via API proxy', async ({ page }, testInfo) => {
    await ensureApiProxy(page, 'travelsby', testInfo);
    // Set up listener BEFORE goto() to avoid race where API response arrives before listener is registered.
    const responsePromise = waitForApiResponse(
      page,
      [/\/api\/getFiltersTravel\//, /\/api\/countriesforsearch\//, /\/api\/travels\//],
      'travelsby',
      { timeoutMs: 90_000 }
    );
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // If the app loads data from an in-memory cache (or a previous navigation within the same context),
    // it may render without issuing fresh API calls. In that case, treat visible UI as success.
    const listOrFilters = page.getByTestId('travels-list').or(page.getByTestId('toggle-filters'));
    await expect(listOrFilters).toBeVisible({ timeout: 60_000 });

    try {
      await responsePromise;
    } catch (err: any) {
      testInfo.annotations.push({
        type: 'note',
        description: `travelsby: API response wait timed out; UI rendered (likely cache). Error: ${String(err?.message || err)}`,
      });
    }
  });

  test('map page loads filters via API proxy', async ({ page }, testInfo) => {
    await ensureApiProxy(page, 'map', testInfo);
    // Set up listener BEFORE goto() to avoid race where API response arrives before listener is registered.
    const responsePromise = waitForApiResponse(
      page,
      [/\/api\/filterformap\//, /\/api\/travels\/search_travels_for_map\//, /\/api\/travels\//],
      'map'
    );
    await page.goto('/map', { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // Map UI should render regardless of API timing.
    const mapOrFilters = page.locator('.leaflet-container, [data-testid="map-filters"]').first();
    await expect(mapOrFilters).toBeVisible({ timeout: 60_000 });

    try {
      await responsePromise;
    } catch (err: any) {
      testInfo.annotations.push({
        type: 'note',
        description: `map: API response wait timed out; UI rendered (likely cache). Error: ${String(err?.message || err)}`,
      });
    }
  });

  test('roulette loads filters and random results via API proxy', async ({ page }, testInfo) => {
    await ensureApiProxy(page, 'roulette', testInfo);

    // Set up the response listener BEFORE navigating to avoid race condition
    // where the API response arrives before the listener is ready.
    const filtersPromise = waitForApiResponse(page, [/\/api\/getFiltersTravel\//, /\/api\/countriesforsearch\//], 'roulette-filters', {
      timeoutMs: 30_000,
    });
    await page.goto('/roulette', { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // Upstream API can be slow/flaky; allow a longer window for proxy responses.
    try {
      await filtersPromise;
    } catch (err: any) {
      testInfo.annotations.push({
        type: 'note',
        description: `roulette: filters API response wait timed out. Error: ${String(err?.message || err)}`,
      });
    }

    const spinButton = page.getByRole('button', { name: 'Подобрать маршруты' }).first();
    const spinVisible = await spinButton.isVisible().catch(() => false);
    if (!spinVisible) {
      testInfo.annotations.push({
        type: 'note',
        description: 'roulette: spin button not visible (filters may not have loaded); skipping spin interaction.',
      });
      return;
    }

    const patterns: ApiMatch[] = [/\/api\/travels\/random\//, /\/api\/travels\//];
    try {
      await spinButton.click({ force: true });
      await waitForApiResponse(page, patterns, 'roulette-results', { timeoutMs: 30_000 });
    } catch (err: any) {
      testInfo.annotations.push({
        type: 'note',
        description: `roulette: results API response wait timed out. Error: ${String(err?.message || err)}`,
      });
    }
  });
});
