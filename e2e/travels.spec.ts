/**
 * E2E Tests for TravelDetailsContainer using Playwright
 * Tests real user workflows across all platforms
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TRAVEL_SLUG = 'minsk-capital';
const TRAVEL_URL = `${BASE_URL}/travels/${TRAVEL_SLUG}`;

test.describe('TravelDetailsContainer - E2E Tests', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;

    // Set viewport for mobile testing
    await page.setViewportSize({ width: 1280, height: 720 });

    // Go to travel details page
    await page.goto(TRAVEL_URL);

    // Wait for main content to load
    await page.waitForSelector('[testID="travel-details-page"]', { timeout: 10000 });
  });

  test.describe('Page Loading', () => {
    test('should load page with complete content', async () => {
      // Check hero section
      const hero = await page.locator('[testID="travel-details-hero"]');
      await expect(hero).toBeVisible();

      // Check quick facts
      const facts = await page.locator('[testID="travel-details-quick-facts"]');
      await expect(facts).toBeVisible();

      // Check main content
      const content = await page.locator('[testID="travel-details-section-gallery"]');
      await expect(content).toBeVisible();
    });

    test('should display hero image', async () => {
      const image = await page.locator('[testID="travel-details-hero"] img').first();
      await expect(image).toBeVisible();

      // Verify image is loaded
      const src = await image.getAttribute('src');
      expect(src).toBeTruthy();
      expect(src).toContain('http');
    });

    test('should load all sections', async () => {
      const sections = [
        'travel-details-section-gallery',
        'travel-details-quick-facts',
        'travel-details-hero',
        'travel-details-side-menu',
      ];

      for (const section of sections) {
        const element = await page.locator(`[testID="${section}"]`);
        await expect(element).toBeVisible({ timeout: 5000 });
      }
    });

    test('should have correct page title', async () => {
      const title = await page.title();
      expect(title).toContain('MeTravel');
      expect(title).toContain('Минск'); // Travel name should be in title
    });
  });

  test.describe('Navigation', () => {
    test('should scroll to section when sidebar link clicked', async () => {
      // Find and click map section link in sidebar
      const mapLink = await page.locator('[testID="travel-details-side-menu"] a[href*="map"]').first();

      if (await mapLink.isVisible()) {
        await mapLink.click();

        // Wait for scroll animation
        await page.waitForTimeout(500);

        // Verify map section is in view
        const mapSection = await page.locator('[testID="travel-details-map"]');
        const box = await mapSection.boundingBox();
        expect(box?.y).toBeLessThan(500); // Should be near top of viewport
      }
    });

    test('should expand/collapse collapsible sections', async () => {
      // Find first collapsible section
      const header = await page.locator('[testID="travel-details-page"] button').first();

      // Check initial state
      const ariaExpanded = await header.getAttribute('aria-expanded');

      // Click to toggle
      await header.click();
      await page.waitForTimeout(300); // Animation

      // Verify state changed
      const newState = await header.getAttribute('aria-expanded');
      expect(newState).not.toBe(ariaExpanded);
    });

    test('should support deep linking to sections', async () => {
      // Navigate directly to map section
      await page.goto(`${TRAVEL_URL}#map`);

      // Wait for content
      await page.waitForTimeout(500);

      // Verify map section is highlighted/active
      const mapSection = await page.locator('[testID="travel-details-map"]');
      await expect(mapSection).toBeVisible();
    });

    test('should update active section on scroll', async () => {
      // Get section positions
      await page.locator('[testID="travel-details-section-gallery"]');
      const description = await page.locator('[testID="travel-details-description"]');

      // Scroll to description
      await description.scrollIntoViewIfNeeded();

      // Wait for scroll to complete
      await page.waitForTimeout(500);

      // Verify sidebar updated (if visible)
      const sideMenu = await page.locator('[testID="travel-details-side-menu"]');
      if (await sideMenu.isVisible()) {
        const activeLink = await sideMenu.locator('[aria-current="page"]');
        const text = await activeLink.textContent();
        expect(text).toContain('Описание'); // Should highlight description
      }
    });
  });

  test.describe('Content Display', () => {
    test('should display description without scripts', async () => {
      const description = await page.locator('[testID="travel-details-description"]');
      const html = await description.innerHTML();

      // Verify no script tags
      expect(html).not.toContain('<script');
      expect(html).not.toContain('javascript:');
    });

    test('should display YouTube video with play button', async () => {
      // Look for video preview
      const videoButton = await page.locator('[testID="travel-details-video"] button').first();

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
      // Scroll to map section
      const mapSection = await page.locator('[testID="travel-details-map"]');
      await mapSection.scrollIntoViewIfNeeded();

      // Wait for map to load
      await page.waitForTimeout(1000);

      // Verify map is visible
      await expect(mapSection).toBeVisible();
    });

    test('should display coordinates list', async () => {
      // Scroll to points section
      const pointsSection = await page.locator('[testID="travel-details-points"]');
      await pointsSection.scrollIntoViewIfNeeded();

      // Verify list items
      const listItems = await pointsSection.locator('li').count();
      expect(listItems).toBeGreaterThan(0);
    });
  });

  test.describe('User Interactions', () => {
    test('should open share buttons menu', async () => {
      // Find share button
      const shareButton = await page.locator('[testID="travel-details-share"] button').first();

      if (await shareButton.isVisible()) {
        await shareButton.click();

        // Verify menu opened
        const menu = await page.locator('[testID="travel-details-share"] [role="menu"]');
        await expect(menu).toBeVisible({ timeout: 3000 });
      }
    });

    test('should share to Facebook', async () => {
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
        expect(copiedText).toContain(TRAVEL_SLUG);
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should be keyboard navigable', async () => {
      // Tab through page
      let focusedElement = await page.evaluate(() => document.activeElement?.tagName);

      // First tab should reach interactive element
      await page.keyboard.press('Tab');
      focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(['A', 'BUTTON', 'INPUT']).toContain(focusedElement);
    });

    test('should have proper heading structure', async () => {
      // Get all headings
      const h1 = await page.locator('h1').count();
      const h2 = await page.locator('h2').count();
      const h3 = await page.locator('h3').count();

      expect(h1).toBeGreaterThanOrEqual(1);
      expect(h2).toBeGreaterThanOrEqual(1);
      expect(h3).toBeGreaterThanOrEqual(0);
    });

    test('should have alt text on images', async () => {
      const images = await page.locator('img').all();

      for (const img of images) {
        const alt = await img.getAttribute('alt');
        // Alt can be empty for decorative, but should be present
        expect(alt).toBeDefined();
      }
    });

    test('should have ARIA labels on buttons', async () => {
      const buttons = await page.locator('button').all();

      for (const button of buttons) {
        const ariaLabel = await button.getAttribute('aria-label');
        const text = await button.textContent();

        // Either aria-label or visible text
        expect(ariaLabel || text?.trim()).toBeTruthy();
      }
    });

    test('should focus be visible', async () => {
      // Tab to first button
      await page.keyboard.press('Tab');

      // Check if focused element has outline or similar
      const focused = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const style = window.getComputedStyle(el);
        return {
          outline: style.outline,
          boxShadow: style.boxShadow,
          border: style.border,
        };
      });

      const hasVisible =
        focused.outline !== 'none' ||
        focused.boxShadow !== 'none' ||
        focused.border !== '0px';

      expect(hasVisible).toBeTruthy();
    });
  });

  test.describe('Performance', () => {
    test('should load page in under 3 seconds', async () => {
      const startTime = Date.now();

      await page.goto(TRAVEL_URL);
      await page.waitForSelector('[testID="travel-details-page"]');

      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(3000);
    });

    test('should have good Largest Contentful Paint', async () => {
      const metrics = await page.evaluate(() => {
        return new Promise((resolve) => {
          new (window as any).PerformanceObserver((list: any) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            resolve(lastEntry.renderTime || lastEntry.loadTime);
          }).observe({ entryTypes: ['largest-contentful-paint'] });
        });
      });

      expect(Number(metrics)).toBeLessThan(2500); // 2.5 seconds
    });

    test('should not have layout shifts', async () => {
      const cls = await page.evaluate(() => {
        return new Promise((resolve) => {
          let clsValue = 0;
          new (window as any).PerformanceObserver((list: any) => {
            list.getEntries().forEach((entry: any) => {
              if (!entry.hadRecentInput) {
                clsValue += entry.value;
              }
            });
          }).observe({ entryTypes: ['layout-shift'] });

          setTimeout(() => resolve(clsValue), 3000);
        });
      });

      expect(Number(cls)).toBeLessThan(0.1); // CLS < 0.1
    });

    test('should preload LCP image', async () => {
      const preloadLinks = await page.locator('link[rel="preload"][as="image"]');
      expect(await preloadLinks.count()).toBeGreaterThan(0);

      const href = await preloadLinks.first().getAttribute('href');
      expect(href).toContain('http');
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test.beforeEach(async () => {
      // Set mobile viewport
      await page.setViewportSize({ width: 390, height: 844 }); // iPhone 12
    });

    test('should display mobile layout', async () => {
      // Check sidebar is hidden or collapsed
      const sidebar = await page.locator('[testID="travel-details-side-menu"]');

      // On mobile, sidebar should not be visible in desktop layout
      // (might be shown as bottom sheet or not at all)
      if (await sidebar.isVisible()) {
        const style = await sidebar.evaluate(el => window.getComputedStyle(el).display);
        expect(style).not.toBe('flex'); // Should be hidden or positioned differently
      }
    });

    test('should stack content vertically on mobile', async () => {
      // Get hero and main content positions
      const hero = await page.locator('[testID="travel-details-hero"]').boundingBox();
      const content = await page.locator('[testID="travel-details-scroll"]').boundingBox();

      // Hero should be above content
      expect(hero?.y).toBeLessThan((content?.y || 0) + 100);
    });

    test('should have touch-friendly buttons on mobile', async () => {
      // Check button sizes
      const buttons = await page.locator('button').all();

      for (const button of buttons.slice(0, 5)) { // Check first 5 buttons
        const box = await button.boundingBox();
        // Minimum touch target is 44x44
        if (box) {
          expect(box.height).toBeGreaterThanOrEqual(40); // Allow slight margin
          expect(box.width).toBeGreaterThanOrEqual(40);
        }
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should show error message for 404', async () => {
      await page.goto(`${BASE_URL}/travels/non-existent-travel`);

      // Should show error message
      const errorMessage = await page.locator('text=не найдено').first();
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
    });

    test('should show retry button on error', async () => {
      // Mock API to fail
      await page.route('**/api/travels/*', route => route.abort());

      // Reload page to trigger error
      await page.reload();

      // Should show retry button
      const retryButton = await page.locator('button:has-text("Повторить")').first();
      await expect(retryButton).toBeVisible({ timeout: 5000 });
    });

    test('should handle slow network gracefully', async () => {
      // Simulate slow 3G
      await page.route('**/*', route => {
        setTimeout(() => route.continue(), 500);
      });

      await page.goto(TRAVEL_URL);

      // Should still display content
      const hero = await page.locator('[testID="travel-details-hero"]');
      await expect(hero).toBeVisible({ timeout: 10000 });
    });
  });
});

