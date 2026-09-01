import fs from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'

import { expect, test } from './fixtures'
import {
  ensureAuthedStorageFallback,
  mockFakeAuthApis,
} from './helpers/auth'

/**
 * #873 — persisted routing metadata is not display geometry.
 *
 * The backend fixture deliberately claims a healthy ORS route while both
 * geometry sources are null. The planner must fail closed, repair the saved
 * coordinates through the same POST /routing/route/ engine as /map, and only
 * then publish geometry/state/summary as one tuple.
 */

const TRIP_ID = 87301
const EVIDENCE_DIR = path.join(process.cwd(), '.codex-temp', 'task-873')
const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

const savedPoints = [
  {
    id: 1,
    point_type: 'custom',
    order: 1,
    title: 'Минск',
    description: '',
    lat: 53.9023,
    lng: 27.5615,
  },
  {
    id: 2,
    point_type: 'custom',
    order: 2,
    title: 'Несвиж',
    description: '',
    lat: 53.2225,
    lng: 26.6906,
  },
  {
    id: 3,
    point_type: 'custom',
    order: 3,
    title: 'Мир',
    description: '',
    lat: 53.4512,
    lng: 26.4731,
  },
]

const denseGeometry: Array<[number, number]> = Array.from(
  { length: 30 },
  (_, index) => [
    27.5615 + ((26.4731 - 27.5615) * index) / 29,
    53.9023 + ((53.4512 - 53.9023) * index) / 29 + Math.sin(index / 3) * 0.015,
  ],
)

const tripDto = {
  id: TRIP_ID,
  title: 'E2E truthful saved route',
  description: 'Healthy metadata without saved geometry',
  start_date: '2026-09-01T09:00:00',
  status: 'planned',
  transport_mode: 'car',
  bike_type: 'regular',
  owner: 1,
  participants: [],
  route: { points: savedPoints },
  route_geometry: null,
  route_summary: {
    distance_km: 118.2,
    duration_min: 96,
    elevation_gain_m: 240,
    stops_count: 3,
    provider: 'ors',
  },
  routing_state: {
    provider: 'ors',
    is_optimal: true,
    fallback_reason: null,
    warnings: [],
  },
  is_public: false,
  max_participants: 4,
}

type RoutingMode = 'success' | 'failure'

type RuntimeErrors = {
  consoleErrors: string[]
  pageErrors: string[]
}

type RoutingFixture = {
  releaseSuccess: () => void
  routingCalls: () => number
  routeSummaryPosts: () => number
  requestBodies: Array<Record<string, unknown>>
}

const captureRuntimeErrors = (page: Page): RuntimeErrors => {
  const runtime: RuntimeErrors = { consoleErrors: [], pageErrors: [] }
  page.on('console', (message) => {
    if (message.type() === 'error') runtime.consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => runtime.pageErrors.push(error.message))
  return runtime
}

const seedConsent = (page: Page) =>
  page.addInitScript(() => {
    try {
      window.localStorage.setItem(
        'metravel_consent_v1',
        JSON.stringify({
          necessary: true,
          analytics: false,
          date: '2026-01-01T00:00:00.000Z',
        }),
      )
    } catch {
      // Storage may be unavailable before the first document; auth helpers
      // apply the same value again on the application origin.
    }
  })

const waitForFakeAuth = (page: Page) =>
  expect
    .poll(
      () => page.evaluate(() => window.localStorage.getItem('userId')),
      { timeout: 15_000 },
    )
    .toBe('1')

async function mockTruthfulRouteScenario(
  page: Page,
  mode: RoutingMode,
): Promise<RoutingFixture> {
  await ensureAuthedStorageFallback(page)
  await mockFakeAuthApis(page)
  await seedConsent(page)

  let routingCalls = 0
  let routeSummaryPosts = 0
  let releaseRouting!: () => void
  const responseGate = new Promise<void>((resolve) => {
    releaseRouting = resolve
  })
  const requestBodies: Array<Record<string, unknown>> = []

  // A valid local tile prevents screenshots and console evidence from depending
  // on the E2E server's tile proxy or an external OSM host.
  await page.route('**/proxy/tiles/osm/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: TRANSPARENT_PNG }),
  )

  await page.route('**/api/trips/route-templates/', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  await page.route(`**/api/trips/planned/${TRIP_ID}/routes/`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  await page.route(`**/api/trips/${TRIP_ID}/route-summary/`, async (route) => {
    if (route.request().method() === 'POST') routeSummaryPosts += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        trip: TRIP_ID,
        provider: 'ors',
        status: 'ready',
        ascent_m: null,
        descent_m: null,
        polyline: null,
        calculated_at: '2026-08-27T08:00:00Z',
      }),
    })
  })
  await page.route(`**/api/trips/planned/${TRIP_ID}/`, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }
    await waitForFakeAuth(page)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(tripDto),
    })
  })

  await page.route('**/api/routing/route/', async (route) => {
    routingCalls += 1
    requestBodies.push(route.request().postDataJSON() as Record<string, unknown>)
    if (mode === 'success') {
      await responseGate
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          geometry: denseGeometry,
          distance_m: 24_300,
          duration_s: 2_040,
          provider: 'ors',
          is_optimal: true,
          fallback_reason: null,
          warnings: [],
        }),
      })
      return
    }

    // HTTP itself succeeds so an intentional provider failure does not pollute
    // console.error evidence. Empty provider payloads force the production
    // fallback chain to finish at its explicit direct-line state.
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })

  if (mode === 'failure') {
    await page.route(/^https:\/\/api\.openrouteservice\.org\//, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"features":[]}' }),
    )
    await page.route(/^https:\/\/router\.project-osrm\.org\//, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"routes":[]}' }),
    )
  }

  return {
    releaseSuccess: releaseRouting,
    routingCalls: () => routingCalls,
    routeSummaryPosts: () => routeSummaryPosts,
    requestBodies,
  }
}

