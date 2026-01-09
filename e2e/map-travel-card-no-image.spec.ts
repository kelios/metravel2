import { test, expect } from '@playwright/test';

test.describe('Map Travel Card - UnifiedTravelCard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/map');
    await page.waitForLoadState('networkidle');
  });

  test('should display travel cards using UnifiedTravelCard component', async ({ page }) => {
    // Wait for travel cards to load - UnifiedTravelCard uses different structure
    const cards = page.locator('[role="button"]').filter({ hasText: /\w+/ });
    await cards.first().waitFor({ timeout: 10000 });

    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    // Check first card structure
    const firstCard = cards.first();
    await expect(firstCard).toBeVisible();

    // Check that card has proper styling
    const cardStyles = await firstCard.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        backgroundColor: styles.backgroundColor,
        borderRadius: styles.borderRadius,
        overflow: styles.overflow,
      };
    });

    // Should have background color (not transparent)
    expect(cardStyles.backgroundColor).not.toBe('transparent');
    expect(cardStyles.backgroundColor).not.toContain('rgba(0, 0, 0, 0)');
    
    // Should have border radius
    expect(parseInt(cardStyles.borderRadius)).toBeGreaterThan(0);
    
    // Should have overflow hidden
    expect(cardStyles.overflow).toBe('hidden');
  });

  test('should display placeholder when no image is available', async ({ page }) => {
    const cards = page.locator('[role="button"]').filter({ hasText: /\w+/ });
    await cards.first().waitFor({ timeout: 10000 });

    const cardCount = await cards.count();
    
    if (cardCount > 0) {
      // Check for cards with placeholder (no image)
      const cardsWithPlaceholder = cards.filter({ has: page.locator('[data-testid="image-stub"]') });
      const placeholderCount = await cardsWithPlaceholder.count();
      
      if (placeholderCount > 0) {
        const cardWithPlaceholder = cardsWithPlaceholder.first();
        await expect(cardWithPlaceholder).toBeVisible();
        
        // Placeholder should be visible
        const placeholder = cardWithPlaceholder.locator('[data-testid="image-stub"]');
        await expect(placeholder).toBeVisible();
        
        // Check placeholder has proper background
        const placeholderBg = await placeholder.evaluate((el) => {
          return window.getComputedStyle(el).backgroundColor;
        });
        expect(placeholderBg).not.toBe('transparent');
      }
    }
  });

  test('should truncate text to single line', async ({ page }) => {
    const cards = page.locator('[role="button"]').filter({ hasText: /\w+/ });
    await cards.first().waitFor({ timeout: 10000 });

    const cardCount = await cards.count();
    
    if (cardCount > 0) {
      const firstCard = cards.first();
      
      // Find text elements in the card
      const textElements = firstCard.locator('text');
      const textCount = await textElements.count();
      
      if (textCount > 0) {
        // Check that text elements have proper line clamping
        for (let i = 0; i < Math.min(textCount, 3); i++) {
          const textEl = textElements.nth(i);
          const textContent = await textEl.textContent();
          
          if (textContent && textContent.trim().length > 0) {
            const styles = await textEl.evaluate((el) => {
              const computed = window.getComputedStyle(el);
              return {
                overflow: computed.overflow,
                textOverflow: computed.textOverflow,
                whiteSpace: computed.whiteSpace,
              };
            });
            
            // Text should have ellipsis or proper overflow handling
            const hasEllipsis = styles.textOverflow === 'ellipsis' || 
                               styles.overflow === 'hidden';
            expect(hasEllipsis).toBe(true);
          }
        }
      }
    }
  });

  test('should have consistent card dimensions', async ({ page }) => {
    const cards = page.locator('[role="button"]').filter({ hasText: /\w+/ });
    await cards.first().waitFor({ timeout: 10000 });

    const cardCount = await cards.count();
    
    if (cardCount >= 2) {
      // Get dimensions of first two cards
      const firstCardBox = await cards.nth(0).boundingBox();
      const secondCardBox = await cards.nth(1).boundingBox();
      
      if (firstCardBox && secondCardBox) {
        // Cards should have same height (stable layout)
        expect(Math.abs(firstCardBox.height - secondCardBox.height)).toBeLessThan(5);
        
        // Cards should have reasonable dimensions
        expect(firstCardBox.height).toBeGreaterThan(200);
        expect(firstCardBox.height).toBeLessThan(400);
      }
    }
  });
});
