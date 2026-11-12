import { expect, test } from './fixtures';
import { preacceptCookies } from './helpers/navigation';
import { collectMetrics, injectPerfObservers } from './helpers/perfBudget';

const place = (
  id: string,
  title: string,
  category: string,
  lat: number,
  lng: number,
) => ({
  id,
  title,
  address: `${title}, тестовый адрес`,
  category: { id: Number(id), name: category },
  country: { code: 'BY', name: 'Беларусь' },
  lat,
  lng,
  travel: { url: `/travels/e2e-${id}` },
  image: null,
});

test.describe('Places cold catalog frame (#3387)', () => {
  test.use({ viewport: { width: 390, height: 844 }, storageState: { cookies: [], origins: [] } });

  test('@smoke preserves the initial grid until the catalog has a result', async ({ page }, testInfo) => {
    await injectPerfObservers(page);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.name));
    await page.addInitScript(() => {
      const state = { started: false, complete: false, frames: [] as Array<{ present: boolean; same: boolean; y: number; width: number; height: number }> };
      (window as any).__placesColdGrid = state;
      let firstGrid: Element | null = null;
      let previous = '';
      const sample = () => {
        if (state.complete) return;
        const grid = document.querySelector('[data-testid="places-cards-grid"]');
        // Replacement by real cards is legitimate; an empty frame before them is not.
        if (document.querySelector('[data-testid^="places-card-slot-"]')) { state.complete = true; return; }
        const rect = grid?.getBoundingClientRect();
        // Parsing can expose the grid element before its skeleton children.
        if (!state.started && grid?.querySelector('[data-testid="places-skeleton-card-0"]') && rect && rect.height > 844) {
          state.started = true;
          firstGrid = grid;
        }
        if (!state.started) return;
        const frame = { present: !!grid, same: grid === firstGrid, y: rect?.y ?? 0, width: rect?.width ?? 0, height: rect?.height ?? 0 };
        const key = JSON.stringify(frame);
        if (key !== previous) { state.frames.push(frame); previous = key; }
      };
      new MutationObserver(sample).observe(document, { childList: true, subtree: true });
      const tick = () => { sample(); if (!state.complete) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });

    let releaseScripts!: () => void;
    let releaseCatalog!: () => void;
    let requested!: () => void;
    const scriptsReady = new Promise<void>(resolve => { releaseScripts = resolve; });
    const catalogReady = new Promise<void>(resolve => { releaseCatalog = resolve; });
    const catalogRequested = new Promise<void>(resolve => { requested = resolve; });
    await page.route('**/_expo/static/js/**', async route => { await scriptsReady; await route.continue(); });
    await page.route('**/places/catalog/**', async route => {
      requested();
      await catalogReady;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        count: 2, results: [castle, museum], facets: { categories: [], countries: [] },
      }) });
    });
    try {
      // Freeze the actual exported frame before hydration, without a recent-input exclusion.
      await page.goto('/places', { waitUntil: 'commit' });
      await expect(page.getByTestId('places-skeleton-card-0')).toBeVisible();
      await page.waitForFunction(() => (window as any).__placesColdGrid?.started);
      await testInfo.attach('initial-frame', { body: await page.screenshot(), contentType: 'image/png' });
      releaseScripts();
      await catalogRequested;
      await page.waitForFunction(() => document.documentElement.classList.contains('app-hydrated'));
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      releaseCatalog();
      await expect(page.getByTestId('places-card-101')).toBeVisible();
      const state = await page.evaluate(() => (window as any).__placesColdGrid);
      const metrics = await collectMetrics(page);
      await testInfo.attach('cold-grid-ledger', { body: JSON.stringify({ state, metrics, errors }, null, 2), contentType: 'application/json' });
      await testInfo.attach('ready-frame', { body: await page.screenshot(), contentType: 'image/png' });
      expect(state.started && state.complete).toBe(true);
      expect(await page.evaluate(() => PerformanceObserver.supportedEntryTypes.includes('layout-shift'))).toBe(true);
      expect(state.frames.length).toBeGreaterThan(0);
      expect(state.frames.every((frame: { present: boolean; same: boolean; width: number; height: number }) =>
        frame.present && frame.same && frame.width > 0 && frame.height > 844,
      ), 'pending catalog must retain its grid identity and reserved geometry').toBe(true);
      expect(metrics.cls, JSON.stringify(metrics.clsSources)).toBeLessThanOrEqual(0.1);
      expect(errors).toEqual([]);
    } finally {
      releaseScripts();
      releaseCatalog();
    }
  });
});

const castle = place('101', 'Мирский замок', 'Замки', 53.451, 26.473);
const museum = place('102', 'Музей истории', 'Музеи', 53.9, 27.56);

test.describe('@smoke Places catalog', () => {
  test.beforeEach(async ({ page }) => {
    await preacceptCookies(page);
    await page.route('**/places/catalog/**', async (route) => {
      const url = new URL(route.request().url());
      const query = (url.searchParams.get('q') || '').toLowerCase();
      const results = query.includes('музей') ? [museum] : [castle, museum];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: results.length,
          results,
          facets: {
            categories: [
              { id: 101, name: 'Замки', count: 1 },
              { id: 102, name: 'Музеи', count: 1 },
            ],
            countries: [{ code: 'BY', name: 'Беларусь', count: results.length }],
          },
        }),
      });
    });
  });

  test('renders catalog results and applies server-side search', async ({ page }) => {
    await page.goto('/places', { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('places-card-101')).toBeVisible();
    await expect(page.getByTestId('places-card-102')).toBeVisible();

    await page.getByLabel('Найти место').fill('Музей');

    await expect(page.getByTestId('places-card-102')).toBeVisible();
    await expect(page.getByTestId('places-card-101')).toHaveCount(0);
  });

  test('opens a catalog place on the map with focus parameters', async ({ page }) => {
    await page.goto('/places', { waitUntil: 'domcontentloaded' });
    const card = page.getByTestId('places-card-101');
    await expect(card).toBeVisible();

    await card.getByRole('button', { name: 'Навигация и действия', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Открыть место на карте', exact: true }).click();

    await expect(page).toHaveURL(/\/map\?.*placeId=101/);
  });
});