const routeMap = (page: Page) => page.getByTestId('trip-plan-route-map')
const routePolyline = (page: Page) =>
  routeMap(page).locator('.leaflet-overlay-pane path.leaflet-interactive').first()

const renderedLineSegmentCount = (pathData: string): number =>
  pathData.match(/[Ll]/g)?.length ?? 0

// #1691: чипов поверх карты больше нет — итог маршрута лежит обычной секцией
// панели, и на 390px до него достаточно докрутить страницу.
async function openSummaryOnMobile(page: Page) {
  await page.getByTestId('route-summary').evaluate((node) => node.scrollIntoView({ block: 'center' }))
  await expect(page.getByTestId('route-summary')).toBeVisible()
}

async function assertPendingTruthfulness(page: Page, network: RoutingFixture) {
  await expect(routeMap(page).locator('.leaflet-container')).toBeVisible({ timeout: 30_000 })
  await expect.poll(network.routingCalls, { timeout: 15_000 }).toBe(1)

  expect(network.requestBodies[0]).toEqual({
    points: savedPoints.map(({ lat, lng }) => ({ lat, lng })),
    transport_mode: 'car',
  })
  await expect(page.getByText('Маршрут построен ORS', { exact: true })).toHaveCount(0)
  await expect(page.getByText('118 км', { exact: true })).toHaveCount(0)
  await expect(page.getByTestId('route-summary-routed')).toHaveCount(0)
  await expect(page.getByText('Построение маршрута…', { exact: true })).toBeAttached()

  // Before the shared engine answers, only the truthful waypoint fallback is
  // allowed on the map — it is dashed, never a healthy routed line.
  await expect(routePolyline(page)).toBeVisible()
  await expect(routePolyline(page)).toHaveAttribute('stroke-dasharray', /8(?:,\s*|\s+)8/)
  const waypointPathData = await routePolyline(page).getAttribute('d')
  expect(waypointPathData).toBeTruthy()
  const waypointSegments = renderedLineSegmentCount(waypointPathData ?? '')
  expect(waypointSegments).toBeGreaterThanOrEqual(1)
  expect(waypointSegments).toBeLessThanOrEqual(savedPoints.length - 1)
  return { waypointPathData: waypointPathData ?? '', waypointSegments }
}

const successProfiles = [
  { name: 'desktop-1440', viewport: { width: 1440, height: 1000 }, mobile: false },
  { name: 'mobile-390', viewport: { width: 390, height: 844 }, mobile: true },
] as const

