import { test, expect } from './fixtures'
import fs from 'node:fs'
import path from 'node:path'
import {
  ensureAuthedStorageFallback,
  mockFakeAuthApis,
} from './helpers/auth'

/**
 * Trip planning — planner happy-path (Sprint 13, FE-trip-tests #406).
 *
 * The create flow mocks only POST /trips/planned/ locally so this spec does not
 * depend on a deployed planner backend and does not enable the global trip mock
 * flag that would affect public-trips real-BE coverage.
 */

async function setupFakeAuth(page: import('@playwright/test').Page) {
  await ensureAuthedStorageFallback(page)
  await mockFakeAuthApis(page)
}

async function waitForFakeAuth(page: import('@playwright/test').Page) {
  await expect
    .poll(
      () => page.evaluate(() => Boolean(window.localStorage.getItem('userId'))),
      { timeout: 15_000 },
    )
    .toBe(true)
}

async function mockCreateTrip(page: import('@playwright/test').Page) {
  const ownerId = 1

  await page.route('**/api/trips/planned/', async (route) => {
    const request = route.request()
    if (request.method() !== 'POST') {
      await route.fallback()
      return
    }

    let body: Record<string, unknown> = {}
    try {
      const parsed = request.postDataJSON()
      if (parsed && typeof parsed === 'object') {
        body = parsed as Record<string, unknown>
      }
    } catch {
      body = {}
    }
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 99001,
        title: String(body.title ?? 'E2E тест-поездка'),
        description: String(body.description ?? ''),
        start_date: String(body.start_date ?? '2026-09-01T09:00:00'),
        end_date: null,
        status: 'planned',
        owner: {
          id: ownerId,
          username: 'E2E User',
          avatar: null,
        },
        participants: [
          {
            user: {
              id: ownerId,
              username: 'E2E User',
              avatar: null,
            },
            status: 'accepted',
          },
        ],
        route: { points: [] },
        is_public: body.is_public === true,
        max_participants: Number(body.max_participants ?? 4),
      }),
    })
  })
}

const transportRoutePoints = [
  {
    id: 1,
    point_type: 'custom',
    order: 0,
    title: 'Минск',
    description: '',
    lat: 53.9,
    lng: 27.56,
  },
  {
    id: 2,
    point_type: 'custom',
    order: 1,
    title: 'Финиш',
    description: '',
    lat: 53.8,
    lng: 27.4,
  },
]

const buildTransportTrip = (
  transportMode: string,
  ownerId: number,
  bikeType = 'regular',
  description = 'Проверка перестроения маршрута',
) => {
  const degraded = transportMode === 'bicycle'
  const bicycleViaPoint = bikeType === 'road'
    ? [27.51, 53.86]
    : bikeType === 'mountain'
      ? [27.47, 53.83]
      : [27.5, 53.85]
  return {
    id: 99002,
    title: 'E2E переключение транспорта',
    description,
    start_date: '2026-09-01T09:00:00',
    status: 'planned',
    transport_mode: transportMode,
    bike_type: bikeType,
    owner: ownerId,
    participants: [],
    route: { points: transportRoutePoints },
    route_geometry: degraded
      ? [[27.56, 53.9], bicycleViaPoint, [27.4, 53.8]]
      : [[27.56, 53.9], [27.4, 53.8]],
    route_summary: {
      distance_km: degraded ? 19.2 : 18.5,
      duration_min: transportMode === 'walk' ? 240 : degraded ? 72 : 20,
      elevation_gain_m: 140,
      stops_count: 1,
      provider: degraded ? 'direct' : 'ors',
    },
    routing_state: {
      provider: degraded ? 'direct' : 'ors',
      is_optimal: !degraded,
      fallback_reason: degraded ? 'routing_provider_unavailable' : null,
      warnings: [],
    },
    is_public: false,
    max_participants: 4,
  }
}

