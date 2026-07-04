import { test, expect } from './fixtures'
import { gotoWithRetry, preacceptCookies } from './helpers/navigation'

const MOBILE = { width: 390, height: 844 }

const MOCK_POINTS = [
  {
    id: 31001,
    coord: '53.900600,27.559000',
    address: 'Минск, Верхний город',
    categoryName: 'Замки',
    travelImageThumbUrl: 'https://metravelprod.s3.eu-north-1.amazonaws.com/travel-image/upper.jpg',
    articleUrl: '/travels/mock-upper-town',
    urlTravel: '/travels/mock-upper-town',
  },
]

async function installTileMock(page: any) {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8m2p8AAAAASUVORK5CYII=',
    'base64',
  )
  const routeTile = (route: any) => route.fulfill({ status: 200, contentType: 'image/png', body: png })
  await page.route('**/proxy/tiles/osm/**', routeTile)
  await page.route('**://*.tile.openstreetmap.org/**', routeTile)
  await page.route('**://tile.openstreetmap.org/**', routeTile)
}

async function installApiMocks(page: any) {
  await page.route('**/api/filterformap/**', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        countries: [], categories: [],
        categoryTravelAddress: [{ id: 'castles', name: 'Замки' }],
        companions: [], complexity: [], month: [], over_nights_stay: [], transports: [],
        radius: [{ id: '5', name: '5' }, { id: '60', name: '60' }], year: '',
      }),
    }),
  )
  await page.route('**/api/travels/search_travels_for_map/**', (route: any) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_POINTS) }),
  )
  await page.route('**/api/travels/near-route/**', (route: any) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_POINTS) }),
  )
}

async function seedEnv(page: any) {
  await page.addInitScript(() => {
    try { window.localStorage.setItem('metravel_map_onboarding_completed', 'true') } catch { /* noop */ }
    try {
      const coords = { latitude: 53.9006, longitude: 27.559, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null }
      const makePosition = () => ({ coords, timestamp: Date.now() })
      ;(navigator as any).geolocation = {
        getCurrentPosition: (s: any) => s(makePosition()),
        watchPosition: (s: any) => { s(makePosition()); return 1 },
        clearWatch: () => undefined,
      }
    } catch { /* noop */ }
  })
}

test.describe('dark', () => {
  test.use({ colorScheme: 'dark' })
  test('@parity map toolbar dark', async ({ page }) => {
    test.setTimeout(180_000)
    await preacceptCookies(page)
    await seedEnv(page)
    await installTileMock(page)
    await installApiMocks(page)
    await page.setViewportSize(MOBILE)
    await gotoWithRetry(page, '/map')
    await expect(page.getByTestId('map-mobile-layout')).toBeVisible({ timeout: 60_000 })
    await page.waitForTimeout(2500)
    await page.screenshot({ path: 'e2e/__screenshots__/parity-web-map-toolbar-dark.png' })
  })
})

test('@parity desktop map popup no-regression', async ({ page }) => {
  test.setTimeout(180_000)
  await preacceptCookies(page)
  await seedEnv(page)
  await installTileMock(page)
  await installApiMocks(page)
  await page.setViewportSize({ width: 1280, height: 900 })
  await gotoWithRetry(page, '/map')
  await page.waitForTimeout(3000)
  const marker = page.locator('.leaflet-marker-icon').first()
  await expect(marker).toBeVisible({ timeout: 40_000 })
  await marker.click({ force: true })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'e2e/__screenshots__/parity-web-map-popup-desktop.png' })
  const info = await page.evaluate(() =>
    JSON.stringify({ body: (document.body.innerText || '').replace(/\n+/g, ' | ').slice(0, 300) }),
  )
  console.log('DESKTOP_INFO', info)
})

test('@parity map marker popup screenshot', async ({ page }) => {
  test.setTimeout(180_000)
  await preacceptCookies(page)
  await seedEnv(page)
  await installTileMock(page)
  await installApiMocks(page)
  await page.setViewportSize(MOBILE)
  await gotoWithRetry(page, '/map')
  await expect(page.getByTestId('map-mobile-layout')).toBeVisible({ timeout: 60_000 })

  // full map (toolbar) screenshot
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'e2e/__screenshots__/parity-web-map-toolbar.png' })

  // click a marker to open the point popup
  const marker = page.locator('.leaflet-marker-icon').first()
  await expect(marker).toBeVisible({ timeout: 30_000 })
  await marker.click({ force: true })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'e2e/__screenshots__/parity-web-map-popup.png' })

  // open secondary navigation — should open ActionListSheet (not inline grid)
  const navBtn = page
    .getByRole('button', { name: /Навигац|Ещё|действ/i })
    .last()
  if (await navBtn.isVisible().catch(() => false)) {
    await navBtn.click({ force: true }).catch(() => undefined)
    await page.waitForTimeout(1200)
    await page.screenshot({ path: 'e2e/__screenshots__/parity-web-map-navsheet.png' })
  }

  const info = await page.evaluate(() => {
    const txt = (document.body.innerText || '').replace(/\n+/g, ' | ').slice(0, 500)
    const has = (re: RegExp) => re.test(txt)
    return JSON.stringify({
      markers: document.querySelectorAll('.leaflet-marker-icon').length,
      navSheetMaps: {
        google: has(/Google Maps/i), waze: has(/Waze/i), yandex: has(/Яндекс/i), osm: has(/OpenStreetMap contributors/i) ? 'attribution' : has(/OpenStreetMap/i),
      },
      body: txt,
    })
  })
  console.log('POPUP_INFO', info)
})
