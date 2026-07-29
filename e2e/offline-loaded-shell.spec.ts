import { expect, test, type Page } from '@playwright/test';
import { preacceptCookies } from './helpers/navigation';

const POINTS = [
  {
    id: 91001,
    title: 'Offline point one',
    lat: 53.9,
    lng: 27.56,
    address: 'Saved address one',
    categoryName: 'Museum',
    thumb: null,
    urlTravel: null,
    slug: null,
  },
  {
    id: 91002,
    title: 'Offline point two',
    lat: 53.91,
    lng: 27.57,
    address: 'Saved address two',
    categoryName: 'Park',
    thumb: null,
    urlTravel: null,
    slug: null,
  },
];

async function installMapMocks(page: Page) {
  await page.route('**/api/map/points_bulk/**', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { etag: '"offline-e2e-v1"' },
      contentType: 'application/json',
      body: JSON.stringify(POINTS),
    });
  });
  await page.route('**/api/filterformap/**', async (route) => {
    await route.fulfill({
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
    });
  });
  await page.route('**/api/travels/search_travels_for_map/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [], total: 0 }),
    });
  });
  await page.route('**/proxy/tiles/osm/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8m2p8AAAAASUVORK5CYII=',
        'base64',
      ),
    });
  });
}

async function verifyLoadedShellOfflineFlow(page: Page, locale: 'ru' | 'en' = 'ru') {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(String(error.message || error)));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });

  await preacceptCookies(page);
  if (locale === 'en') {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        '@metravel/locale-preference:v1',
        JSON.stringify({ version: 1, mode: 'explicit', locale: 'en' }),
      );
    });
  }
  await installMapMocks(page);
  await page.goto('/map', { waitUntil: 'domcontentloaded' });

  const saveFab = page.getByTestId('map-offline-download-fab');
  await expect(saveFab).toBeVisible({ timeout: 60_000 });
  const onboardingBackdrop = page.getByTestId('onboarding-backdrop');
  if (await onboardingBackdrop.isVisible().catch(() => false)) {
    await onboardingBackdrop.click();
    await expect(onboardingBackdrop).toBeHidden();
  }
  await saveFab.click();
  const submit = page.getByTestId('map-offline-download-submit');
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByText(locale === 'en' ? 'Points saved: 2' : 'Сохранено точек: 2')).toBeVisible();
  await page.getByTestId('map-offline-close').click();
  // The first local Metro compile can finish the router.prefetch after the map
  // itself is already interactive. Give that one-time preload a bounded window;
  // production static assets are compiled ahead of time.
  await page.waitForTimeout(5_000);

  await page.context().setOffline(true);
  const offlineBanner = page.getByTestId('network-status-banner');
  await expect(offlineBanner).toBeVisible();
  await expect(offlineBanner).toContainText(locale === 'en' ? 'No internet connection' : 'Нет подключения к интернету');
  const openSaved = page.getByRole('button', {
    name: locale === 'en' ? 'Open saved content' : 'Открыть сохранённое',
  });
  await expect(openSaved).toBeEnabled();
  await openSaved.click();

  await expect(page).toHaveURL(/\/offline(?:\?|$)/);
  await expect(page.getByText(locale === 'en' ? 'Offline map' : 'Офлайн-карта', { exact: true })).toBeVisible();
  await expect(page.getByText(locale === 'en' ? /Available offline/ : /Доступно офлайн/).first()).toBeVisible();

  await page.evaluate(() => window.history.back());
  await expect(page).toHaveURL(/\/map(?:\?|$)/);
  await expect(saveFab).toBeVisible();

  await page.context().setOffline(false);
  await expect
    .poll(() => runtimeErrors.filter((message) => (
      /TypeError|ReferenceError|Minified React error|is not a function/i.test(message)
    )))
    .toEqual([]);
}

test.describe('offline loaded-shell parity', () => {
  test.describe('mobile web', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    test('saves a point index and opens the library after the network drops', async ({ page }) => {
      await verifyLoadedShellOfflineFlow(page);
    });

    test('keeps the loaded shell localized in English', async ({ page }) => {
      await verifyLoadedShellOfflineFlow(page, 'en');
    });
  });

  test.describe('desktop web', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('keeps the same save and loaded-shell offline flow', async ({ page }) => {
      await verifyLoadedShellOfflineFlow(page);
    });
  });
});
