import { test, expect } from './fixtures';
import { preacceptCookies } from './helpers/navigation';

test.describe('Leaflet CSS', () => {
  test('Leaflet core CSS is applied on /map (pane z-index + attribution)', async ({ page }) => {
    await preacceptCookies(page);

    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    const mapWrapper = page.locator('[data-testid="map-leaflet-wrapper"]').first();
    await expect(mapWrapper).toBeVisible({ timeout: 15_000 });

    const leafletContainer = page.locator('.leaflet-container').first();
    await expect(leafletContainer).toBeVisible({ timeout: 15_000 });

    // Ensure Leaflet CSS is actually loaded (CDN link injected in app layout).
    const cssHref = await page.evaluate(() => {
      const link = document.querySelector('link[data-metravel-leaflet-css="cdn"]') as HTMLLinkElement | null;
      return link?.href ?? null;
    });
    expect(cssHref).toContain('leaflet');

    // Leaflet core CSS sets base pane z-index to 400.
    const zIndex = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.className = 'leaflet-pane';
      document.body.appendChild(probe);
      const z = window.getComputedStyle(probe).zIndex;
      probe.remove();
      return z;
    });
    expect(zIndex).toBe('400');

    // Ensure attribution control exists (should render as "Leaflet | © OpenStreetMap contributors").
    const attribution = page.locator('.leaflet-control-attribution').first();
    await expect(attribution).toBeVisible({ timeout: 15_000 });
    await expect(attribution).toContainText(/Leaflet/i);
    await expect(attribution).toContainText(/OpenStreetMap/i);
  });
});
