import { test, expect } from './fixtures'
import { installNoConsoleErrorsGuard } from './helpers/consoleGuards'
import { gotoWithRetry, preacceptCookies } from './helpers/navigation'

const MOBILE_VIEWPORT = { width: 390, height: 844 }
const MOBILE_PANEL_ENTRY_SELECTOR = [
  '[data-testid="map-open-list"]',
  '[testID="map-open-list"]',
  '[data-testid="map-panel-open"]',
  '[testID="map-panel-open"]',
  '[data-testid="map-peek-expand"]',
  '[testID="map-peek-expand"]',
  'button[aria-label="Открыть панель со списком"]',
].join(', ')

const MOCK_POINTS = [
  {
    id: 31001,
    coord: '53.900600,27.559000',
    address: 'Минск, Верхний город',
    categoryName: 'Замки',
    travelImageThumbUrl: '',
    articleUrl: '',
    urlTravel: '/travels/mock-upper-town',
  },
  {
    id: 31002,
    coord: '53.915400,27.546100',
    address: 'Минск, Комсомольское озеро',
    categoryName: 'Озёра',
    travelImageThumbUrl: '',
    articleUrl: '',
    urlTravel: '/travels/mock-lake',
  },
  {
    id: 31003,
    coord: '53.886200,27.531500',
    address: 'Минск, Лошицкий парк',
    categoryName: 'Парки',
    travelImageThumbUrl: '',
    articleUrl: '',
    urlTravel: '/travels/mock-park',
  },
]

async function installTileMock(page: any) {
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8m2p8AAAAASUVORK5CYII='
  const png = Buffer.from(pngBase64, 'base64')

  const routeTile = async (route: any) => {
    return route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: png,
    })
  }

  await page.route('**://tile.openstreetmap.org/**', routeTile)
  await page.route('**://*.tile.openstreetmap.org/**', routeTile)
  await page.route('**://*.tile.openstreetmap.fr/**', routeTile)
  await page.route('**://*.tile.openstreetmap.de/**', routeTile)
  await page.route('**://tile.waymarkedtrails.org/**', routeTile)
  await page.route('**://*.tile.waymarkedtrails.org/**', routeTile)
}

async function installMapApiMocks(page: any) {
  await page.route('**/api/filterformap/**', async (route: any) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        countries: [],
        categories: [],
        categoryTravelAddress: [
          { id: 'castles', name: 'Замки' },
          { id: 'lakes', name: 'Озёра' },
          { id: 'parks', name: 'Парки' },
        ],
        companions: [],
        complexity: [],
        month: [],
        over_nights_stay: [],
        transports: [],
        radius: [
          { id: '5', name: '5' },
          { id: '15', name: '15' },
          { id: '30', name: '30' },
          { id: '60', name: '60' },
        ],
        year: '',
      }),
    })
  })

  await page.route('**/api/travels/search_travels_for_map/**', async (route: any) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_POINTS),
    })
  })

  await page.route('**/api/travels/near-route/**', async (route: any) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_POINTS.slice(0, 2)),
    })
  })
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

      const makePosition = () => ({
        coords,
        timestamp: Date.now(),
      })

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

  const homeHeadline = page.getByText('Пиши о своих путешествиях', {
    exact: true,
  })
  if (await homeHeadline.isVisible().catch(() => false)) {
    const mapFooterItem = page.getByTestId('footer-item-map')
    if (await mapFooterItem.isVisible().catch(() => false)) {
      await mapFooterItem.click({ force: true })
    }
  }

  await page.waitForURL(/\/map(\?|$)/, { timeout: 30_000 }).catch(() => null)
  await expect(page.getByTestId('map-mobile-layout')).toBeVisible({
    timeout: 60_000,
  })
}

async function openMobilePanel(page: any) {
  const closeButton = page.getByTestId('map-panel-close')
  if (await closeButton.isVisible().catch(() => false)) {
    return
  }

  const entry = page.locator(MOBILE_PANEL_ENTRY_SELECTOR).first()
  await expect(entry).toBeVisible({ timeout: 30_000 })

  for (let attempt = 0; attempt < 3; attempt++) {
    await entry.scrollIntoViewIfNeeded().catch(() => undefined)
    await entry.click({ force: true }).catch(() => undefined)
    await page.waitForTimeout(250)

    const isOpened =
      (await closeButton.isVisible().catch(() => false)) ||
      (await page.getByTestId('segmented-list').isVisible().catch(() => false))
    if (isOpened) return

    await entry.evaluate((el: any) => (el as HTMLElement)?.click?.()).catch(() => undefined)
    await page.waitForTimeout(250)

    const isOpenedAfterDomClick =
      (await closeButton.isVisible().catch(() => false)) ||
      (await page.getByTestId('segmented-list').isVisible().catch(() => false))
    if (isOpenedAfterDomClick) return
  }

  await expect(closeButton).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('segmented-list')).toBeVisible({ timeout: 30_000 })
}

function mobileLayout(page: any) {
  return page.locator('[data-testid="map-mobile-layout"], [testID="map-mobile-layout"]').first()
}

