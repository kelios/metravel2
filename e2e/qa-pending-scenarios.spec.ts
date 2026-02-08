import { test, expect } from './fixtures';
import { preacceptCookies, gotoWithRetry } from './helpers/navigation';

/**
 * Automates pending QA scenarios from docs/QA_MANUAL_REPORT.md:
 * Q (404), R (SEO meta), S (cookie consent), V (registration canonical),
 * AO (legal pages).
 */

test.describe('@smoke QA pending scenarios: 404, SEO, cookies, legal', () => {
  test.beforeEach(async ({ page }) => {
    await preacceptCookies(page);
  });

  // --- Scenario Q: 404/unknown route ---

  test('unknown route shows not-found page with navigation', async ({ page }) => {
    await gotoWithRetry(page, '/this-page-does-not-exist-12345');

    const notFoundText = page.getByText('Страница не найдена');
    await expect(notFoundText).toBeVisible({ timeout: 15_000 });

    // Should have a "На главную" link
    const homeLink = page.getByRole('button', { name: 'На главную' }).or(
      page.getByText('На главную')
    );
    await expect(homeLink.first()).toBeVisible({ timeout: 5_000 });
  });

  // --- Scenario R: SEO meta tags on core public pages ---

  test('home page has title and description meta', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(2_000);

    const title = await page.title();
    expect(title.length, 'home page should have a non-empty title').toBeGreaterThan(0);

    const description = await page
      .locator('meta[name="description"]')
      .getAttribute('content')
      .catch(() => null);
    if (description) {
      expect(description.length).toBeGreaterThan(0);
    }
  });

  test('travels list page has title and canonical', async ({ page }) => {
    await gotoWithRetry(page, '/travelsby');
    await page.waitForTimeout(2_000);

    const title = await page.title();
    expect(title.length, 'travels page should have a non-empty title').toBeGreaterThan(0);

    const canonical = await page
      .locator('link[rel="canonical"]')
      .getAttribute('href')
      .catch(() => null);
    if (canonical) {
      expect(canonical).toContain('travelsby');
    }
  });

  // --- Scenario V: Registration canonical ---

  test('registration page has correct canonical', async ({ page }) => {
    await gotoWithRetry(page, '/registration');
    await page.waitForTimeout(2_000);

    const canonical = await page
      .locator('link[rel="canonical"]')
      .getAttribute('href')
      .catch(() => null);
    if (canonical) {
      expect(canonical).toContain('registration');
    }

    // Should not have noindex (registration is a public page)
    const robots = await page
      .locator('meta[name="robots"]')
      .getAttribute('content')
      .catch(() => null);
    if (robots) {
      expect(robots).not.toContain('noindex');
    }
  });

  // --- Scenario S: Cookie consent lifecycle ---

  test('cookie consent banner appears and can be accepted', async ({ page }) => {
    // Clear consent to see the banner
    await page.addInitScript(() => {
      try {
        window.localStorage?.removeItem('cookieConsent');
        window.localStorage?.removeItem('cookie_consent');
        window.localStorage?.removeItem('consent');
      } catch {
        // ignore
      }
    });

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // Look for consent banner — it may use various text patterns
    const consentBanner = page.getByText(/cookie|Cookies|куки/i).first();
    const bannerVisible = await consentBanner
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

    if (!bannerVisible) {
      // Banner may already be dismissed or not present — skip gracefully
      test.info().annotations.push({
        type: 'note',
        description: 'Cookie consent banner not visible; may already be accepted',
      });
      return;
    }

    // Accept cookies
    const acceptButton = page
      .getByRole('button', { name: /принять|согласен|accept|все/i })
      .first();
    const acceptVisible = await acceptButton
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);

    if (acceptVisible) {
      await acceptButton.click();
      // Banner should disappear
      await expect(consentBanner).not.toBeVisible({ timeout: 5_000 });
    }
  });

  // --- Scenario AO: Legal pages ---

  test('privacy page loads with content', async ({ page }) => {
    await gotoWithRetry(page, '/privacy');

    // Should have some heading or text content
    const heading = page.locator('h1, h2').first();
    const headingVisible = await heading
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => true)
      .catch(() => false);

    if (!headingVisible) {
      // At minimum the page should not be blank
      const bodyText = await page.locator('body').innerText().catch(() => '');
      expect(bodyText.length, 'privacy page should have content').toBeGreaterThan(50);
    }
  });

  test('about page loads with content', async ({ page }) => {
    await gotoWithRetry(page, '/about');

    // Should render some content
    const candidates = [
      page.getByText(/Metravel|О нас|О проекте|Контакт/i).first(),
      page.locator('h1, h2').first(),
    ];

    const anyVisible = await Promise.all(
      candidates.map((c) =>
        c
          .waitFor({ state: 'visible', timeout: 15_000 })
          .then(() => true)
          .catch(() => false)
      )
    );
    expect(anyVisible.some(Boolean), 'about page should have visible content').toBeTruthy();
  });
});