async function mockTransportTrip(page: import('@playwright/test').Page) {
  const patchBodies: Array<Record<string, unknown>> = []
  const plannedTripRequests: string[] = []
  let currentTransport = 'car'
  let currentBikeType = 'regular'
  let currentDescription = 'Проверка перестроения маршрута'
  let shouldFailNextPatch = false

  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname
    if (pathname.includes('/api/trips/planned/99002')) {
      plannedTripRequests.push(`${request.method()} ${pathname}`)
    }
  })

  await page.route('**/api/trips/route-templates/', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  await page.route('**/api/trips/planned/99002/routes/', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.route('**/api/trips/99002/route-summary/', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        trip: 99002,
        provider: 'fallback',
        status: 'unavailable',
        polyline: null,
      }),
    })
  })
  await page.route('**/api/trips/planned/99002/', async (route) => {
    const request = route.request()
    if (request.method() === 'PATCH') {
      const body = request.postDataJSON() as Record<string, unknown>
      patchBodies.push(body)
      if (shouldFailNextPatch) {
        shouldFailNextPatch = false
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Temporary planner error' }),
        })
        return
      }
      currentTransport = String(body.transport_mode ?? currentTransport)
      currentBikeType = String(body.bike_type ?? currentBikeType)
      currentDescription = String(body.description ?? currentDescription)
      await new Promise((resolve) => setTimeout(resolve, 250))
    } else {
      await waitForFakeAuth(page)
    }

    const ownerId = await page.evaluate(() => Number(window.localStorage.getItem('userId')))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        buildTransportTrip(currentTransport, ownerId, currentBikeType, currentDescription),
      ),
    })
  })

  return {
    patchBodies,
    plannedTripRequests,
    failNextPatch: () => {
      shouldFailNextPatch = true
    },
  }
}

// ── consent seed (mirrors public-trips.spec.ts pattern) ──────────────────────

