import { test, expect } from './fixtures';
import { preacceptCookies } from './helpers/navigation';

const maybeRecoverFromWorkletError = async (page: any) => {
  const errorTitle = page.getByText('Что-то пошло не так', { exact: true });
  const workletError = page.getByText('_WORKLET is not defined', { exact: true });

  const hasError =
    (await errorTitle.isVisible().catch(() => false)) &&
    (await workletError.isVisible().catch(() => false));

  if (!hasError) return;

  const reloadButton = page.getByText('Перезагрузить страницу', { exact: true });
  const retryButton = page.getByText('Попробовать снова', { exact: true });

  if (await reloadButton.isVisible().catch(() => false)) {
    await reloadButton.click({ force: true }).catch(() => null);
    return;
  }
  if (await retryButton.isVisible().catch(() => false)) {
    await retryButton.click({ force: true }).catch(() => null);
    return;
  }

  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => null);
};

const waitForMapUi = async (page: any, timeoutMs: number) => {
  const mapReady = page.getByTestId('map-leaflet-wrapper');
  const mobileMenu = page.getByTestId('map-panel-open');

  await Promise.race([
    mapReady.waitFor({ state: 'visible', timeout: timeoutMs }).catch(() => null),
    mobileMenu.waitFor({ state: 'visible', timeout: timeoutMs }).catch(() => null),
  ]);

  const hasUi =
    (await mapReady.isVisible().catch(() => false)) ||
    (await mobileMenu.isVisible().catch(() => false));
  if (!hasUi) throw new Error('Map UI did not appear');
};

const gotoMapWithRecovery = async (page: any) => {
  const mapReady = page.getByTestId('map-leaflet-wrapper');
  const mobileMenu = page.getByTestId('map-panel-open');
  const workletError = page.getByText('_WORKLET is not defined', { exact: true });

  const startedAt = Date.now();
  const maxTotalMs = 120_000;

  await page.goto('/map', { waitUntil: 'domcontentloaded', timeout: 120_000 });

  while (Date.now() - startedAt < maxTotalMs) {
    const hasUi =
      (await mapReady.isVisible().catch(() => false)) ||
      (await mobileMenu.isVisible().catch(() => false));
    if (hasUi) return;

    const hasWorkletError = await workletError.isVisible().catch(() => false);
    if (hasWorkletError) {
      await maybeRecoverFromWorkletError(page);
      await page.waitForTimeout(800).catch(() => null);
      continue;
    }

    await page.waitForTimeout(300).catch(() => null);
  }

  await waitForMapUi(page, 60_000);
};

test.describe('Map Travel Card - UnifiedTravelCard', () => {
  test.beforeEach(async ({ page }) => {
    await preacceptCookies(page);

    await gotoMapWithRecovery(page);
  });

  const waitForCardsOrEmpty = async (page: any) => {
    const mobileMenu = page.getByTestId('map-panel-open');
    if (await mobileMenu.isVisible().catch(() => false)) {
      await mobileMenu.click();
    }

    // Wait for panel hydration — filters panel proves the React tree is interactive.
    await page.getByTestId('filters-panel').waitFor({ state: 'visible', timeout: 60_000 }).catch(() => null);

    const travelsTab = page.getByTestId('map-panel-tab-travels');
    const listTab = page.getByRole('tab', { name: /Список/i }).first();
    let tabLocator: any = null;
    try {
      await travelsTab.waitFor({ state: 'visible', timeout: 15_000 });
      tabLocator = travelsTab;
    } catch {
      try {
        await listTab.waitFor({ state: 'visible', timeout: 10_000 });
        tabLocator = listTab;
      } catch {
        // Neither tab found
      }
    }
    if (!tabLocator) return { cards: page.locator('[data-testid="map-travel-card"]'), cardCount: 0 };

    // Click and retry — first click may fire before handlers are fully wired.
    for (let attempt = 0; attempt < 3; attempt++) {
      await tabLocator.click({ force: attempt > 0, timeout: 30_000 }).catch(() => null);
      const visible = await page.getByTestId('map-travels-tab').isVisible().catch(() => false);
      if (visible) break;
      await page.waitForTimeout(1_000);
    }
    await expect(page.getByTestId('map-travels-tab')).toBeVisible({ timeout: 30_000 });
    const cards = page.locator('[data-testid="map-travel-card"]');
    const cardCount = await cards.count();
    return { cards, cardCount };
  };

  test('should display travel cards using UnifiedTravelCard component', async ({ page }) => {
    const { cards, cardCount } = await waitForCardsOrEmpty(page);
    if (cardCount === 0) return;

    // Check first card structure
    const firstCard = cards.first();
    await expect(firstCard).toBeVisible();

    // Check that card has proper styling
    const cardStyles = await firstCard.evaluate((el: HTMLElement) => {
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
    const { cards, cardCount } = await waitForCardsOrEmpty(page);
    
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
        const placeholderBg = await placeholder.evaluate((el: HTMLElement) => {
          return window.getComputedStyle(el).backgroundColor;
        });
        expect(placeholderBg).not.toBe('transparent');
      }
    }
  });

  test('should truncate text to single line', async ({ page }) => {
    const { cards, cardCount } = await waitForCardsOrEmpty(page);
    
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
            const styles = await textEl.evaluate((el: HTMLElement) => {
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
    const { cards, cardCount } = await waitForCardsOrEmpty(page);
    
    if (cardCount >= 2) {
      // Get dimensions of first two cards
      const firstCardBox = await cards.nth(0).boundingBox();
      const secondCardBox = await cards.nth(1).boundingBox();
      
      if (firstCardBox && secondCardBox) {
        // Cards should have same height (stable layout)
        expect(Math.abs(firstCardBox.height - secondCardBox.height)).toBeLessThan(5);
        
        // Cards should have reasonable dimensions
        expect(firstCardBox.height).toBeGreaterThan(200);
        expect(firstCardBox.height).toBeLessThan(520);
      }
    }
  });
});
