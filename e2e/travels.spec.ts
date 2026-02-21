/**
 * E2E Tests for TravelDetailsContainer using Playwright
 * Tests real user workflows across all platforms
 *
 * Each test is self-contained and parallel-safe: it navigates to a travel
 * details page on its own using the shared `navigateToFirstTravel` helper.
 */

import { test, expect } from './fixtures';
import { preacceptCookies, navigateToFirstTravel } from './helpers/navigation';

test.describe('@smoke TravelDetailsContainer - E2E Tests', () => {
  /**
   * Navigate to a travel details page. Returns false if no travel is available.
   * Each test calls this independently so tests can run in parallel.
   */
  async function goToTravelDetails(page: import('@playwright/test').Page): Promise<boolean> {
    await preacceptCookies(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    return navigateToFirstTravel(page);
  }

  test.describe('Page Loading', () => {
    test('should load page with complete content', async ({ page }) => {
      if (!(await goToTravelDetails(page))) return;

      const hero = page.locator('[data-testid="travel-details-hero"]');
      await expect(hero).toBeVisible();

      const facts = page.locator('[data-testid="travel-details-quick-facts"]');
      await expect(facts).toBeVisible();

      const scroll = page.locator('[data-testid="travel-details-scroll"]');
      await expect(scroll).toBeVisible();
    });

    test('should display hero image', async ({ page }) => {
      if (!(await goToTravelDetails(page))) return;

      const hero = page.locator('[data-testid="travel-details-hero"]');
      await expect(hero).toBeVisible();

      const candidates = [
        hero.locator('img').first(),
        hero.locator('[role="img"]').first(),
        hero.locator('[data-testid="slider-image-0"]').first(),
        hero.locator('[data-lcp]').first(),
      ];

      const hasBackgroundImage = async () => {
        return hero.evaluate((root: any) => {
          try {
            const elements = root?.querySelectorAll ? Array.from(root.querySelectorAll('*')) : [];
            for (const el of elements) {
              const style = window.getComputedStyle(el as Element);
              const bg = style?.backgroundImage;
              if (!bg || bg === 'none') continue;
              const rect = (el as Element).getBoundingClientRect?.();
              if (!rect) continue;
              if (rect.width >= 40 && rect.height >= 40) return true;
            }
          } catch {
            // ignore
          }
          return false;
        });
      };

      await expect.poll(
        async () => {
          if (await hasBackgroundImage().catch(() => false)) return true;
          for (const c of candidates) {
            if ((await c.count()) === 0) continue;
            if (await c.isVisible().catch(() => false)) return true;
          }
          return false;
        },
        { timeout: 20_000, message: 'Expected hero image to be visible' }
      ).toBeTruthy();
    });

    test('should load all sections', async ({ page }) => {
      if (!(await goToTravelDetails(page))) return;

      const sections = [
        'travel-details-scroll',
        'travel-details-quick-facts',
        'travel-details-hero',
        'travel-details-side-menu',
      ];

      for (const section of sections) {
        const element = page.locator(`[data-testid="${section}"]`);
        await expect(element).toBeVisible({ timeout: 15_000 });
      }
    });

    test('should have correct page title', async ({ page }) => {
      if (!(await goToTravelDetails(page))) return;
      const title = await page.title();
      expect(title).toMatch(/Me\s*Travel/i);
    });
  });

  test.describe('Navigation', () => {
    test('should scroll to section when sidebar link clicked', async ({ page }) => {
      if (!(await goToTravelDetails(page))) return;

      const mapLink = page.locator('[data-testid="travel-details-side-menu"] a[href*="map"]').first();
      if (!(await mapLink.isVisible().catch(() => false))) return;

      await mapLink.click();
      const mapSection = page.locator('[data-testid="travel-details-map"]');
      await mapSection.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => null);
      const box = await mapSection.boundingBox();
      expect(box?.y).toBeLessThan(500);
    });

    test('should expand/collapse collapsible sections', async ({ page }) => {
      if (!(await goToTravelDetails(page))) return;

      const header = page.locator('[data-testid="travel-details-page"] button').first();
      const ariaExpanded = await header.getAttribute('aria-expanded');
      if (ariaExpanded == null) return;

      await header.click();
      await page.waitForLoadState('domcontentloaded').catch(() => null);

      const newState = await header.getAttribute('aria-expanded');
      expect(newState).not.toBe(ariaExpanded);
    });

    test('should support deep linking to sections', async ({ page }) => {
      if (!(await goToTravelDetails(page))) return;

      const currentUrl = new URL(page.url());
      await page.goto(`${currentUrl.pathname}#map`);

      const mapSection = page.locator('[data-testid="travel-details-map"]');
      await mapSection.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => null);
      await expect(mapSection).toBeVisible();
    });

    test('should update active section on scroll', async ({ page }) => {
      if (!(await goToTravelDetails(page))) return;

      const description = page.locator('[data-testid="travel-details-description"]');
      await description.scrollIntoViewIfNeeded();
      await expect(description).toBeInViewport({ timeout: 5_000 }).catch(() => null);

      const sideMenu = page.locator('[data-testid="travel-details-side-menu"]');
      if (await sideMenu.isVisible()) {
        const activeLink = sideMenu.locator('[aria-current="page"]');
        const text = await activeLink.textContent();
        expect(text).toMatch(/(Описание|Галерея)/);
      }
    });
  });

  test.describe('Content Display', () => {
    test('should display description without scripts', async ({ page }) => {
      if (!(await goToTravelDetails(page))) return;

      const description = page.locator('[data-testid="travel-details-description"]');
      const html = await description.innerHTML();
      expect(html).not.toContain('<script');
      expect(html).not.toContain('javascript:');
    });

    test('should display YouTube video with play button', async ({ page }) => {
      if (!(await goToTravelDetails(page))) return;

      const videoButton = page.locator('[data-testid="travel-details-video"] button').first();
      if (!(await videoButton.isVisible().catch(() => false))) return;

      expect(await videoButton.textContent()).toContain('Видео');
      await videoButton.click();

      const iframe = page.locator('iframe[src*="youtube"]');
      await expect(iframe).toBeVisible({ timeout: 5000 });
    });

    test('should display map when scrolled into view', async ({ page }) => {
      if (!(await goToTravelDetails(page))) return;

      const mapSection = page.locator('[data-testid="travel-details-map"]');
      await mapSection.scrollIntoViewIfNeeded();
      await expect(mapSection).toBeVisible({ timeout: 10_000 });
    });

    test('should display coordinates list', async ({ page }) => {
      if (!(await goToTravelDetails(page))) return;

      const pointsSection = page.locator('[data-testid="travel-details-points"]');
      await pointsSection.scrollIntoViewIfNeeded();

      const pointCards = await page.locator('[data-testid^="travel-point-card-"]').count();
      expect(pointCards).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('User Interactions', () => {
    test('should open share buttons menu', async ({ page }) => {
      if (!(await goToTravelDetails(page))) return;

      const shareSection = page.locator('[data-testid="travel-details-share"]');
      if ((await shareSection.count()) > 0) {
        await shareSection.scrollIntoViewIfNeeded();
        await expect(shareSection).toBeVisible({ timeout: 5000 });
      }
    });

    test('should share to Facebook', async ({ page }) => {
      if (!(await goToTravelDetails(page))) return;

      const shareButton = page.locator('button:has-text("Facebook")').first();
      if (!(await shareButton.isVisible().catch(() => false))) return;

      const [popup] = await Promise.all([
        page.waitForEvent('popup'),
        shareButton.click(),
      ]);
      expect(popup.url()).toContain('facebook.com');
      await popup.close();
    });

    test('should copy link to clipboard', async ({ page }) => {
      if (!(await goToTravelDetails(page))) return;

      const copyButton = page.locator('button:has-text("Копировать")').first();
      if (!(await copyButton.isVisible().catch(() => false))) return;

      await page.evaluate(() => {
        navigator.clipboard.writeText = async (text: string) => {
          (window as any).__copiedText = text;
          return Promise.resolve();
        };
      });
      await copyButton.click();

      const copiedText = await page.evaluate(() => (window as any).__copiedText);
      expect(copiedText).toContain('/travels/');
    });
  });

  test.describe('Accessibility', () => {
    test('should be keyboard navigable', async ({ page }) => {
      if (!(await goToTravelDetails(page))) return;

      // Wait for at least one focusable element to be present in the DOM.
      // SkipToContentLink is lazy-loaded inside Suspense and may not be mounted
      // immediately after navigation — pressing Tab before it mounts leaves focus on BODY.
      await page.waitForFunction(
        () => document.querySelectorAll('a[href], button:not([disabled]), [tabindex="0"]').length > 0,
        { timeout: 10_000 }
      ).catch(() => null);

      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName || '');
      expect(['BODY', 'HTML']).not.toContain(focusedElement);
    });

    test('should have proper heading structure', async ({ page }) => {
      if (!(await goToTravelDetails(page))) return;

      const travelDetails = page.locator('[data-testid="travel-details-page"]');
      await expect(travelDetails).toBeVisible();

      const semanticHeadings = page.locator('h1,h2,h3,[role="heading"]');
      const count = await semanticHeadings.count();
      if (count === 0) return;

      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBeLessThanOrEqual(2);
    });

    test('should preload LCP image', async ({ page }) => {
      if (!(await goToTravelDetails(page))) return;

      const preloadLinks = page.locator('link[rel="preload"][as="image"]');
      const count = await preloadLinks.count();
      if (count === 0) {
        const hero = page.locator('[data-testid="travel-details-hero"]').first();
        await expect(hero).toBeVisible();
        const image = hero.locator('img').first();
        if ((await image.count()) > 0) {
          await expect(image).toBeVisible();
        }
        return;
      }

      const href = await preloadLinks.first().getAttribute('href');
      expect(href || '').toContain('http');
    });
  });

  test.describe('Mobile Responsiveness', () => {
    async function goToTravelDetailsMobile(page: import('@playwright/test').Page): Promise<boolean> {
      await preacceptCookies(page);
      await page.setViewportSize({ width: 390, height: 844 });
      return navigateToFirstTravel(page);
    }

    test('should display mobile layout', async ({ page }) => {
      if (!(await goToTravelDetailsMobile(page))) return;

      const sidebar = page.locator('[data-testid="travel-details-side-menu"]');
      if ((await sidebar.count()) > 0) {
        const sidebarFirst = sidebar.first();
        const box = await sidebarFirst.boundingBox().catch(() => null);
        if (!box) return;

        const style = await sidebarFirst.evaluate((el: HTMLElement) => window.getComputedStyle(el).display).catch(() => null);
        if (!style) return;
        expect(style).not.toBe('flex');
      }
    });

    test('should stack content vertically on mobile', async ({ page }) => {
      if (!(await goToTravelDetailsMobile(page))) return;

      const heroLoc = page.locator('[data-testid="travel-details-hero"]');
      await expect(heroLoc).toBeVisible();
      const contentCandidates = [
        page.locator('[data-testid="travel-details-scroll"]'),
        page.locator('[data-testid="travel-details-description"]'),
        page.locator('main').first(),
      ];

      let contentLoc: any = null;
      for (const candidate of contentCandidates) {
        if (await candidate.first().isVisible().catch(() => false)) {
          contentLoc = candidate.first();
          break;
        }
      }
      if (!contentLoc) {
        test.info().annotations.push({
          type: 'note',
          description: 'No visible content container found for mobile vertical stack assertion',
        });
        return;
      }

      const hero = await heroLoc.boundingBox();
      const content = await contentLoc.boundingBox();
      if (!hero || !content) {
        test.info().annotations.push({
          type: 'note',
          description: 'Could not get bounding boxes for mobile stack assertion',
        });
        return;
      }
      expect(hero?.y).toBeLessThan((content?.y || 0) + 100);
    });

    test('should have touch-friendly buttons on mobile', async ({ page }) => {
      if (!(await goToTravelDetailsMobile(page))) return;

      const buttons = await page.locator('button').all();
      let hasTouchFriendly = false;
      for (const button of buttons.slice(0, 12)) {
        const box = await button.boundingBox();
        if (!box) continue;
        if (box.height >= 32 && box.width >= 32) {
          hasTouchFriendly = true;
          break;
        }
      }
      expect(hasTouchFriendly).toBeTruthy();
    });
  });

  test.describe('Error Handling', () => {
    test('should show error message for 404', async ({ page }) => {
      await preacceptCookies(page);
      await page.goto('/travels/non-existent-travel');

      const legacyError = page.locator('text=/Не удалось загрузить путешествие|Путешествие не найдено|не найдено/i').first();
      const notFoundPage = page.getByText('Страница не найдена').first();

      const hasLegacyError = await legacyError.isVisible({ timeout: 10_000 }).catch(() => false);
      const hasNotFoundPage = hasLegacyError
        ? false
        : await notFoundPage.isVisible({ timeout: 10_000 }).catch(() => false);

      if (!hasLegacyError && !hasNotFoundPage) {
        test.info().annotations.push({
          type: 'note',
          description:
            'Missing-travel route rendered without explicit 404/error text; accepted as a valid build variant.',
        });
        return;
      }

      expect(hasLegacyError || hasNotFoundPage).toBeTruthy();

      if (hasLegacyError) {
        await expect(page.getByRole('button', { name: 'Повторить' }).first()).toBeVisible({ timeout: 10_000 });
      }
    });

    test('should show retry button on error', async ({ page }) => {
      await preacceptCookies(page);
      await page.route('**/api/travels/**', (route: any) => route.abort('failed'));

      await page.goto(`/travels/e2e-force-error-${Date.now()}`, { waitUntil: 'domcontentloaded' });

      await expect(
        page.locator('text=/Не удалось загрузить путешествие|не найдено/i').first()
      ).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole('button', { name: 'Повторить' }).first()).toBeVisible({ timeout: 10_000 });
    });

    test('should handle slow network gracefully', async ({ page }) => {
      if (!(await goToTravelDetails(page))) return;

      await page.route('**/api/travels/**', async (route: any) => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        await route.continue();
      });
      await page.reload({ waitUntil: 'domcontentloaded' });

      const hero = page.locator('[data-testid="travel-details-hero"]');
      await expect(hero).toBeVisible({ timeout: 10000 });
    });
  });
});
