import { test, expect } from './fixtures';
import {
  FALLBACK_TRAVEL_SLUG,
  gotoWithRetry,
  mockFallbackTravelDetails,
  openFallbackTravelDetails,
  preacceptCookies,
} from './helpers/navigation';

const FALLBACK_TRAVEL_NAME = 'E2E stable travel details';

async function openStableTravel(page: import('@playwright/test').Page) {
  await preacceptCookies(page);
  expect(await openFallbackTravelDetails(page), 'stable travel fixture must load').toBe(true);

  const root = page.getByTestId('travel-details-page');
  await expect(root).toBeVisible({ timeout: 30_000 });
  return root;
}

async function mockTravelError(
  page: import('@playwright/test').Page,
  slug: string,
  status: number,
  detail: string,
) {
  const handler = (route: import('@playwright/test').Route) => route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ detail }),
  });
  await page.route(`**/api/travels/by-slug/${slug}/**`, handler);
  await page.route(`**/travels/by-slug/${slug}/**`, handler);
}

test.describe('Travel details — deterministic product contracts', () => {
  test('renders the core route content and semantic main region', async ({ page }) => {
    const root = await openStableTravel(page);

    await expect(root).toHaveAttribute('role', 'main');
    await expect(page.getByRole('heading', { level: 1, name: FALLBACK_TRAVEL_NAME })).toBeVisible();

    const description = page.getByTestId('travel-details-description');
    await expect(description).toBeVisible({ timeout: 20_000 });
    await expect(description).toContainText('Тестовое описание стабильного маршрута');
  });

  test('keeps the mobile layout within the viewport and renders one author section', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await openStableTravel(page);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByTestId('travel-details-author-mobile')).toHaveCount(1);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'travel details must not create horizontal mobile overflow').toBeLessThanOrEqual(1);
  });

  test('publishes canonical metadata and valid Schema.org JSON-LD', async ({ page }) => {
    await openStableTravel(page);

    await expect(page).toHaveTitle(new RegExp(FALLBACK_TRAVEL_NAME, 'i'));
    const canonical = page.locator('link[rel="canonical"]').first();
    await expect
      .poll(() => canonical.getAttribute('href'), { timeout: 10_000 })
      .toContain(`/travels/${FALLBACK_TRAVEL_SLUG}`);

    const jsonLdScripts = page.locator('script[type="application/ld+json"]');
    await expect.poll(() => jsonLdScripts.count(), { timeout: 10_000 }).toBeGreaterThan(0);
    const documents = await jsonLdScripts.allTextContents();
    const parsed = documents.map((document) => JSON.parse(document));
    expect(parsed.some((document) => document?.['@context'] === 'https://schema.org')).toBe(true);
  });

  test('renders an explicit not-found state for a 404 response', async ({ page }) => {
    const slug = 'e2e-missing-travel';
    await preacceptCookies(page);
    await mockTravelError(page, slug, 404, 'Not found.');

    await gotoWithRetry(page, `/travels/${slug}`);

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible({ timeout: 30_000 });
    await expect(alert).toContainText('Путешествие не найдено');
    await expect(alert.getByRole('button', { name: 'Повторить' })).toHaveCount(0);
    await expect(alert.getByRole('button', { name: 'На главную' })).toBeVisible();
  });

  test('recovers after a transient 503 when the user retries', async ({ page }) => {
    await preacceptCookies(page);
    await mockFallbackTravelDetails(page);

    let shouldFail = true;
    await page.route('**/api/travels/**', async (route) => {
      if (!shouldFail) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Service unavailable' }),
      });
    });

    await gotoWithRetry(page, `/travels/${FALLBACK_TRAVEL_SLUG}`);

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Не удалось загрузить путешествие', { timeout: 30_000 });
    shouldFail = false;
    await alert.getByRole('button', { name: 'Повторить' }).click();

    await expect(page.getByTestId('travel-details-page')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1, name: FALLBACK_TRAVEL_NAME })).toBeVisible();
  });
});
