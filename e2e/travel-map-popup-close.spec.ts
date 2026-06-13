/**
 * E2E: Попапы карты на странице путешествия — открытие и закрытие
 *
 * Проверяет, что на мобильном и десктопном вебе попапы маркеров карты
 * корректно открываются и закрываются, включая fullscreen overlay на узких экранах.
 */

import { test, expect } from './fixtures'
import { preacceptCookies, navigateToFirstTravel, openFallbackTravelDetails } from './helpers/navigation'

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
  const detailsRoot = page.locator('[data-testid="travel-details-page"], [testID="travel-details-page"]').first()
  const mapTab = detailsRoot.getByRole('tab', { name: /Карта/i }).first()
  if (await mapTab.isVisible().catch(() => false)) {
    await mapTab.click().catch(() => null)
  }
  const mapNavButton = detailsRoot
    .getByRole('button', { name: /Карта маршрута|разделу Карта/i })
    .first()
  if (await mapNavButton.isVisible().catch(() => false)) {
    await mapNavButton.click().catch(() => null)
  }

  const mapSection = page.locator('[data-testid="travel-details-map"], [testID="travel-details-map"]').first()
  const scrollContainer = page.locator('[data-testid="travel-details-scroll"], [testID="travel-details-scroll"]').first()

  // Scroll until the map container or a Leaflet marker appears
  for (let i = 0; i < 15; i++) {
    const markerCount = await page.locator('.leaflet-marker-icon').count()
    if (markerCount > 0) return true

    if (await mapSection.isVisible().catch(() => false)) {
      await mapSection.scrollIntoViewIfNeeded().catch(() => null)
    }

    if (await scrollContainer.isVisible().catch(() => false)) {
      await scrollContainer.evaluate((node: Element) => {
        const element = node as HTMLElement
        element.scrollTop += 700
        element.dispatchEvent(new Event('scroll', { bubbles: true }))
      }).catch(() => null)
    } else {
      await page.evaluate(() => window.scrollBy(0, 600))
    }
    await page.waitForTimeout(500)
  }

  // Final check
  return (await page.locator('.leaflet-marker-icon').count()) > 0
}

async function tapMobileMarker(
  marker: import('@playwright/test').Locator,
  page: import('@playwright/test').Page,
) {
  const closeBtn = page.locator('button[aria-label="Закрыть"]')
  const attempts = [
    () => marker.tap({ force: true }),
    () => marker.click({ force: true }),
    () => marker.dispatchEvent('click'),
  ]

  for (const attempt of attempts) {
    await marker.scrollIntoViewIfNeeded().catch(() => null)
    await attempt().catch(() => null)

    const opened = await closeBtn
      .waitFor({ state: 'visible', timeout: 2_000 })
      .then(() => true)
      .catch(() => false)

    if (opened) return
  }

}

async function openDesktopPopup(page: import('@playwright/test').Page) {
  const popup = page.locator('.leaflet-popup')
  const markers = page.locator('.leaflet-marker-icon')
  const attempts = Math.min(await markers.count(), 4)

  for (let index = 0; index < attempts; index += 1) {
    const marker = markers.nth(index)
    await marker.scrollIntoViewIfNeeded().catch(() => null)

    await marker.click({ force: true }).catch(() => null)
    const clickedOpen = await popup
      .waitFor({ state: 'visible', timeout: 1_500 })
      .then(() => true)
      .catch(() => false)

    if (clickedOpen) return popup

    await marker.dispatchEvent('click').catch(() => null)
    const dispatchedOpen = await popup
      .waitFor({ state: 'visible', timeout: 1_500 })
      .then(() => true)
      .catch(() => false)

    if (dispatchedOpen) return popup
  }

  return popup
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

      // Navigate to a stable travel detail page with deterministic map markers.
      const navigated = await openFallbackTravelDetails(page)
      expect(navigated, 'No travel cards available').toBe(true)

      // Scroll down to the map section
      const hasMarkers = await scrollToMapAndWaitForMarkers(page)
      expect(hasMarkers, 'No map markers found on travel detail page').toBe(true)

      // Click the first marker
      const marker = page.locator('.leaflet-marker-icon').first()
      await tapMobileMarker(marker, page)

      // On mobile web, the card is promoted to a fullscreen overlay portal.
      const overlay = page.locator(
        'body > div[style*="position: fixed"][style*="z-index: 99990"]',
      )
      await expect(overlay).toBeVisible({ timeout: 10_000 })
      const closeBtn = overlay.locator('button[aria-label="Закрыть"]')
      await expect(closeBtn).toBeVisible({ timeout: 5_000 })

      // Close the popup via the close button
      await closeBtn.click()

      // The fullscreen overlay should disappear.
      await expect(overlay).not.toBeVisible({ timeout: 5_000 })

      // Verify the map is still interactive after closing. Re-open a different
      // marker because Leaflet keeps the just-closed marker in an internal
      // "already opened" state under mobile emulation.
      const reopenMarker = (await page.locator('.leaflet-marker-icon').count()) > 1
        ? page.locator('.leaflet-marker-icon').nth(1)
        : marker
      await tapMobileMarker(reopenMarker, page)
      await expect(overlay).toBeVisible({ timeout: 10_000 })
      await expect(closeBtn).toBeVisible({ timeout: 5_000 })

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
    expect(navigated, 'No travel cards available').toBe(true)

    const hasMarkers = await scrollToMapAndWaitForMarkers(page)
    expect(hasMarkers, 'No map markers found on travel detail page').toBe(true)

    const popup = await openDesktopPopup(page)
    await expect(popup).toBeVisible({ timeout: 20_000 })

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

      const navigated = await openFallbackTravelDetails(page)
      expect(navigated, 'No travel cards available').toBe(true)

      const hasMarkers = await scrollToMapAndWaitForMarkers(page)
      expect(hasMarkers, 'No map markers found on travel detail page').toBe(true)

      // Open and close multiple markers to catch portal leaks
      const markerCount = await page.locator('.leaflet-marker-icon').count()
      const markersToTest = Math.min(markerCount, 3)

      for (let i = 0; i < markersToTest; i++) {
        const m = page.locator('.leaflet-marker-icon').nth(i)

        // Scroll marker into view
        await tapMobileMarker(m, page)

        const overlay = page.locator(
          'body > div[style*="position: fixed"][style*="z-index: 99990"]',
        )
        await expect(overlay).toBeVisible({ timeout: 10_000 })
        const closeBtn = overlay.locator('button[aria-label="Закрыть"]')
        await expect(closeBtn).toBeVisible({ timeout: 10_000 })

        await closeBtn.click()

        // Verify the fullscreen overlay is gone.
        await expect(overlay).not.toBeVisible({ timeout: 5_000 })
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
