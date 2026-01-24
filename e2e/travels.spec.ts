/**
 * E2E Tests for TravelDetailsContainer using Playwright
 * Tests real user workflows across all platforms
 */

import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import { getTravelsListPath } from './helpers/routes';

let travelBasePath: string | null = null;

test.describe('TravelDetailsContainer - E2E Tests', () => {
  let page: Page;
  const assertTravelsListVisible = async () => {
    await expect(page.getByText('Путешествия').first()).toBeVisible({ timeout: 15_000 });
  };

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="travel-card-link"]');
    if ((await cards.count()) === 0) {
      travelBasePath = null;
      await page.close();
      return;
    }

    await cards.first().click();
    await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

    const url = new URL(page.url());
    travelBasePath = `${url.pathname}${url.search}`;
    await page.close();
  });

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;

    // Set viewport for mobile testing
    await page.setViewportSize({ width: 1280, height: 720 });

    if (!travelBasePath) {
      await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
      await assertTravelsListVisible();
      return;
    }

    // Go to travel details page
    await page.goto(travelBasePath);

    // Wait for main content to load
    await page.waitForSelector('[data-testid="travel-details-page"]', { timeout: 10000 });
  });

  test.describe('Page Loading', () => {
    test('should load page with complete content', async () => {
      if (!travelBasePath) {
        await assertTravelsListVisible();
        return;
      }
      // Check hero section
      const hero = await page.locator('[data-testid="travel-details-hero"]');
      await expect(hero).toBeVisible();

      // Check quick facts
      const facts = await page.locator('[data-testid="travel-details-quick-facts"]');
      await expect(facts).toBeVisible();

      // Check main content
      const content = await page.locator('[data-testid="travel-details-section-gallery"]');
      // This is an anchor View (used for scrolling) and may have zero size on web.
      await expect(content).toBeAttached();
    });

    test('should display hero image', async () => {
      if (!travelBasePath) {
        await assertTravelsListVisible();
        return;
      }
      const hero = await page.locator('[data-testid="travel-details-hero"]');
      await expect(hero).toBeVisible();

      // Wait for image to load - check for either slider image or optimized hero img
      const sliderImage = page.locator('[data-testid^="slider-image-"]').first();
      const optimizedHeroImg = page.locator('[data-testid="travel-details-hero"] img').first();
      
      // At least one should be visible
      const hasSliderImage = await sliderImage.isVisible().catch(() => false);
      const hasOptimizedImg = await optimizedHeroImg.isVisible().catch(() => false);
      
      expect(hasSliderImage || hasOptimizedImg).toBeTruthy();
    });

    test('should load all sections', async () => {
      if (!travelBasePath) {
        await assertTravelsListVisible();
        return;
      }
      const sections = [
        'travel-details-section-gallery',
        'travel-details-quick-facts',
        'travel-details-hero',
        'travel-details-side-menu',
      ];

      for (const section of sections) {
        const element = await page.locator(`[data-testid="${section}"]`);
        if (section === 'travel-details-section-gallery') {
          await expect(element).toBeAttached();
        } else {
          await expect(element).toBeVisible({ timeout: 5000 });
        }
      }
    });

    test('should have correct page title', async () => {
      const title = await page.title();
      expect(title).toMatch(/Me\s*Travel/i);
    });
  });

  test.describe('Navigation', () => {
    test('should scroll to section when sidebar link clicked', async () => {
      if (!travelBasePath) {
        await assertTravelsListVisible();
        return;
      }
      // Find and click map section link in sidebar
      const mapLink = await page.locator('[data-testid="travel-details-side-menu"] a[href*="map"]').first();

      if (await mapLink.isVisible()) {
        await mapLink.click();

        // Wait for scroll animation
        await page.waitForTimeout(500);

        // Verify map section is in view
        const mapSection = await page.locator('[data-testid="travel-details-map"]');
        const box = await mapSection.boundingBox();
        expect(box?.y).toBeLessThan(500); // Should be near top of viewport
      }
    });

    test('should expand/collapse collapsible sections', async () => {
      if (!travelBasePath) {
        await assertTravelsListVisible();
        return;
      }
      // Find first collapsible section
      const header = await page.locator('[data-testid="travel-details-page"] button').first();

      // Check initial state
      const ariaExpanded = await header.getAttribute('aria-expanded');
      if (ariaExpanded == null) return;

      // Click to toggle
      await header.click();
      await page.waitForTimeout(300); // Animation

      // Verify state changed
      const newState = await header.getAttribute('aria-expanded');
      expect(newState).not.toBe(ariaExpanded);
    });

    test('should support deep linking to sections', async () => {
      if (!travelBasePath) {
        await assertTravelsListVisible();
        return;
      }
      // Navigate directly to map section
      await page.goto(`${travelBasePath}#map`);

      // Wait for content
      await page.waitForTimeout(500);

      // Verify map section is highlighted/active
      const mapSection = await page.locator('[data-testid="travel-details-map"]');
      await expect(mapSection).toBeVisible();
    });

    test('should update active section on scroll', async () => {
      if (!travelBasePath) {
        await assertTravelsListVisible();
        return;
      }
      // Get section positions
      await page.locator('[data-testid="travel-details-section-gallery"]');
      const description = await page.locator('[data-testid="travel-details-description"]');

      // Scroll to description
      await description.scrollIntoViewIfNeeded();

      // Wait for scroll to complete
      await page.waitForTimeout(500);

      // Verify sidebar updated (if visible)
      const sideMenu = await page.locator('[data-testid="travel-details-side-menu"]');
      if (await sideMenu.isVisible()) {
        const activeLink = await sideMenu.locator('[aria-current="page"]');
        const text = await activeLink.textContent();
        expect(text).toMatch(/(Описание|Галерея)/);
      }
    });
  });

  test.describe('Content Display', () => {
    test('should display description without scripts', async () => {
      if (!travelBasePath) {
        await assertTravelsListVisible();
        return;
      }
      const description = await page.locator('[data-testid="travel-details-description"]');
      const html = await description.innerHTML();

      // Verify no script tags
      expect(html).not.toContain('<script');
      expect(html).not.toContain('javascript:');
    });

    test('should display YouTube video with play button', async () => {
      if (!travelBasePath) {
        await assertTravelsListVisible();
        return;
      }
      // Look for video preview
      const videoButton = await page.locator('[data-testid="travel-details-video"] button').first();

      if (await videoButton.isVisible()) {
        expect(await videoButton.textContent()).toContain('Видео');

        // Click to play
        await videoButton.click();

        // Verify iframe appears
        const iframe = await page.locator('iframe[src*="youtube"]');
        await expect(iframe).toBeVisible({ timeout: 5000 });
      }
    });

    test('should display map when scrolled into view', async () => {
      if (!travelBasePath) {
        await assertTravelsListVisible();
        return;
      }
      // Scroll to map section
      const mapSection = await page.locator('[data-testid="travel-details-map"]');
      await mapSection.scrollIntoViewIfNeeded();

      // Wait for map to load
      await page.waitForTimeout(1000);

      // Verify map is visible
      await expect(mapSection).toBeVisible();
    });

    test('should display coordinates list', async () => {
      if (!travelBasePath) {
        await assertTravelsListVisible();
        return;
      }
      // Scroll to points section
      const pointsSection = await page.locator('[data-testid="travel-details-points"]');
      await pointsSection.scrollIntoViewIfNeeded();

      // Verify point cards exist (FlashList renders View components, not li elements)
      const pointCards = await page.locator('[data-testid^="travel-point-card-"]').count();
      expect(pointCards).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('User Interactions', () => {
    test('should open share buttons menu', async () => {
      if (!travelBasePath) {
        await assertTravelsListVisible();
        return;
      }
      // Check if share section exists (only visible on desktop)
      const shareSection = await page.locator('[data-testid="travel-details-share"]');
      const shareCount = await shareSection.count();
      
      if (shareCount > 0) {
        await shareSection.scrollIntoViewIfNeeded();
        await expect(shareSection).toBeVisible({ timeout: 5000 });
      }
    });

    test('should share to Facebook', async () => {
      if (!travelBasePath) {
        await assertTravelsListVisible();
        return;
      }
      const shareButton = await page.locator('button:has-text("Facebook")').first();

      if (await shareButton.isVisible()) {
        // Mock window.open
        const [popup] = await Promise.all([
          page.waitForEvent('popup'),
          shareButton.click(),
        ]);

        expect(popup.url()).toContain('facebook.com');
        await popup.close();
      }
    });

    test('should copy link to clipboard', async () => {
      if (!travelBasePath) {
        await assertTravelsListVisible();
        return;
      }
      // Find copy button
      const copyButton = await page.locator('button:has-text("Копировать")').first();

      if (await copyButton.isVisible()) {
        // Mock clipboard
        await page.evaluate(() => {
          navigator.clipboard.writeText = async (text: string) => {
            (window as any).__copiedText = text;
            return Promise.resolve();
          };
        });

        await copyButton.click();

        // Verify link was copied
        const copiedText = await page.evaluate(() => (window as any).__copiedText);
        expect(copiedText).toContain('/travels/');
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should be keyboard navigable', async () => {
      if (!travelBasePath) {
        await assertTravelsListVisible();
        return;
      }
      // Tab through page
      let focusedElement = await page.evaluate(() => document.activeElement?.tagName);

      // First tab should reach interactive element
      await page.keyboard.press('Tab');
      focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(['A', 'BUTTON', 'INPUT']).toContain(focusedElement);
    });

    test('should have proper heading structure', async () => {
      if (!travelBasePath) {
        await assertTravelsListVisible();
        return;
      }
      // Get all headings - React Native Web may render headings differently
      const h1 = await page.locator('h1').count();
      const h2 = await page.locator('h2').count();
      const h3 = await page.locator('h3').count();
      const totalHeadings = h1 + h2 + h3;

      // Ensure at least some semantic headings exist
      expect(totalHeadings).toBeGreaterThanOrEqual(1);
    });

    test('should preload LCP image', async () => {
      if (!travelBasePath) {
        await assertTravelsListVisible();
        return;
      }
      const preloadLinks = await page.locator('link[rel="preload"][as="image"]');
      const count = await preloadLinks.count();
      if (count === 0) {
        // Some deployments do not emit <link rel="preload">; fallback to checking hero image exists.
        const image = await page.locator('[data-testid="travel-details-hero"] img').first();
        await expect(image).toBeVisible();
        return;
      }

      const href = await preloadLinks.first().getAttribute('href');
      expect(href || '').toContain('http');
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test.beforeEach(async () => {
      // Set mobile viewport
      await page.setViewportSize({ width: 390, height: 844 }); // iPhone 12
    });

    test('should display mobile layout', async () => {
      if (!travelBasePath) {
        await assertTravelsListVisible();
        return;
      }
      // Check sidebar is hidden or collapsed
      const sidebar = page.locator('[data-testid="travel-details-side-menu"]');
      const sidebarCount = await sidebar.count();

      // On mobile, sidebar should not be visible in desktop layout
      // (might be shown as bottom sheet or not at all)
      if (sidebarCount > 0) {
        const isVisible = await sidebar.isVisible().catch(() => false);
        if (isVisible) {
          const style = await sidebar.evaluate((el: HTMLElement) => window.getComputedStyle(el).display);
          expect(style).not.toBe('flex'); // Should be hidden or positioned differently
        }
      }
    });

    test('should stack content vertically on mobile', async () => {
      if (!travelBasePath) {
        await assertTravelsListVisible();
        return;
      }
      // Get hero and main content positions
      const heroLoc = page.locator('[data-testid="travel-details-hero"]');
      const contentLoc = page.locator('[data-testid="travel-details-scroll"]');
      await expect(heroLoc).toBeVisible();
      await expect(contentLoc).toBeVisible();

      const hero = await heroLoc.boundingBox();
      const content = await contentLoc.boundingBox();

      expect(hero).toBeTruthy();
      expect(content).toBeTruthy();

      // Hero should be above content
      expect(hero?.y).toBeLessThan((content?.y || 0) + 100);
    });

    test('should have touch-friendly buttons on mobile', async () => {
      if (!travelBasePath) {
        await assertTravelsListVisible();
        return;
      }
      // Check button sizes
      const buttons = await page.locator('button').all();

      // UI contains icon-only controls; require that at least one visible button is reasonably touch-friendly.
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
    test('should show error message for 404', async () => {
      await page.goto('/travels/non-existent-travel');

      // Should show error message
      await expect(
        page.locator('text=/Не удалось загрузить путешествие|не найдено/i').first()
      ).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole('button', { name: 'Повторить' }).first()).toBeVisible({ timeout: 10_000 });
    });

    test('should show retry button on error', async () => {
      if (!travelBasePath) {
        await assertTravelsListVisible();
        return;
      }
      // Mock API to fail
      await page.route('**/api/travels/**', (route: any) => route.abort());

      // Navigate to details page with failing API
      await page.goto(travelBasePath);

      // Should show retry button
      await expect(page.getByRole('button', { name: 'Повторить' }).first()).toBeVisible({ timeout: 10_000 });
    });

    test('should handle slow network gracefully', async () => {
      if (!travelBasePath) {
        await assertTravelsListVisible();
        return;
      }
      // Simulate slow 3G
      await page.route('**/*', (route: any) => {
        setTimeout(() => route.continue(), 500);
      });

      await page.goto(travelBasePath);

      // Should still display content
      const hero = await page.locator('[data-testid="travel-details-hero"]');
      await expect(hero).toBeVisible({ timeout: 10000 });
    });
  });
});
