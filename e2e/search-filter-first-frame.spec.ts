import type { Page, Route } from '@playwright/test';
import { test, expect } from './fixtures';
import { preacceptCookies } from './helpers/navigation';

type FirstFilterFrame = { expanded: boolean; loading: boolean; options: number };
declare global {
  interface Window {
    __searchFilterProbe: {
      cls: number;
      sidebarShifts: number[];
      lastShift: number;
      firstFrame: FirstFilterFrame | null;
    };
  }
}

const IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8ZKfkAAAAASUVORK5CYII=';
const dictionaries = {
  categories: [{ id: 1, name: 'Горы' }],
  categoryTravelAddress: [{ id: 10, name: 'Музей' }],
  companions: [{ id: 20, name: 'С друзьями' }],
  complexity: [{ id: 30, name: 'Легко' }],
  month: [{ id: 7, name: 'Июль' }],
  over_nights_stay: [{ id: 40, name: 'Отель' }],
  sortings: [{ id: 'newest', name: 'Сначала новые', sortBy: 'created_at', sortOrder: 'desc' }],
  transports: [{ id: 50, name: 'Поезд' }],
};

async function fulfillJson(route: Route, body: unknown) {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
}

async function installCatalog(page: Page, countryCount: number, delayed: boolean) {
  const countries = Array.from({ length: countryCount }, (_, index) => ({
    country_id: index + 1, title_ru: `Страна ${String(index + 1).padStart(2, '0')}`,
  }));
  let release = () => {};
  const optionsReady = new Promise<void>(resolve => { release = resolve; });
  if (!delayed) release();
  await page.route('**/getFiltersTravel/**', async route => {
    await optionsReady;
    await fulfillJson(route, dictionaries);
  });
  await page.route('**/countriesforsearch/**', async route => {
    await optionsReady;
    await fulfillJson(route, countries);
  });
  await page.route('**/api/travels/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/travels/facets/')) {
      await fulfillJson(route, { total: 100, facets: {} });
    } else if (url.pathname.endsWith('/travels/')) {
      await fulfillJson(route, {
        data: Array.from({ length: 12 }, (_, index) => ({
          id: 990_765 + index, slug: `filter-frame-${index}`, name: `Маршрут ${index + 1}`,
          url: `/travels/filter-frame-${index}`, publish: true, moderation: true,
          countryName: 'Беларусь', cityName: 'Минск', year: '2026',
          travel_image_thumb_url: IMAGE, travel_image_thumb_small_url: IMAGE,
        })),
        total: 100,
      });
    } else {
      await route.fallback();
    }
  });
  return release;
}

async function observeFirstFrame(page: Page) {
  await page.addInitScript(() => {
    const probe = window.__searchFilterProbe = {
      cls: 0, sidebarShifts: [] as number[], lastShift: 0, firstFrame: null as FirstFilterFrame | null,
    };
    new PerformanceObserver(list => {
      for (const rawEntry of list.getEntries()) {
        const entry = rawEntry as PerformanceEntry & {
          value: number; hadRecentInput: boolean; sources: { node?: Element }[];
        };
        if (entry.hadRecentInput) continue;
        probe.cls += entry.value;
        probe.lastShift = performance.now();
        if (entry.sources.some(source => source.node?.closest?.('[data-testid="filter-scrollview"]'))) {
          probe.sidebarShifts.push(entry.value);
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });
    const sample = () => {
      const panel = document.querySelector<HTMLElement>('[data-testid="filter-scrollview"]');
      if (panel && panel.getBoundingClientRect().height > 0 && document.documentElement.classList.contains('rnw-styles-ready')) {
        probe.firstFrame = {
          expanded: panel.querySelector('[role="button"]')?.getAttribute('aria-label')?.startsWith('Свернуть') === true,
          loading: Boolean(panel.querySelector('[data-testid="filter-options-loading-countries"]')),
          options: panel.querySelectorAll('[role="checkbox"]').length,
        };
      } else {
        requestAnimationFrame(sample);
      }
    };
    requestAnimationFrame(sample);
  });
}

test.describe('@smoke /search 1440 — первый кадр фильтров (#2765)', () => {
  test.use({ viewport: { width: 1440, height: 900 }, storageState: { cookies: [], origins: [] } });

  for (const scenario of [
    { name: 'готовые опции', delayed: false, countryCount: 30 },
    { name: 'медленный полный список', delayed: true, countryCount: 30 },
    { name: 'медленный короткий список', delayed: true, countryCount: 1 },
    { name: 'медленный пустой список стран', delayed: true, countryCount: 0 },
  ]) {
    test(`${scenario.name}: группы раскрыты с первого кадра, CLS ≤ 0,01`, async ({ page }, testInfo) => {
      await preacceptCookies(page);
      const releaseOptions = await installCatalog(page, scenario.countryCount, scenario.delayed);
      await observeFirstFrame(page);
      try {
        await page.goto('/search', { waitUntil: 'domcontentloaded' });
        const sidebar = page.getByTestId('filter-scrollview');
        await expect(sidebar).toBeVisible({ timeout: 30_000 });
        if (scenario.delayed) {
          await expect(page.getByTestId('filter-options-loading-countries')).toBeVisible();
          await page.screenshot({ path: testInfo.outputPath('filters-loading.png') });
        }
        releaseOptions();
        await expect(sidebar.getByRole('checkbox', { name: 'Горы', exact: true })).toHaveCount(1, { timeout: 30_000 });
        await expect(page.getByTestId('filter-options-loading-countries')).toHaveCount(0);
        await expect(sidebar.getByRole('checkbox', { name: /^Страна / })).toHaveCount(scenario.countryCount);
        await page.evaluate(() => document.fonts.ready);
        // DOM assertions can pass before the response has painted. Start the quiet
        // window after that paint so lastShift=0 cannot finish the probe early.
        const readyAt = await page.evaluate(async () => {
          await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
          return performance.now();
        });
        await page.waitForFunction(
          readyAt => window.__searchFilterProbe.firstFrame !== null && performance.now() - Math.max(window.__searchFilterProbe.lastShift, readyAt) >= 1_000,
          readyAt,
        );
        const probe = await page.evaluate(() => window.__searchFilterProbe);
        await testInfo.attach('first-frame-cls', { body: JSON.stringify(probe, null, 2), contentType: 'application/json' });
        await page.screenshot({ path: testInfo.outputPath('filters-ready.png') });
        expect(probe.firstFrame?.expanded, 'нет промежуточного свёрнутого кадра').toBe(true);
        if (scenario.delayed) expect(probe.firstFrame?.loading).toBe(true);
        expect(probe.sidebarShifts, 'раскрытие или ответ API не сдвигают колонку фильтров').toEqual([]);
        expect(probe.cls).toBeLessThanOrEqual(0.01);
      } finally {
        releaseOptions();
      }
    });
  }
});
