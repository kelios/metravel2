import { test, expect } from './fixtures';
import { preacceptCookies, openFallbackTravelDetails } from './helpers/navigation';

/**
 * Share affordances on the travel detail page (ShareButtons, mounted in the
 * footer section). Previously untested. Uses the deterministic fallback travel
 * so the test does not depend on a live backend.
 */
test.describe('Travel detail — share', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('share panel exposes social + copy actions', async ({ page }) => {
    await preacceptCookies(page);
    expect(await openFallbackTravelDetails(page)).toBe(true);

    // The share panel lives in the footer section — scroll it into view so the
    // deferred section mounts.
    const scroll = page.locator('[data-testid="travel-details-scroll"]');
    await expect(scroll).toBeVisible();
    await scroll.evaluate((node: HTMLElement) => {
      node.scrollTop = node.scrollHeight;
      node.dispatchEvent(new Event('scroll', { bubbles: true }));
    });

    const sharePanel = page.getByRole('region', { name: 'Поделиться маршрутом' });
    await expect(sharePanel).toBeVisible({ timeout: 20_000 });
    await expect(sharePanel.getByLabel('Поделиться в Telegram')).toBeVisible();
    await expect(page.getByLabel('Поделиться во ВКонтакте').first()).toBeVisible();
    await expect(page.getByLabel('Поделиться в WhatsApp').first()).toBeVisible();
    await expect(page.getByLabel('Копировать ссылку').first()).toBeVisible();
  });
});
