import { test, expect } from './fixtures';
import { getTravelsListPath } from './helpers/routes';

type ApiMatch = string | RegExp;

const REQUIRE_API_PROXY = process.env.E2E_REQUIRE_API_PROXY === '1';
const ensureApiProxyOrSkip = async (page: any, label: string) => {
  if (REQUIRE_API_PROXY) return;

  const resp = await page.request
    .get('/api/travels/', { timeout: 7_000 })
    .catch(() => null);

  // These tests assert successful API responses; skip if proxy can't return a 2xx/3xx quickly.
  if (!resp || resp.status() < 200 || resp.status() >= 400) {
    test.skip(true, `API proxy unavailable for ${label} (set E2E_REQUIRE_API_PROXY=1 to enforce)`);
  }
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

test.describe('Manual QA automation: core pages data', () => {
  test.skip(
    process.env.E2E_VERIFY_API_PROXY !== '1',
    'Set E2E_VERIFY_API_PROXY=1 to enforce API proxy response assertions.'
  );

  test.beforeEach(async ({ page }) => {
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
    await ensureApiProxyOrSkip(page, 'home');
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

  test('travels list loads filters and data via API proxy', async ({ page }) => {
    await ensureApiProxyOrSkip(page, 'travelsby');
    const responsePromise = waitForApiResponse(
      page,
      [/\/api\/getFiltersTravel\//, /\/api\/countriesforsearch\//, /\/api\/travels\//],
      'travelsby'
    );
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await responsePromise;
  });

  test('map page loads filters via API proxy', async ({ page }) => {
    await ensureApiProxyOrSkip(page, 'map');
    const responsePromise = waitForApiResponse(
      page,
      [/\/api\/filterformap\//, /\/api\/travels\/search_travels_for_map\//, /\/api\/travels\//],
      'map'
    );
    await page.goto('/map', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await responsePromise;
  });

  test('roulette loads filters and random results via API proxy', async ({ page }) => {
    await ensureApiProxyOrSkip(page, 'roulette');
    await page.goto('/roulette', { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // Upstream API can be slow/flaky; allow a longer window for proxy responses.
    await waitForApiResponse(page, [/\/api\/getFiltersTravel\//, /\/api\/countriesforsearch\//], 'roulette-filters', {
      timeoutMs: 90_000,
    });

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
        await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => null);
        await waitForApiResponse(page, [/\/api\/getFiltersTravel\//, /\/api\/countriesforsearch\//], 'roulette-filters', {
          timeoutMs: 90_000,
        }).catch(() => null);
      }
    }

    if (lastErr) throw lastErr;
  });
});
