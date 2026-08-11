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

const buildTransportTrip = (transportMode: string, ownerId: number, bikeType = 'regular') => {
  const degraded = transportMode === 'bicycle'
  const bicycleViaPoint = bikeType === 'road'
    ? [27.51, 53.86]
    : bikeType === 'mountain'
      ? [27.47, 53.83]
      : [27.5, 53.85]
  return {
    id: 99002,
    title: 'E2E переключение транспорта',
    description: 'Проверка перестроения маршрута',
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

  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname
    if (pathname.includes('/api/trips/planned/99002')) {
      plannedTripRequests.push(`${request.method()} ${pathname}`)
    }
  })

  await page.route('**/api/trips/route-templates/', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  await page.route('**/api/trips/planned/99002/', async (route) => {
    const request = route.request()
    if (request.method() === 'PATCH') {
      const body = request.postDataJSON() as Record<string, unknown>
      patchBodies.push(body)
      currentTransport = String(body.transport_mode ?? currentTransport)
      currentBikeType = String(body.bike_type ?? currentBikeType)
      await new Promise((resolve) => setTimeout(resolve, 250))
    } else {
      await waitForFakeAuth(page)
    }

    const ownerId = await page.evaluate(() => Number(window.localStorage.getItem('userId')))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildTransportTrip(currentTransport, ownerId, currentBikeType)),
    })
  })

  return { patchBodies, plannedTripRequests }
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
    await expect(control.getByText('Способ передвижения', { exact: true })).toBeVisible()
    const group = control.getByRole('radiogroup')
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
    await expect(control).toBeVisible()
    const touchHeights = await choices.evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().height),
    )
    expect(touchHeights.every((height) => height >= 44)).toBe(true)
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
    await expect(page.getByTestId('route-builder-bike-type-mountain')).toHaveAttribute('aria-pressed', 'true')
    expect(pageErrors).toEqual([])
  })
})
