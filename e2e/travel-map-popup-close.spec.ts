/**
 * E2E: Попапы карты на странице путешествия — открытие и закрытие
 *
 * Проверяет, что на мобильном и десктопном вебе попапы маркеров карты
 * корректно открываются и закрываются, включая fullscreen overlay на узких экранах.
 */

import { test, expect } from './fixtures'
import { preacceptCookies, navigateToFirstTravel } from './helpers/navigation'

/** Mock tile requests with 1×1 transparent PNG to speed up tests */
async function installTileMock(page: import('@playwright/test').Page) {
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8m2p8AAAAASUVORK5CYII='
  const png = Buffer.from(pngBase64, 'base64')
  const fulfill = (route: any) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: png })

  await page.route('**://*.basemaps.cartocdn.com/**', fulfill)
  await page.route('**://tile.openstreetmap.org/**', fulfill)
  await page.route('**://*.tile.openstreetmap.org/**', fulfill)
}

/** Scroll the travel detail page down to the map section and wait for markers */
async function scrollToMapAndWaitForMarkers(page: import('@playwright/test').Page) {
  // Scroll until the map container or a Leaflet marker appears
  for (let i = 0; i < 15; i++) {
    const markerCount = await page.locator('.leaflet-marker-icon').count()
    if (markerCount > 0) return true

    await page.evaluate(() => window.scrollBy(0, 600))
    await page.waitForTimeout(500)
  }

  // Final check
  return (await page.locator('.leaflet-marker-icon').count()) > 0
}

test.describe('Travel detail page — map popup close @smoke', () => {
  test('mobile: fullscreen popup overlay opens and closes on marker tap', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      storageState: 'e2e/.auth/storageState.json',
    })
    const page = await context.newPage()

    try {
      await preacceptCookies(page)
      await installTileMock(page)

      // Navigate to a real travel detail page
      const navigated = await navigateToFirstTravel(page)
      if (!navigated) {
        test.skip(true, 'No travel cards available')
        return
      }

      // Scroll down to the map section
      const hasMarkers = await scrollToMapAndWaitForMarkers(page)
      if (!hasMarkers) {
        test.skip(true, 'No map markers found on travel detail page')
        return
      }

      // Click the first marker
      const marker = page.locator('.leaflet-marker-icon').first()
      await marker.click()

      // On mobile (390px < 560px), fullscreen overlay should appear via portal
      const closeBtn = page.locator('button[aria-label="Закрыть"]')
      await expect(closeBtn).toBeVisible({ timeout: 10_000 })

      // Verify the fullscreen overlay is actually covering the screen
      const overlay = page.locator('body > div[style*="position: fixed"][style*="inset"]')
      await expect(overlay).toBeVisible({ timeout: 5_000 })

      // Close the popup via the close button
      await closeBtn.click()

      // The fullscreen overlay should disappear
      await expect(overlay).not.toBeVisible({ timeout: 5_000 })

      // No stuck fullscreen overlays on the page
      const stuckOverlays = page.locator(
        'body > div[style*="position: fixed"][style*="inset: 0"]',
      )
      await expect(stuckOverlays).toHaveCount(0, { timeout: 3_000 })

      // Verify the map is still interactive — click marker again
      await marker.click()
      await expect(closeBtn).toBeVisible({ timeout: 10_000 })

      // Close again to confirm repeatability
      await closeBtn.click()
      await expect(overlay).not.toBeVisible({ timeout: 5_000 })
    } finally {
      await context.close()
    }
  })

  test('desktop: leaflet popup opens and closes via close button', async ({ page }) => {
    await preacceptCookies(page)
    await installTileMock(page)

    const navigated = await navigateToFirstTravel(page)
    if (!navigated) {
      test.skip(true, 'No travel cards available')
      return
    }

    const hasMarkers = await scrollToMapAndWaitForMarkers(page)
    if (!hasMarkers) {
      test.skip(true, 'No map markers found on travel detail page')
      return
    }

    // Click the first marker
    const marker = page.locator('.leaflet-marker-icon').first()
    await marker.click()

    // Leaflet popup should appear
    const popup = page.locator('.leaflet-popup')
    await expect(popup).toBeVisible({ timeout: 10_000 })

    // Close via Leaflet's built-in close button
    const leafletClose = page.locator('.leaflet-popup-close-button')
    await expect(leafletClose).toBeVisible({ timeout: 5_000 })
    await leafletClose.click()

    // Popup should disappear
    await expect(popup).not.toBeVisible({ timeout: 5_000 })

    // No stuck fullscreen overlays
    const stuckOverlays = page.locator(
      'body > div[style*="position: fixed"][style*="inset: 0"]',
    )
    await expect(stuckOverlays).toHaveCount(0, { timeout: 3_000 })
  })

  test('mobile: popup closes and does not leave orphan portal', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 667 },
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      storageState: 'e2e/.auth/storageState.json',
    })
    const page = await context.newPage()

    try {
      await preacceptCookies(page)
      await installTileMock(page)

      const navigated = await navigateToFirstTravel(page)
      if (!navigated) {
        test.skip(true, 'No travel cards available')
        return
      }

      const hasMarkers = await scrollToMapAndWaitForMarkers(page)
      if (!hasMarkers) {
        test.skip(true, 'No map markers found on travel detail page')
        return
      }

      // Open and close multiple markers to catch portal leaks
      const markerCount = await page.locator('.leaflet-marker-icon').count()
      const markersToTest = Math.min(markerCount, 3)

      for (let i = 0; i < markersToTest; i++) {
        const m = page.locator('.leaflet-marker-icon').nth(i)

        // Scroll marker into view
        await m.scrollIntoViewIfNeeded()
        await m.click()

        const closeBtn = page.locator('button[aria-label="Закрыть"]')
        await expect(closeBtn).toBeVisible({ timeout: 10_000 })

        await closeBtn.click()

        // Verify overlay is gone
        const fixedOverlays = page.locator(
          'body > div[style*="position: fixed"][style*="inset: 0"]',
        )
        await expect(fixedOverlays).toHaveCount(0, { timeout: 5_000 })
      }

      // Final sanity: no orphan portals left
      const orphans = await page.evaluate(() => {
        return document.querySelectorAll(
          'body > div[style*="position: fixed"][style*="z-index: 10000"]',
        ).length
      })
      expect(orphans).toBe(0)
    } finally {
      await context.close()
    }
  })
})

