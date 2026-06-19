import { test, expect } from './fixtures'
import { preacceptCookies } from './helpers/navigation'

/**
 * Installs a route handler that serves a 1×1 transparent PNG for all tile requests,
 * preventing real network fetches and speeding up the test.
 */
async function installTileMock(page: any) {
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8m2p8AAAAASUVORK5CYII='
  const png = Buffer.from(pngBase64, 'base64')

  const fulfill = (route: any) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: png })

  await page.route('**://*.basemaps.cartocdn.com/**', fulfill)
  await page.route('**://tile.openstreetmap.org/**', fulfill)
  await page.route('**://*.tile.openstreetmap.org/**', fulfill)
  await page.route('**/proxy/tiles/osm/**', fulfill)
}

async function gotoMapWithRecovery(page: any) {
  const mapWrapper = page.getByTestId('map-leaflet-wrapper')
  const notFoundTitle = page.getByText('Страница не найдена', { exact: true })
  const plainNotFound = page.getByText('Not found', { exact: true })

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const url = attempt % 2 === 0 ? '/map' : `/map?e2eRetry=${attempt}`
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })

    const appeared = await mapWrapper.isVisible({ timeout: 5_000 }).catch(() => false)
    if (appeared) return

    const hasNotFound =
      (await notFoundTitle.isVisible().catch(() => false)) ||
      (await plainNotFound.isVisible().catch(() => false))
    if (!hasNotFound) {
      await mapWrapper.waitFor({ state: 'visible', timeout: 30_000 })
      return
    }
  }

  throw new Error(`Map route resolved to Not found after retry (url=${page.url()})`)
}

test.describe('Map page — popup open / close', () => {
  test('marker popup opens on click and closes via close button', async ({ page }) => {
    await preacceptCookies(page)
    await installTileMock(page)

    // Mock the filters API so category dictionary loads instantly
    await page.route('**/api/filterformap/**', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ categoryTravelAddress: [] }),
      }),
    )

    // Mock the travel points API to return a single known point
    const mockPoint = {
      id: 90001,
      coord: '53.900000,27.560000',
      address: 'E2E Popup Test Point',
      travelImageThumbUrl: '',
      travel_image_thumb_url: '',
      categoryName: 'Тест',
      urlTravel: '',
      articleUrl: '',
    }

    await page.route('**/api/travels/search_travels_for_map/**', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockPoint]),
      }),
    )

    await gotoMapWithRecovery(page)

    // Wait for the map wrapper to appear
    const mapWrapper = page.getByTestId('map-leaflet-wrapper')
    await mapWrapper.waitFor({ state: 'visible', timeout: 30_000 })

    // Wait for Leaflet to initialize and marker to appear
    await page.waitForSelector('.metravel-pin-marker', { state: 'visible', timeout: 30_000 })

    // Click the first marker to open popup
    const marker = page.locator('.metravel-pin-marker').first()
    await marker.click({ force: true })

    // The popup should appear (Leaflet popup wrapper becomes visible)
    const popup = page.locator('.leaflet-popup')
    await popup.waitFor({ state: 'visible', timeout: 10_000 })

    // Also check for fullscreen overlay on narrow viewports
    const isNarrow = (await page.viewportSize())?.width <= 560
    if (isNarrow) {
      // On narrow viewports, fullscreen overlay is rendered via portal
      const overlay = page.locator('[aria-label="Закрыть"]')
      await expect(overlay).toBeVisible({ timeout: 5_000 })
      await overlay.click()

      // After close, the fullscreen overlay should disappear
      await expect(overlay).not.toBeVisible({ timeout: 5_000 })
    } else {
      // On desktop, use the Leaflet close button
      const closeBtn = page.locator('.leaflet-popup-close-button')
      await expect(closeBtn).toBeVisible({ timeout: 5_000 })
      await closeBtn.click()

      // Popup should disappear
      await expect(popup).not.toBeVisible({ timeout: 5_000 })
    }

    // Verify no fullscreen overlay is stuck on body
    const stuckOverlay = page.locator('body > div[style*="position: fixed"][style*="inset: 0"]')
    await expect(stuckOverlay).toHaveCount(0, { timeout: 3_000 })
  })
})
