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
    const viewportWidth = (await page.viewportSize())?.width
    const isNarrow = typeof viewportWidth === 'number' && viewportWidth <= 560
    if (isNarrow) {
      // On narrow viewports, fullscreen overlay is rendered via portal
      const overlay = page.locator('[aria-label="Закрыть"]')
      await expect(overlay).toBeVisible({ timeout: 5_000 })
      await overlay.click()

      // After close, the fullscreen overlay should disappear
      await expect(overlay).not.toBeVisible({ timeout: 5_000 })
    } else {
      // Desktop popups use the shared card's accessible close control; Leaflet's
      // built-in close button is intentionally disabled to avoid duplicate controls.
      const closeBtn = popup.getByRole('button', { name: 'Закрыть попап', exact: true })
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

test.describe('Map page — iPhone bottom-card close regression', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  })

  test('one touch closes the card immediately and leaves the map interactive', async ({ page }) => {
    await preacceptCookies(page)
    await installTileMock(page)
    await page.addInitScript(() => {
      window.localStorage.setItem('metravel_map_onboarding_completed', 'true')
    })

    const imageBody = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8m2p8AAAAASUVORK5CYII=',
      'base64',
    )
    await page.route('https://images.example.test/e2e-popup.png', (route: any) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: imageBody }),
    )
    await page.route('**/api/filterformap/**', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          countries: [],
          categories: [],
          categoryTravelAddress: [],
          companions: [],
          complexity: [],
          month: [],
          over_nights_stay: [],
          transports: [],
          radius: [],
          year: '',
        }),
      }),
    )

    const mockPoint = {
      id: 90002,
      coord: '53.900600,27.559000',
      address: 'E2E iPhone close test point',
      travelImageThumbUrl: 'https://images.example.test/e2e-popup.png',
      travel_image_thumb_url: 'https://images.example.test/e2e-popup.png',
      categoryName: 'Тест',
      urlTravel: '/travels/e2e-iphone-close',
      articleUrl: '',
    }
    await page.route('**/api/travels/search_travels_for_map/**', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [mockPoint], total: 1 }),
      }),
    )
    await page.route('**/api/map/clusters/**', (route: any) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    )

    await gotoMapWithRecovery(page)
    await expect(page.getByTestId('map-mobile-layout')).toBeVisible({ timeout: 30_000 })

    const marker = page.locator('.metravel-pin-marker').first()
    await expect(marker).toBeVisible({ timeout: 30_000 })
    await marker.tap({ force: true })

    const card = page.getByTestId('map-place-bottom-card')
    const close = page.getByTestId('map-place-bottom-card-close')
    await expect(card).toBeVisible({ timeout: 10_000 })
    await expect(close).toBeVisible()

    // The second full-card blurred image was the large WebKit compositing layer
    // that could leave Leaflet frozen/partially unpainted after unmount.
    await expect(card.locator('[data-blur-backdrop="true"]')).toHaveCount(0)

    await page.evaluate(() => {
      ;(window as any).__unexpectedClickTargetsAfterCardClose = []
      document.addEventListener(
        'click',
        (event) => {
          const target = event.target as Element | null
          // The initiating compatibility click may still target the close button
          // while it exists. Any other target means WebKit retargeted the click to
          // the newly exposed map/control after the card unmounted.
          if (!target?.closest?.('[data-testid="map-place-bottom-card-close"]')) {
            const testIdTarget = target?.closest?.('[data-testid]')
            ;(window as any).__unexpectedClickTargetsAfterCardClose.push({
              tag: target?.tagName ?? null,
              testId: testIdTarget?.getAttribute('data-testid') ?? null,
            })
          }
        },
        false,
      )
    })

    const closeStartedAt = Date.now()
    await close.tap()
    await expect(card).toHaveCount(0, { timeout: 3_000 })
    expect(Date.now() - closeStartedAt).toBeLessThan(3_000)

    // Safari may dispatch a delayed compatibility click after touchend. It must
    // not leak through to Leaflet or any overlaid map control once the card has disappeared.
    await page.waitForTimeout(450)
    expect(
      await page.evaluate(() => (window as any).__unexpectedClickTargetsAfterCardClose),
    ).toEqual([])

    await expect(page.getByTestId('map-leaflet-wrapper')).toBeVisible()
    await marker.tap({ force: true })
    await expect(page.getByTestId('map-place-bottom-card')).toBeVisible({ timeout: 3_000 })
  })
})