function seedConsent(page: import('@playwright/test').Page) {
  return page.addInitScript(() => {
    try {
      window.localStorage.setItem(
        'metravel_consent_v1',
        JSON.stringify({ necessary: true, analytics: false, date: '2026-01-01T00:00:00.000Z' }),
      )
    } catch {
      // ignore
    }
  })
}

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe('Trip planner — happy path', () => {
  test('navigates to /trips/plan and renders the planner page', async ({ page }) => {
    await setupFakeAuth(page)
    await seedConsent(page)
    await page.goto('/trips/plan', { waitUntil: 'domcontentloaded' })

    await expect(page).toHaveURL(/\/trips\/my(?:\?.*)?$/, { timeout: 15_000 })
    await expect(page.getByTestId('my-trips-plan-cta')).toBeVisible()
    await expect(page.getByTestId('my-trips-segments')).toBeVisible()
  })

  test('creates a trip via the form and navigates to the plan page', async ({ page }) => {
    await setupFakeAuth(page)
    await seedConsent(page)
    await mockCreateTrip(page)
    await page.goto('/trips/plan/create', { waitUntil: 'domcontentloaded' })

    const form = page.getByTestId('trip-create-form')
    await expect(form).toBeVisible({ timeout: 15_000 })

    // Fill required fields.
    await page.getByTestId('trip-create-title').fill('E2E тест-поездка')
    await page.getByTestId('trip-create-start-date').fill('2026-09-01')
    await page.getByTestId('trip-create-seats').clear()
    await page.getByTestId('trip-create-seats').fill('4')

    // Toggle consent checkbox.
    const consent = page.getByTestId('trip-create-consent')
    await consent.click()
    await expect(consent).toHaveAttribute('aria-checked', 'true')

    // Submit must now be enabled.
    const submitBtn = page.getByTestId('trip-create-submit')
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 })
    const createResponse = page.waitForResponse((response) => {
      const request = response.request()
      return (
        request.method() === 'POST' &&
        new URL(response.url()).pathname === '/api/trips/planned/' &&
        response.status() === 201
      )
    })
    await submitBtn.click()
    await createResponse

    await expect(page).toHaveURL(/\/trips\/plan\/99001$/, { timeout: 15_000 })
  })

  test('edits a description in fullscreen and persists a safe link only on global save', async ({ page }) => {
    await setupFakeAuth(page)
    await seedConsent(page)
    const networkEvidence = await mockTransportTrip(page)
    const consoleErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() !== 'error') return
      const text = message.text()
      if (/CORS policy|net::ERR_FAILED|Failed to load resource/.test(text)) return
      consoleErrors.push(text)
    })

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/trips/plan/99002?edit=1', { waitUntil: 'domcontentloaded' })
    await waitForFakeAuth(page)

    const inlineInput = page.getByTestId('trip-plan-edit-description')
    await expect(inlineInput).toBeVisible({ timeout: 15_000 })
    await expect.poll(async () => (await inlineInput.boundingBox())?.height ?? 0).toBeGreaterThan(177)
    await inlineInput.fill('Этот черновик нужно отменить')
    await page.getByTestId('trip-plan-edit-cancel').click()
    await expect(page.getByTestId('trip-plan-edit-panel')).toBeHidden()
    expect(networkEvidence.patchBodies).toHaveLength(0)
    await page.getByTestId('trip-plan-edit').click()
    await expect(inlineInput).toHaveValue('Проверка перестроения маршрута')

    await inlineInput.fill('Бронь ')
    await inlineInput.press('End')

    await page.getByTestId('trip-plan-description-open-fullscreen').click()
    const fullscreen = page.getByTestId('trip-plan-description-fullscreen')
    const fullscreenInput = page.getByTestId('trip-plan-description-fullscreen-input')
    await expect(fullscreen).toBeVisible()
    await expect(fullscreenInput).toHaveValue('Бронь ')

    await page.getByTestId('trip-plan-description-add-link').click()
    const linkInput = page.getByTestId('trip-plan-description-link-input')
    await linkInput.fill('javascript:alert(1)')
    await page.getByTestId('trip-plan-description-link-insert').click()
    await expect(page.getByTestId('trip-plan-description-link-error')).toBeVisible()
    await expect(fullscreenInput).toHaveValue('Бронь ')

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('trip-plan-description-link-dialog')).toBeHidden()
    await expect(fullscreen).toBeVisible()
    await page.getByTestId('trip-plan-description-add-link').click()

    await linkInput.fill('example.com/hotel')
    await page.getByTestId('trip-plan-description-link-insert').click()
    await expect(fullscreenInput).toHaveValue('Бронь https://example.com/hotel')
    expect(networkEvidence.patchBodies).toHaveLength(0)

    const evidenceDir = path.join(process.cwd(), '.codex-temp', 'trips-description-editor')
    fs.mkdirSync(evidenceDir, { recursive: true })
    await fullscreen.screenshot({ path: path.join(evidenceDir, 'desktop-fullscreen-light.png') })

    await page.getByTestId('trip-plan-description-close').click()
    await expect(inlineInput).toHaveValue('Бронь https://example.com/hotel')
    await page.getByTestId('trip-plan-description-open-fullscreen').click()
    await expect(fullscreenInput).toHaveValue('Бронь https://example.com/hotel')
    await page.getByTestId('trip-plan-description-done').click()
    expect(networkEvidence.patchBodies).toHaveLength(0)

    networkEvidence.failNextPatch()
    await page.getByTestId('trip-plan-edit-save').click()
    await expect(page.getByTestId('trip-plan-edit-error')).toBeVisible()
    await expect(page.getByTestId('trip-plan-edit-panel')).toBeVisible()
    await expect(inlineInput).toHaveValue('Бронь https://example.com/hotel')
    expect(networkEvidence.patchBodies).toHaveLength(1)

    await page.getByTestId('trip-plan-edit-save').click()
    await expect(page.getByTestId('trip-plan-edit-panel')).toBeHidden()
    expect(networkEvidence.patchBodies).toHaveLength(2)
    expect(networkEvidence.patchBodies[1]).toMatchObject({
      description: 'Бронь https://example.com/hotel',
    })
    await expect(page.getByTestId('trip-plan-description')).toContainText(
      'Бронь https://example.com/hotel',
    )
    await expect(page.getByTestId('trip-plan-links')).toContainText('example.com')

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('trip-plan-description')).toContainText(
      'Бронь https://example.com/hotel',
    )
    await expect(page.getByTestId('trip-plan-links')).toContainText('example.com')
    expect(consoleErrors).toEqual([])
  })

  test('switches route transport with one atomic PATCH on desktop and mobile web', async ({ page }) => {
    await setupFakeAuth(page)
    await seedConsent(page)
    const networkEvidence = await mockTransportTrip(page)
    const consoleErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })

    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/trips/plan/99002', { waitUntil: 'domcontentloaded' })
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem('userId'))).toBe('1')
    await waitForFakeAuth(page)

    const control = page.getByTestId('route-builder-transport-control')
    await expect(control).toBeVisible({ timeout: 15_000 })
    const transportStep = page.getByTestId('route-builder-step-transport')
    await expect(transportStep.getByText('Транспорт', { exact: true })).toBeVisible()
    const group = control.getByRole('radiogroup')
    await expect(group).toHaveAccessibleName('Способ передвижения')
    const choices = group.getByRole('radio')
    await expect(choices).toHaveCount(3)
    await expect(choices.nth(0)).toHaveAccessibleName('На машине')
    await expect(choices.nth(1)).toHaveAccessibleName('Пешком')
    await expect(choices.nth(2)).toHaveAccessibleName('На велосипеде')
    await expect(choices.nth(0)).toHaveAttribute('aria-checked', 'true')

    const evidenceDir = path.join(process.cwd(), '.codex-temp', 'trips-transport-switch')
    fs.mkdirSync(evidenceDir, { recursive: true })
    await control.screenshot({ path: path.join(evidenceDir, 'desktop-owner-control.png') })

    await page.getByTestId('segmented-foot').click()
    await expect(page.getByTestId('route-builder-transport-pending')).toBeVisible()
    await expect(page.getByTestId('segmented-car')).toHaveAttribute('aria-disabled', 'true')
    await page.getByTestId('segmented-foot').click({ force: true })
    await expect(page.getByTestId('segmented-foot')).toHaveAttribute('aria-checked', 'true')

    await page.getByTestId('segmented-bike').focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('segmented-bike')).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByTestId('route-summary-approximate')).toBeVisible()

    expect(networkEvidence.patchBodies).toEqual([
      { transport_mode: 'walk' },
      { transport_mode: 'bicycle' },
    ])
    expect(networkEvidence.plannedTripRequests.filter((entry) => entry.startsWith('PATCH '))).toHaveLength(2)
    expect(networkEvidence.plannedTripRequests.some((entry) => entry.includes('/route/'))).toBe(false)

    await page.setViewportSize({ width: 390, height: 844 })
    // Пересечение брейкпоинта 768px пересобирает панель из `stack` в `mapFirst`
    // (`layout={isMobile ? 'mapFirst' : 'stack'}` в app/(tabs)/trips/plan/[id].tsx):
    // секция шагов переезжает под другого родителя, поэтому узел контрола
    // физически пересоздаётся. Без ожидания мобильной раскладки замеры ниже
    // успевают отработать ещё на десктопном узле, а evidence-скриншот попадает
    // в окно перемонтирования и падает с «Element is not attached to the DOM».
    await expect(page.getByTestId('route-mobile-map')).toBeVisible()
    // #1691: панель маршрута на мобильном — обычный контент под картой, поэтому
    // контрол просто доводится до кадра страничным скроллом.
    await control.evaluate((node) => node.scrollIntoView({ block: 'center' }))
    await expect(control).toBeVisible()
    await expect.poll(async () => {
      const touchHeights = await choices.evaluateAll((nodes) =>
        nodes.map((node) => node.getBoundingClientRect().height),
      )
      return touchHeights.every((height) => height >= 44)
    }).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await control.screenshot({ path: path.join(evidenceDir, 'mobile-owner-control.png') })

    expect(consoleErrors).toEqual([])
  })

  test('switches bike profiles atomically and reloads without a Leaflet teardown error', async ({ page }) => {
    await setupFakeAuth(page)
    await seedConsent(page)
    const networkEvidence = await mockTransportTrip(page)
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/trips/plan/99002', { waitUntil: 'domcontentloaded' })
    await waitForFakeAuth(page)
    await expect(page.getByTestId('trip-plan-route-map').locator('.leaflet-container')).toBeVisible()

    // #1691: панель маршрута на мобильном — обычный контент под картой.
    await page
      .getByTestId('route-builder-transport-control')
      .evaluate((node) => node.scrollIntoView({ block: 'center' }))
    await page.getByTestId('segmented-bike').click()
    await expect(page.getByTestId('route-builder-bike-type-control')).toBeVisible()
    await page.getByTestId('route-builder-bike-type-road').click()
    await expect(page.getByTestId('route-builder-bike-type-road')).toHaveAttribute('aria-pressed', 'true')
    await page.getByTestId('route-builder-bike-type-mountain').click()
    await expect(page.getByTestId('route-builder-bike-type-mountain')).toHaveAttribute('aria-pressed', 'true')

    expect(networkEvidence.patchBodies).toEqual([
      { transport_mode: 'bicycle' },
      { bike_type: 'road' },
      { bike_type: 'mountain' },
    ])
    expect(networkEvidence.plannedTripRequests.some((entry) => entry.includes('/route/'))).toBe(false)

    await page.reload({ waitUntil: 'domcontentloaded' })
    await page
      .getByTestId('route-builder-bike-type-mountain')
      .evaluate((node) => node.scrollIntoView({ block: 'center' }))
    await expect(page.getByTestId('route-builder-bike-type-mountain')).toHaveAttribute('aria-pressed', 'true')
    expect(pageErrors).toEqual([])
  })

  // #1691: регрессионный контроль мобильной вкладки «Маршрут». Фиксирует то,
  // что было измеренным дефектом шторки на 390×844: три вложенных скролла,
  // текстовая колонка строки шириной ~46px и форма правки в конце панели.
  test('mobile route tab keeps one scroll, a readable point row and inline editing', async ({ page }) => {
    await setupFakeAuth(page)
    await seedConsent(page)
    await mockTransportTrip(page)
    // Карточка поездки и её route-file/elevation зависимости детерминированы в
    // mockTransportTrip. Здесь отбрасываем только непривязанный к сценарию
    // сетевой шум (например, внешние тайлы) и проверяем ошибки рантайма.
    const consoleErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() !== 'error') return
      const text = message.text()
      if (/CORS policy|net::ERR_FAILED|Failed to load resource/.test(text)) return
      consoleErrors.push(text)
    })

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/trips/plan/99002', { waitUntil: 'domcontentloaded' })
    await waitForFakeAuth(page)

    await expect(page.getByTestId('trip-plan-route-map').locator('.leaflet-container')).toBeVisible({
      timeout: 30_000,
    })

    // Карта — первый блок вкладки и занимает её часть, а не весь скроллпорт:
    // раньше сцена была высотой во вьюпорт и ловила скролл страницы.
    const mapBlock = page.getByTestId('route-mobile-map')
    await expect(mapBlock).toBeVisible()
    const mapBox = await mapBlock.boundingBox()
    expect(mapBox!.height).toBeGreaterThanOrEqual(260)
    expect(mapBox!.height).toBeLessThanOrEqual(420)
    await expect(page.getByTestId('route-mobile-summary')).toBeVisible()

    // Скролл ровно один — страничный. Ни шторки, ни своего скроллера у списка.
    await expect(page.getByTestId('route-sheet')).toHaveCount(0)
    await expect(page.getByTestId('route-sheet-scroll')).toHaveCount(0)
    await expect(page.getByTestId('route-builder-point-list-scroll')).toHaveCount(0)

    // Текстовая колонка строки точки читаема: четыре иконки по 44dp оставляли
    // названию ~46px, и «Минск, площадь Победы» переносился по слогам.
    const pointBody = page.getByTestId('route-builder-focus-0')
    await pointBody.evaluate((node) => node.scrollIntoView({ block: 'center' }))
    const bodyBox = await pointBody.boundingBox()
    expect(bodyBox!.width).toBeGreaterThan(180)

    const evidenceDir = path.join(process.cwd(), '.codex-temp', 'trips-mobile-route')
    fs.mkdirSync(evidenceDir, { recursive: true })
    await page.screenshot({ path: path.join(evidenceDir, 'mobile-map-and-list.png') })

    // «Добавить точку» живёт в секции списка, а не за импортом и экспортом.
    const addAction = page.getByTestId('route-builder-add-action')
    await expect(addAction).toBeVisible()
    expect(
      await page.evaluate(() => {
        const step = document.querySelector('[data-testid="route-builder-step-points"]')
        const action = document.querySelector('[data-testid="route-builder-add-action"]')
        return !!(step && action && step.contains(action))
      }),
    ).toBe(true)

    // Правка точки раскрывается внутри карточки этой же точки.
    await page.getByTestId('route-builder-edit-1').click()
    const editForm = page.getByTestId('route-builder-edit-form')
    await expect(editForm).toBeVisible()
    expect(
      await page.evaluate(() => {
        const card = document.querySelector('[data-testid="route-builder-point-1"]')
        const form = document.querySelector('[data-testid="route-builder-edit-form"]')
        return !!(card && form && card.contains(form))
      }),
    ).toBe(true)
    // Перестановка и удаление доехали до редактора вместе с формой.
    await expect(page.getByTestId('route-builder-delete-1')).toBeVisible()
    await editForm.evaluate((node) => node.scrollIntoView({ block: 'center' }))
    await page.screenshot({ path: path.join(evidenceDir, 'mobile-inline-editor.png') })

    // Горизонтального скролла на 390px не появилось.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    expect(consoleErrors).toEqual([])
  })
})
