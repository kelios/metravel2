import { test, expect } from './fixtures'
import { gotoWithRetry, preacceptCookies } from './helpers/navigation'

const MOBILE_VIEWPORT = { width: 390, height: 844 }

const MOCK_POINTS = [
  {
    id: 32001,
    coord: '53.900600,27.559000',
    address: 'Минск, Верхний город',
    categoryName: 'Замки',
    travelImageThumbUrl: '',
    articleUrl: '',
    urlTravel: '/travels/mock-upper-town',
  },
  {
    id: 32002,
    coord: '53.915400,27.546100',
    address: 'Минск, Комсомольское озеро',
    categoryName: 'Озёра',
    travelImageThumbUrl: '',
    articleUrl: '',
    urlTravel: '/travels/mock-lake',
  },
]

async function installTileMock(page: any) {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8m2p8AAAAASUVORK5CYII=',
    'base64',
  )
  const routeTile = async (route: any) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: png })
  await page.route('**://tile.openstreetmap.org/**', routeTile)
  await page.route('**://*.tile.openstreetmap.org/**', routeTile)
  await page.route('**/proxy/tiles/osm/**', routeTile)
}

async function installMapApiMocks(page: any) {
  await page.route('**/api/filterformap/**', async (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        countries: [],
        categories: [],
        categoryTravelAddress: [{ id: 'castles', name: 'Замки' }],
        companions: [],
        complexity: [],
        month: [],
        over_nights_stay: [],
        transports: [],
        radius: [
          { id: '5', name: '5' },
          { id: '30', name: '30' },
          { id: '60', name: '60' },
        ],
        year: '',
      }),
    }),
  )
  await page.route('**/api/travels/search_travels_for_map/**', async (route: any) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_POINTS) }),
  )
  await page.route('**/api/travels/near-route/**', async (route: any) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
  )
}

async function seedMobileMapEnvironment(page: any) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('metravel_map_onboarding_completed', 'true')
    } catch {
      // noop
    }
    try {
      const coords = {
        latitude: 53.9006,
        longitude: 27.559,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      }
      const makePosition = () => ({ coords, timestamp: Date.now() })
      ;(navigator as any).geolocation = {
        getCurrentPosition: (success: any) => success(makePosition()),
        watchPosition: (success: any) => {
          success(makePosition())
          return 1
        },
        clearWatch: () => undefined,
      }
    } catch {
      // noop
    }
  })
}

async function gotoMobileMap(page: any) {
  await page.setViewportSize(MOBILE_VIEWPORT)
  await gotoWithRetry(page, '/map')
  const homeHeadline = page.getByText('Пиши о своих путешествиях', { exact: true })
  if (await homeHeadline.isVisible().catch(() => false)) {
    const mapFooterItem = page.getByTestId('footer-item-map')
    if (await mapFooterItem.isVisible().catch(() => false)) {
      await mapFooterItem.click({ force: true })
    }
  }
  await page.waitForURL(/\/map(\?|$)/, { timeout: 30_000 }).catch(() => null)
  await expect(page.getByTestId('map-mobile-layout')).toBeVisible({ timeout: 60_000 })
}

function byTid(page: any, id: string) {
  return page.locator(`[data-testid="${id}"], [testID="${id}"]`).first()
}

test.describe('@smoke mobile map route toolbar (#597)', () => {
  test('enter route mode, switch transport, clear back to radius', async ({ page }) => {
    test.setTimeout(240_000)

    await preacceptCookies(page)
    await seedMobileMapEnvironment(page)
    await installTileMock(page)
    await installMapApiMocks(page)
    await gotoMobileMap(page)

    const routeBtn = byTid(page, 'map-mobile-route-button')
    const transportBtn = byTid(page, 'map-mobile-transport-button')
    const clearBtn = byTid(page, 'map-mobile-route-clear-button')
    const radiusBtn = byTid(page, 'map-mobile-radius-button')
    const hint = byTid(page, 'map-mobile-route-hint')

    await test.step('Radius mode: route entry visible, contextual icons hidden', async () => {
      await expect(routeBtn).toBeVisible({ timeout: 30_000 })
      await expect(radiusBtn).toBeVisible()
      await expect(transportBtn).toHaveCount(0)
      await expect(clearBtn).toHaveCount(0)
    })

    await test.step('Enter route mode → contextual icons + hint appear, radius hidden', async () => {
      await routeBtn.click({ force: true })
      await expect(transportBtn).toBeVisible({ timeout: 10_000 })
      await expect(clearBtn).toBeVisible()
      await expect(hint).toBeVisible()
      await expect(radiusBtn).toHaveCount(0)
    })

    await test.step('Transport popover switches profile to bike', async () => {
      await transportBtn.click({ force: true })
      const bikeOption = byTid(page, 'map-mobile-transport-option-bike')
      await expect(bikeOption).toBeVisible({ timeout: 10_000 })
      await bikeOption.click({ force: true })
      // Reopen — bike must now be the checked option (transportMode applied).
      await transportBtn.click({ force: true })
      await expect(byTid(page, 'map-mobile-transport-option-bike')).toHaveAttribute(
        'aria-checked',
        'true',
      )
      // Close the popover by toggling the transport button again, then wait for
      // it to fully unmount so its full-screen catcher can't intercept the next
      // toolbar tap.
      await transportBtn.click({ force: true })
      await expect(byTid(page, 'map-mobile-transport-popover')).toHaveCount(0, { timeout: 10_000 })
    })

    await test.step('Toolbar stays a single row ≤20% of viewport height', async () => {
      const overlay = byTid(page, 'map-mobile-top-overlay')
      const box = await overlay.boundingBox()
      // The overlay root is full-height (box-none); assert the icon row itself is
      // a single compact band by checking route + list buttons share a row top.
      const routeBox = await routeBtn.boundingBox()
      const listBox = await byTid(page, 'map-mobile-open-list').boundingBox()
      expect(routeBox && listBox).toBeTruthy()
      if (routeBox && listBox) {
        expect(Math.abs(routeBox.y - listBox.y)).toBeLessThan(8)
      }
      // Buttons live well within the top 20% (≈168px) of an 844px viewport.
      if (routeBox) expect(routeBox.y + routeBox.height).toBeLessThan(844 * 0.2)
      expect(box).toBeTruthy()
    })

    await test.step('Clear route returns to radius mode', async () => {
      await clearBtn.click({ force: true })
      // Radius button re-appears once mode flips back to 'radius'.
      await expect(radiusBtn).toBeVisible({ timeout: 15_000 })
      // Contextual route icons unmount (auto-retried until the re-render settles).
      await expect(transportBtn).toHaveCount(0, { timeout: 15_000 })
      await expect(clearBtn).toHaveCount(0, { timeout: 15_000 })
    })
  })
})
