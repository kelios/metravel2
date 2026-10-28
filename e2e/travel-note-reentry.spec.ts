import { test, expect } from './fixtures';
import { ensureAuthedStorageFallback, mockFakeAuthApis } from './helpers/auth';
import { dismissConsentBanner } from './helpers/consentBanner';
import { mockTravelWizardUpsert } from './helpers/travelWizardFixture';

const tinyPngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=',
  'base64',
);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith('metravel_travel_draft_'))
      .forEach((key) => window.localStorage.removeItem(key));
  });
  await ensureAuthedStorageFallback(page, { userId: '1', userName: 'E2E User' });
  await mockFakeAuthApis(page);
  await mockTravelWizardUpsert(page);
  await page.route('**/api/upload**', async (route) => {
    if (route.request().method().toUpperCase() !== 'POST') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ url: 'https://example.com/travel-address/e2e-note.webp' }),
    });
  });
  await page.route('**/api/getFiltersTravel/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        categories: [],
        transports: [],
        companions: [],
        complexity: [],
        month: [],
        over_nights_stay: [],
        categoryTravelAddress: [],
        sortings: [],
      }),
    });
  });
});

test('повторная короткая заметка после сохранения открывает пустую форму', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/travel/new?mode=note', { waitUntil: 'domcontentloaded' });
  await dismissConsentBanner(page);
  await expect(page.getByTestId('travel-note.root')).toBeVisible({ timeout: 30_000 });
  const documentStart = await page.evaluate(() => performance.timeOrigin);

  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'note-photo.png',
    mimeType: 'image/png',
    buffer: tinyPngBuffer,
  });
  await expect.poll(() => page.url(), { timeout: 15_000 }).toMatch(/[?&]id=\d+/);
  await expect(page.getByTestId('gallery-image').first()).toBeVisible();

  await page.locator('[data-testid="account-menu-anchor"]:visible').first().click();
  const menu = page.getByTestId('web-menu-panel');
  await expect(menu).toBeVisible();
  await menu.getByRole('button', { name: 'Путешествия', exact: true }).click();
  await menu.getByRole('link', { name: 'Короткая заметка', exact: true }).click();

  await expect(page).toHaveURL(/\/travel\/new\?mode=note(?:&|$)/);
  await expect(page).not.toHaveURL(/[?&]id=/);
  await expect(page.getByTestId('travel-note.root')).toBeVisible();
  await expect(page.getByTestId('gallery-image')).toHaveCount(0);
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentStart);
});