async function activateMobileTab(
  page: any,
  key: 'search' | 'route' | 'list',
) {
  const tab = page.getByTestId(`segmented-${key}`)
  await expect(tab).toBeVisible({ timeout: 15_000 })

  for (let attempt = 0; attempt < 3; attempt++) {
    await tab.click({ force: true }).catch(() => undefined)
    await page.waitForTimeout(150)

    const activatedAfterClick =
      (await tab.getAttribute('aria-checked').catch(() => null)) === 'true'
    if (activatedAfterClick) return

    await tab.evaluate((el: any) => (el as HTMLElement)?.click?.()).catch(() => undefined)
    await page.waitForTimeout(150)

    const activatedAfterDomClick =
      (await tab.getAttribute('aria-checked').catch(() => null)) === 'true'
    if (activatedAfterDomClick) return

    await tab.focus().catch(() => undefined)
    await page.keyboard.press('Enter').catch(() => undefined)
    await page.waitForTimeout(150)

    const activatedAfterKeyboard =
      (await tab.getAttribute('aria-checked').catch(() => null)) === 'true'
    if (activatedAfterKeyboard) return
  }

  await expect(tab).toHaveAttribute('aria-checked', 'true', {
    timeout: 15_000,
  })
}

test.describe('@smoke mobile map panel content', () => {
  test('mobile sheet renders real content for list, radius and route tabs', async ({
    page,
  }) => {
    test.setTimeout(240_000)

    const consoleGuard = installNoConsoleErrorsGuard(page)

    await preacceptCookies(page)
    await seedMobileMapEnvironment(page)
    await installTileMock(page)
    await installMapApiMocks(page)
    await gotoMobileMap(page)

    await test.step('Open mobile map panel and verify shared toolbar', async () => {
      await openMobilePanel(page)

      await expect(page.getByTestId('segmented-search')).toBeVisible()
      await expect(page.getByTestId('segmented-route')).toBeVisible()
      await expect(page.getByTestId('segmented-list')).toBeVisible()
      await expect(page.getByTestId('map-center-user')).toBeVisible()
      await expect(page.getByTestId('map-panel-open')).toBeVisible()
      await expect(page.getByTestId('map-panel-close')).toBeVisible()
    })

    await test.step('List tab is not empty and shows cards', async () => {
      await activateMobileTab(page, 'list')

      await expect(page.getByTestId('travel-list-mobile-summary')).toBeVisible({
        timeout: 20_000,
      })
      await expect(page.getByTestId('travel-list-open-filters')).toBeVisible({
        timeout: 20_000,
      })
      await expect(
        page.locator('[data-testid="map-travel-card"], [testID="map-travel-card"]').first(),
      ).toBeVisible({ timeout: 20_000 })
    })

    await test.step('Radius tab shows filters body instead of a blank sheet', async () => {
      await activateMobileTab(page, 'search')

      const layout = mobileLayout(page)
      const filtersScroll = layout
        .locator('[data-testid="filters-panel-scroll"], [testID="filters-panel-scroll"]')
        .first()

      await expect(filtersScroll).toBeVisible({ timeout: 20_000 })
      await expect(page.getByRole('searchbox', { name: 'Поиск мест на карте' })).toBeVisible({
        timeout: 20_000,
      })
      await expect(
        layout.locator('[data-testid="filters-block-main"], [testID="filters-block-main"]').first(),
      ).toBeVisible({
        timeout: 20_000,
      })
      await expect(layout.locator('[data-testid="radius-presets"], [testID="radius-presets"]').first()).toBeVisible({
        timeout: 20_000,
      })
      await expect(
        layout.locator('[data-testid="filters-panel-footer"], [testID="filters-panel-footer"]').first(),
      ).toBeVisible({
        timeout: 20_000,
      })
      await expect(
        layout.locator('[data-testid="filters-open-list-button"], [testID="filters-open-list-button"]').first(),
      ).toBeVisible({
        timeout: 20_000,
      })
    })

    await test.step('Route tab shows builder and reacts to start/finish input', async () => {
      await activateMobileTab(page, 'route')

      const startInput = page.getByPlaceholder('Старт')
      const finishInput = page.getByPlaceholder('Финиш')
      const buildButton = page.getByTestId('filters-build-route-button')

      await expect(page.getByTestId('route-builder')).toBeVisible({
        timeout: 20_000,
      })
      await expect(page.getByTestId('route-empty-state')).toBeVisible({
        timeout: 20_000,
      })
      await expect(page.getByTestId('route-hint-start')).toBeVisible({
        timeout: 20_000,
      })
      await expect(startInput).toBeVisible({ timeout: 20_000 })
      await expect(finishInput).toBeVisible({ timeout: 20_000 })
      await expect(buildButton).toBeVisible({ timeout: 20_000 })

      await startInput.fill('53.9006, 27.5590')
      await startInput.press('Enter')
      await startInput.press('Tab')

      await expect(page.getByTestId('route-hint-end')).toBeVisible({
        timeout: 20_000,
      })

      await finishInput.fill('53.9106, 27.5690')
      await finishInput.press('Enter')
      await finishInput.press('Tab')

      await expect(page.getByTestId('route-empty-state')).toBeHidden({
        timeout: 20_000,
      })
      await expect(page.getByTestId('route-hint-end')).toBeHidden({
        timeout: 20_000,
      })
      await expect(buildButton).toBeEnabled({ timeout: 20_000 })
    })

    await test.step('Panel still switches back to list after route flow', async () => {
      await activateMobileTab(page, 'list')
      await expect(page.getByTestId('travel-list-mobile-summary')).toBeVisible({
        timeout: 20_000,
      })
    })

    consoleGuard.assertNoErrorsContaining('Maximum update depth exceeded')
    consoleGuard.assertNoErrorsContaining('Cannot read properties of null')
  })
})
