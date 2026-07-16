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
  await page.route('**/api/routing/route/**', async (route: any) => {
    const payload = route.request().postDataJSON()
    const points = Array.isArray(payload?.points) ? payload.points : []
    const geometry = points.map((point: any) => [Number(point.lng), Number(point.lat)])
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        geometry,
        distance_m: 11_400,
        duration_s: 1_620,
        provider: 'e2e',
      }),
    })
  })
}

async function seedMobileMapEnvironment(page: any) {
  await page.context().grantPermissions(['geolocation'])
  await page.context().setGeolocation({ latitude: 53.9006, longitude: 27.559, accuracy: 10 })
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('metravel_map_onboarding_completed', 'true')
    } catch {
      // noop
    }
  })
}

async function seedControllableLiveLocation(page: any) {
  await page.context().grantPermissions(['geolocation'])
  await page.context().setGeolocation({ latitude: 53.9006, longitude: 27.559, accuracy: 8 })
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('metravel_map_onboarding_completed', 'true')
    } catch {
      // noop
    }
  })
}

async function seedDeniedLocation(page: any) {
  await page.context().clearPermissions()
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('metravel_map_onboarding_completed', 'true')
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

    await test.step('Selected place offers a one-tap route from the trusted position', async () => {
      const marker = page.locator('.metravel-pin-marker').first()
      await expect(marker).toBeVisible({ timeout: 30_000 })
      await marker.click({ force: true })
      const cardAction = byTid(page, 'popup-primary-action')
      await expect(cardAction).toContainText('Маршрут от меня', { timeout: 15_000 })
      await cardAction.click({ force: true })
      await expect(byTid(page, 'map-mobile-route-summary')).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText('11.4 км', { exact: true })).toBeVisible()
      await expect(page.getByText('27 мин', { exact: true })).toBeVisible()
      await expect(page.getByText('2/2', { exact: true })).toBeVisible()
      await byTid(page, 'map-mobile-route-clear-button').click({ force: true })
      await expect(radiusBtn).toBeVisible({ timeout: 15_000 })
    })

    await test.step('Radius mode: route entry visible, contextual icons hidden', async () => {
      await expect(routeBtn).toBeVisible({ timeout: 30_000 })
      // toContainText, не toHaveText: рядом с подписью в кнопке живёт глиф
      // Feather-иконки — невидимый символ, но частью текста он остаётся.
      await expect(routeBtn).toContainText('Маршрут')
      await expect(radiusBtn).toBeVisible()
      await expect(transportBtn).toHaveCount(0)
      await expect(clearBtn).toHaveCount(0)
    })

    await test.step('Enter route mode → contextual icons + hint appear, radius hidden', async () => {
      // Без force: предыдущий шаг оставляет тост «Маршрут построен» (fixed,
      // z-index 99999) ровно над нижней полосой, где живёт FAB. force-клик ушёл
      // бы в тост; обычный клик ждёт, пока кнопка реально начнёт принимать
      // события — то же, что сделал бы пользователь.
      await routeBtn.click()
      await expect(transportBtn).toBeVisible({ timeout: 10_000 })
      await expect(clearBtn).toBeVisible()
      await expect(byTid(page, 'map-mobile-route-start-selector')).toBeVisible()
      await expect(byTid(page, 'map-mobile-route-start-user')).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      await expect(hint).toBeVisible()
      await expect(radiusBtn).toHaveCount(0)
    })

    await test.step('Start source switches directly between the map and current location', async () => {
      await byTid(page, 'map-mobile-route-start-map').click({ force: true })
      await expect(byTid(page, 'map-mobile-route-start-map')).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      await expect(page.getByText('0/2', { exact: true })).toBeVisible()
      await expect(
        page.getByText('Коснитесь карты, чтобы выбрать новый старт маршрута.', { exact: true }),
      ).toBeVisible()

      await byTid(page, 'map-mobile-route-start-user').click({ force: true })
      await expect(byTid(page, 'map-mobile-route-start-user')).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      await expect(page.getByText('1/2', { exact: true })).toBeVisible()
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

  test('denied location keeps fallback out of the route and offers a manual start', async ({ page }) => {
    await preacceptCookies(page)
    await seedDeniedLocation(page)
    await installTileMock(page)
    await installMapApiMocks(page)
    await gotoMobileMap(page)

    await expect(byTid(page, 'map-mobile-route-button')).toContainText('Маршрут')
    await byTid(page, 'map-mobile-route-button').click({ force: true })
    await expect(page.getByText('0/2', { exact: true })).toBeVisible()
    await expect(byTid(page, 'map-mobile-route-request-location')).toBeVisible()
    await expect(byTid(page, 'map-mobile-route-manual-start')).toBeVisible()
    await byTid(page, 'map-mobile-route-manual-start').click({ force: true })
    await expect(
      page.getByText('Коснитесь карты, чтобы выбрать новый старт маршрута.', { exact: true }),
    ).toBeVisible()
  })

  test('live marker follows, manual pan disables follow, and blur cleans up', async ({ page }) => {
    await preacceptCookies(page)
    await seedControllableLiveLocation(page)
    await installTileMock(page)
    await installMapApiMocks(page)
    await gotoMobileMap(page)

    const map = page.locator('.leaflet-container').first()
    const userMarker = page.locator('[aria-label="Вы здесь"]').first()
    await expect(userMarker).toBeVisible({ timeout: 30_000 })
    await map.evaluate((el: any) => {
      el.__liveLocationIdentity = 'same-map'
      const geolocation = navigator.geolocation as any
      const originalClearWatch = geolocation.clearWatch.bind(geolocation)
      ;(window as any).__metravelGeoClearCount = 0
      geolocation.clearWatch = (watchId: number) => {
        ;(window as any).__metravelGeoClearCount += 1
        originalClearWatch(watchId)
      }
    })

    await byTid(page, 'map-center-user-quick').click({ force: true })
    await page.waitForTimeout(300)
    const followedMarkerBox = await userMarker.boundingBox()
    expect(followedMarkerBox).toBeTruthy()
    await page.context().setGeolocation({ latitude: 53.9106, longitude: 27.569, accuracy: 7 })

    await expect.poll(async () => {
      const cached = await page.evaluate(() => {
        const raw = window.localStorage.getItem('metravel:lastKnownCoords')
        return raw ? JSON.parse(raw) : null
      })
      return Number(cached?.latitude)
    }).toBeCloseTo(53.9106, 4)
    await expect.poll(async () => {
      const markerBox = await userMarker.boundingBox()
      if (!markerBox || !followedMarkerBox) return 0
      return Math.hypot(markerBox.x - followedMarkerBox.x, markerBox.y - followedMarkerBox.y)
    }).toBeGreaterThan(50)
    expect(await map.evaluate((el: any) => el.__liveLocationIdentity)).toBe('same-map')

    // Let the programmatic follow animation settle before a genuine user drag.
    await page.waitForTimeout(800)
    const mapBox = await map.boundingBox()
    expect(mapBox).toBeTruthy()
    if (mapBox) {
      await page.mouse.move(mapBox.x + mapBox.width / 2, mapBox.y + mapBox.height / 2)
      await page.mouse.down()
      await page.mouse.move(mapBox.x + mapBox.width / 2 + 120, mapBox.y + mapBox.height / 2)
      await page.mouse.up()
    }
    await page.waitForTimeout(300)
    const pannedMarkerBox = await userMarker.boundingBox()
    expect(pannedMarkerBox).toBeTruthy()
    if (pannedMarkerBox && followedMarkerBox) {
      expect(Math.abs(pannedMarkerBox.x - followedMarkerBox.x)).toBeGreaterThan(50)
    }
    await page.context().setGeolocation({ latitude: 53.9111, longitude: 27.5695, accuracy: 7 })
    await expect.poll(async () => {
      const cached = await page.evaluate(() => {
        const raw = window.localStorage.getItem('metravel:lastKnownCoords')
        return raw ? JSON.parse(raw) : null
      })
      return Number(cached?.latitude)
    }).toBeCloseTo(53.9111, 4)
    await expect.poll(async () => {
      const markerBox = await userMarker.boundingBox()
      if (!markerBox || !pannedMarkerBox) return 999
      return Math.hypot(markerBox.x - pannedMarkerBox.x, markerBox.y - pannedMarkerBox.y)
    }).toBeLessThan(40)

    await page.context().clearPermissions()
    await expect(page.getByText('Обновляем местоположение…', { exact: true })).toBeVisible()
    await expect(userMarker).toBeVisible()

    await page.getByTestId('footer-item-home').click({ force: true })
    await expect.poll(() => page.evaluate(() => (window as any).__metravelGeoClearCount)).toBeGreaterThan(0)
  })
})
