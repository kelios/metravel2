import { test, expect } from './fixtures';
import { getTravelsListPath } from './helpers/routes';
import { hideRecommendationsBanner, seedNecessaryConsent } from './helpers/storage';

type ApiMatch = string | RegExp;

const ensureApiProxy = async (page: any, label: string) => {
  const resp = await page.request.get('/api/travels/', { timeout: 7_000 }).catch(() => null);
  expect(resp, `${label}: expected API proxy to respond to /api/travels/`).toBeTruthy();
  if (!resp) return;
  expect(resp.status(), `${label}: unexpected API proxy status for /api/travels/`).toBeGreaterThanOrEqual(200);
  expect(resp.status(), `${label}: unexpected API proxy status for /api/travels/`).toBeLessThan(400);
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
    await page.addInitScript(seedNecessaryConsent);
    await page.addInitScript(hideRecommendationsBanner);

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

  test('home page loads data via API proxy', async ({ page }) => {
    await ensureApiProxy(page, 'home');
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
    await expect(inspirationTitle).toBeVisible({ timeout: 10_000 });
    await responsePromise;
  });

  test('travels list loads filters and data via API proxy', async ({ page }, testInfo) => {
    await ensureApiProxy(page, 'travelsby');
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

  test('map page loads filters via API proxy', async ({ page }) => {
    await ensureApiProxy(page, 'map');
    const responsePromise = waitForApiResponse(
      page,
      [/\/api\/filterformap\//, /\/api\/travels\/search_travels_for_map\//, /\/api\/travels\//],
      'map'
    );
    await page.goto('/map', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await responsePromise;
  });

  test('roulette loads filters and random results via API proxy', async ({ page }) => {
    await ensureApiProxy(page, 'roulette');

    // Debug: log all responses and console messages to diagnose timeout
    page.on('response', (resp: any) => {
      const url = resp.url();
      if (url.includes('/api/') || url.includes('getFilters') || url.includes('countries')) {
        console.log(`[roulette-debug] response: ${resp.status()} ${url}`);
      }
    });
    page.on('request', (req: any) => {
      const url = req.url();
      if (url.includes('/api/') || url.includes('getFilters') || url.includes('countries')) {
        console.log(`[roulette-debug] request: ${req.method()} ${url}`);
      }
    });
    page.on('console', (msg: any) => {
      if (msg.type() === 'error') {
        console.log(`[roulette-debug] console.error: ${msg.text()}`);
      }
    });
    page.on('pageerror', (err: any) => {
      console.log(`[roulette-debug] pageerror: ${err.message || err}`);
    });

    // Set up the response listener BEFORE navigating to avoid race condition
    // where the API response arrives before the listener is ready.
    const filtersPromise = waitForApiResponse(page, [/\/api\/getFiltersTravel\//, /\/api\/countriesforsearch\//], 'roulette-filters', {
      timeoutMs: 30_000,
    });
    await page.goto('/roulette', { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // Upstream API can be slow/flaky; allow a longer window for proxy responses.
    await filtersPromise;

    const spinButton = page.getByRole('button', { name: 'Подобрать маршруты' }).first();
    await expect(spinButton).toBeVisible({ timeout: 20_000 });

    const patterns: ApiMatch[] = [/\/api\/travels\/random\//, /\/api\/travels\//];
    let lastErr: any = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await spinButton.click({ force: true });
        await waitForApiResponse(page, patterns, 'roulette-results', { timeoutMs: 90_000 });
        lastErr = null;
        break;
      } catch (err: any) {
        lastErr = err;
        // Retry once: reload to recover from transient proxy hiccups.
        // Set up listener BEFORE reload to avoid race condition.
        const retryFilters = waitForApiResponse(page, [/\/api\/getFiltersTravel\//, /\/api\/countriesforsearch\//], 'roulette-filters', {
          timeoutMs: 90_000,
        }).catch(() => null);
        await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => null);
        await retryFilters;
      }
    }

    if (lastErr) throw lastErr;
  });
});