test.describe('Planned trip route truthfulness (#873)', () => {
  for (const profile of successProfiles) {
    test(`${profile.name}: repairs healthy metadata before showing a routed line`, async ({ page }) => {
      const runtime = captureRuntimeErrors(page)
      const network = await mockTruthfulRouteScenario(page, 'success')
      await page.setViewportSize(profile.viewport)
      await page.goto(`/trips/plan/${TRIP_ID}`, { waitUntil: 'domcontentloaded' })
      await waitForFakeAuth(page)

      const pendingPolyline = await assertPendingTruthfulness(page, network)
      network.releaseSuccess()

      if (profile.mobile) await openSummaryOnMobile(page)
      const routedSummary = page.getByTestId('route-summary-routed')
      await expect(routedSummary).toBeVisible({ timeout: 15_000 })
      await expect(
        routedSummary.getByText('Маршрут построен по дорогам', { exact: true }),
      ).toBeVisible()
      await expect(
        page.getByTestId('route-summary-metric-distance').getByText('24 км', { exact: true }),
      ).toBeVisible()
      await expect(page.getByText('Маршрут построен ORS', { exact: true })).toHaveCount(0)
      await expect(page.getByText('118 км', { exact: true })).toHaveCount(0)

      await expect(routePolyline(page)).toBeVisible()
      await expect(routePolyline(page)).not.toHaveAttribute('stroke-dasharray', /.+/)
      const routedPathData = await routePolyline(page).getAttribute('d')
      expect(routedPathData).toBeTruthy()
      expect(routedPathData).not.toBe(pendingPolyline.waypointPathData)
      expect(renderedLineSegmentCount(routedPathData ?? '')).toBeGreaterThan(
        pendingPolyline.waypointSegments + 2,
      )

      if (!profile.mobile) {
        const downloadPromise = page.waitForEvent('download')
        await page.getByTestId('trip-route-export-gpx').click()
        const download = await downloadPromise
        const downloadedPath = await download.path()
        expect(downloadedPath).not.toBeNull()
        const exportedGpx = fs.readFileSync(downloadedPath as string, 'utf8')
        const exportedTrackPoints = exportedGpx.match(/<trkpt\s/g)?.length ?? 0
        expect(exportedTrackPoints).toBeGreaterThanOrEqual(denseGeometry.length)
        expect(exportedGpx).toContain('Healthy metadata without saved geometry')
      }
      expect(network.routeSummaryPosts()).toBe(0)

      fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
      await page.screenshot({
        path: path.join(EVIDENCE_DIR, `${profile.name}-success.png`),
        fullPage: false,
      })
      expect(runtime.consoleErrors).toEqual([])
      expect(runtime.pageErrors).toEqual([])
    })
  }

  test('desktop failure keeps a dashed direct line and retry starts a new request', async ({ page }) => {
    const runtime = captureRuntimeErrors(page)
    const network = await mockTruthfulRouteScenario(page, 'failure')
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto(`/trips/plan/${TRIP_ID}`, { waitUntil: 'domcontentloaded' })
    await waitForFakeAuth(page)

    await expect(page.getByText('Прямая линия', { exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('route-summary-approximate')).toBeVisible()
    await expect(page.getByTestId('route-summary-routed')).toHaveCount(0)
    await expect(page.getByText('Маршрут построен ORS', { exact: true })).toHaveCount(0)
    await expect(page.getByText('118 км', { exact: true })).toHaveCount(0)
    await expect(routePolyline(page)).toBeVisible()
    await expect(routePolyline(page)).toHaveAttribute('stroke-dasharray', /8(?:,\s*|\s+)8/)
    await expect.poll(network.routingCalls).toBe(1)

    // routeCache enforces a documented 500ms provider interval. Waiting just
    // past that boundary tests the retry request itself instead of rate-limit UI.
    await page.waitForTimeout(550)
    await page.getByRole('button', { name: 'Повторить построение маршрута' }).click()
    await expect.poll(network.routingCalls, { timeout: 15_000 }).toBe(2)
    await expect(page.getByText('Прямая линия', { exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(routePolyline(page)).toHaveAttribute('stroke-dasharray', /8(?:,\s*|\s+)8/)
    expect(network.routeSummaryPosts()).toBe(0)

    fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'desktop-1440-failure-retry.png'),
      fullPage: false,
    })
    expect(runtime.consoleErrors).toEqual([])
    expect(runtime.pageErrors).toEqual([])
  })
})
