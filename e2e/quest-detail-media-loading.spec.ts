import { devices, expect, test, type Request } from '@playwright/test'
import { seedActionConsents } from './helpers/actionConsent'
import { beginPostReadyClsCollection, collectMetrics, createNetworkTracker, injectPerfObservers } from './helpers/perfBudget'

type ImageState = { src: string; loading: string; top: number; width: number; height: number; rendered: boolean }
const eagerBelowFold = (images: ImageState[], viewportHeight: number) => images.filter((image) =>
  /^https?:/.test(image.src) && image.rendered && image.width > 0 && image.height > 0 &&
  image.top >= viewportHeight && image.loading !== 'lazy')

// Exact public quest4 compute approved for this live-data acceptance, not a
// general POST exception. A content/coordinate change requires a fresh baseline.
const QUEST4_ROUTE_POINTS = [
  { lat: 53.903541, lng: 27.556037 }, { lat: 53.9043, lng: 27.55645 },
  { lat: 53.906788, lng: 27.555719 }, { lat: 53.908227, lng: 27.556312 },
  { lat: 53.907793, lng: 27.555235 }, { lat: 53.903961, lng: 27.567878 },
  { lat: 53.90405, lng: 27.5677 }, { lat: 53.9039, lng: 27.5719 },
]
const exactQuest4Compute = (method: string, url: URL, origin: string, body: unknown) => {
  if (method !== 'POST' || url.origin !== origin || url.pathname !== '/api/routing/route/' || url.search) return false
  if (!body || typeof body !== 'object') return false
  const candidate = body as { points?: unknown; transport_mode?: unknown }
  return Object.keys(candidate).sort().join(',') === 'points,transport_mode' && candidate.transport_mode === 'foot' &&
    Array.isArray(candidate.points) && candidate.points.length === QUEST4_ROUTE_POINTS.length &&
    candidate.points.every((point, index) => point && typeof point === 'object' &&
      Object.keys(point).sort().join(',') === 'lat,lng' &&
      point.lat === QUEST4_ROUTE_POINTS[index].lat && point.lng === QUEST4_ROUTE_POINTS[index].lng)
}

test('read-only boundary permits only the exact public quest4 routing compute', () => {
  const origin = 'https://metravel.by'
  const url = new URL('/api/routing/route/', origin)
  const body = { points: QUEST4_ROUTE_POINTS, transport_mode: 'foot' }
  expect(exactQuest4Compute('POST', url, origin, body)).toBe(true)
  for (const [method, target, payload] of [
    ['POST', new URL('/api/quest-progress/', origin), body],
    ['POST', new URL('/api/routing/route/', 'https://other.example'), body],
    ['POST', url, { ...body, transport_mode: 'car' }],
    ['POST', url, { ...body, points: QUEST4_ROUTE_POINTS.slice(1) }],
    ['POST', url, { ...body, points: [{ ...QUEST4_ROUTE_POINTS[0], lat: 0 }, ...QUEST4_ROUTE_POINTS.slice(1)] }],
    ['POST', new URL('/api/routing/route/?save=1', origin), body],
    ['POST', url, { ...body, save: true }],
    ['DELETE', url, body],
  ] as const) expect(exactQuest4Compute(method, target, origin, payload)).toBe(false)
})

test('quest eager guard rejects a below-fold tile and accepts lazy preload/first-screen/hidden controls', () => {
  const tile = { src: 'https://metravel.by/proxy/tiles/osm/14/1/2.png', loading: '', top: 1200, width: 256, height: 256, rendered: true }
  expect(eagerBelowFold([tile, { ...tile, loading: 'lazy' }, { ...tile, top: 200 }, { ...tile, rendered: false }], 844)).toEqual([tile])
})

// Real data only: no route/media mocks. Delivery runs this against the reviewed
// production build; Metro/fixture results do not prove the transfer contract.
for (const profile of [
  { name: 'mobile', viewport: { width: 390, height: 844 }, dpr: 3, limit: 1600, coverWidth: 640 },
  { name: 'desktop', viewport: { width: 1440, height: 900 }, dpr: 1, limit: 1489, coverWidth: 320 },
]) {
  test.describe(`quest detail media ${profile.name}`, () => {
    test.use({ viewport: profile.viewport, deviceScaleFactor: profile.dpr,
      isMobile: profile.name === 'mobile', hasTouch: profile.name === 'mobile',
      ...(profile.name === 'mobile' ? { userAgent: devices['Pixel 7'].userAgent } : {}),
      storageState: { cookies: [], origins: [] }, serviceWorkers: 'block' })

    test('defers only the below-fold intro map, then reveals it without shifting its slot @perf', async ({ page, baseURL }, testInfo) => {
      if (!baseURL) throw new Error('quest4 media contract requires the configured target baseURL')
      const targetOrigin = new URL(baseURL).origin
      await injectPerfObservers(page)
      await seedActionConsents(page)
      const network = createNetworkTracker(page)
      const active = new Set<Request>()
      const tileRequests: string[] = []
      const errors: string[] = []
      const consoleErrors: string[] = []
      const failedRequests: Array<{ url: string; error: string | null }> = []
      const httpFailures: Array<{ url: string; status: number }> = []
      const unexpectedWrites: Array<{ method: string; url: string }> = []
      const routing: Array<{ status: number; provider: string | null; optimal: boolean }> = []
      let allowedComputes = 0
      await page.route('**/*', async (route) => {
        const request = route.request()
        if (['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return route.continue()
        let body: unknown = null
        try { body = request.postDataJSON() } catch { /* invalid/non-JSON writes stay blocked */ }
        if (exactQuest4Compute(request.method(), new URL(request.url()), targetOrigin, body)) {
          allowedComputes += 1
          return route.continue()
        }
        unexpectedWrites.push({ method: request.method(), url: request.url() })
        return route.abort('blockedbyclient')
      })
      let lastActivity = Date.now()
      page.on('pageerror', (error) => errors.push(error.message))
      page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
      page.on('response', async (response) => {
        if (response.status() >= 400) httpFailures.push({ url: response.url(), status: response.status() })
        if (response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/routing/route/') {
          const body = await response.json().catch(() => null)
          routing.push({ status: response.status(), provider: body?.provider ?? null, optimal: body?.is_optimal === true })
        }
      })
      page.on('request', (request) => {
        active.add(request)
        lastActivity = Date.now()
        if (new URL(request.url()).pathname.startsWith('/proxy/tiles/osm/')) tileRequests.push(request.url())
      })
      const finish = (request: Request) => { active.delete(request); lastActivity = Date.now() }
      page.on('requestfinished', finish)
      page.on('requestfailed', (request) => {
        finish(request)
        failedRequests.push({ url: request.url(), error: request.failure()?.errorText ?? null })
      })
      const health = () => ({ errors, consoleErrors, failedRequests, httpFailures, unexpectedWrites, allowedComputes, routing })
      const expectHealthy = () => {
        expect(errors).toEqual([])
        expect(consoleErrors).toEqual([])
        expect(failedRequests).toEqual([])
        expect(httpFailures).toEqual([])
        expect(unexpectedWrites).toEqual([])
        expect(allowedComputes).toBe(1)
        expect(routing).toEqual([{ status: 200, provider: 'ors', optimal: true }])
      }
      const quiet = () => expect.poll(() => active.size ? 0 : Date.now() - lastActivity,
        { timeout: 30_000, message: 'three seconds of network quiet' }).toBeGreaterThanOrEqual(3000)

      await page.goto('/quests/4/minsk-kids-bronze-friends', { waitUntil: 'load' })
      await expect(page.getByTestId('quest-trust-bar')).toBeVisible()
      expect(new URL(page.url()).origin).toBe(targetOrigin)
      expect(new URL(page.url()).pathname).toBe('/quests/4/minsk-kids-bronze-friends')
      const toolbar = page.getByTestId('quest-map-toolbar')
      const slot = profile.name === 'mobile' ? page.getByTestId('quest-map-deferred-slot') : toolbar.locator('..')
      if (profile.name === 'mobile') await expect(slot).toBeAttached()
      else await expect(toolbar).toBeInViewport()
      await quiet()
      expect(await page.evaluate(() => ({ x: scrollX, y: scrollY }))).toEqual({ x: 0, y: 0 })
      const ready = network.getStats()
      const images = await page.locator('img').evaluateAll((nodes): ImageState[] => nodes.map((node) => {
        const image = node as HTMLImageElement
        const box = image.getBoundingClientRect()
        const css = getComputedStyle(image)
        return { src: image.currentSrc, loading: image.loading, top: box.top, width: box.width, height: box.height,
          rendered: css.display !== 'none' && css.visibility !== 'hidden' }
      }))
      await testInfo.attach('ready-media', { body: JSON.stringify({ profile, ready, images, tileRequests: [...tileRequests], health: health() }), contentType: 'application/json' })
      expectHealthy()
      expect(eagerBelowFold(images, profile.viewport.height)).toEqual([])
      expect(ready.totalKB).toBeLessThanOrEqual(profile.limit)
      if (profile.name === 'mobile') {
        expect(tileRequests).toEqual([])
        expect((await slot.boundingBox())!.height).toBe(360)
        await expect(toolbar).toHaveCount(0)
      }

      await beginPostReadyClsCollection(page)
      const reserved = await slot.boundingBox()
      expect(reserved).not.toBeNull()
      if (reserved) await slot.scrollIntoViewIfNeeded()
      await expect(toolbar).toBeVisible()
      await expect.poll(() => tileRequests.length).toBeGreaterThan(0)
      const tiles = page.locator('.leaflet-tile-pane img')
      const visibleTiles = () => tiles.evaluateAll(async (nodes) => {
        const visible = nodes.filter((node) => {
          const image = node as HTMLImageElement
          const box = image.getBoundingClientRect()
          const map = image.closest('.leaflet-container')?.getBoundingClientRect()
          const css = getComputedStyle(image)
          return !!map && css.display !== 'none' && css.visibility !== 'hidden' && box.width > 0 && box.height > 0 &&
            box.right > Math.max(0, map.left) && box.left < Math.min(innerWidth, map.right) &&
            box.bottom > Math.max(0, map.top) && box.top < Math.min(innerHeight, map.bottom)
        })
        return Promise.all(visible.map(async (node) => {
          const image = node as HTMLImageElement
          const decoded = image.complete && image.naturalWidth > 0 ? await image.decode().then(() => true, () => false) : false
          return { src: image.currentSrc, complete: image.complete, naturalWidth: image.naturalWidth, decoded }
        }))
      })
      const expectTilesReady = () => expect.poll(async () => {
        const states = await visibleTiles()
        return states.length > 0 && states.every((tile) => tile.complete && tile.naturalWidth > 0 && tile.decoded)
      }, { message: 'every visible map tile is decoded' }).toBe(true)
      await expectTilesReady()
      let decodedTiles = await visibleTiles()
      if (reserved) expect((await slot.boundingBox())!.height).toBe(reserved.height)

      const covers = page.locator('[data-testid^="quest-travel-card-"] img')
      expect(await covers.count()).toBeGreaterThan(0)
      for (const cover of await covers.all()) {
        await cover.scrollIntoViewIfNeeded()
        await expect(cover).toHaveAttribute('loading', 'lazy')
        await expect.poll(() => cover.evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
      }
      const sizes = await covers.evaluateAll((nodes) => nodes.map((node) => {
        const image = node as HTMLImageElement
        return { src: image.currentSrc, cssWidth: image.getBoundingClientRect().width, naturalWidth: image.naturalWidth,
          requestedWidth: Number(new URL(image.currentSrc).searchParams.get('w')), dpr: devicePixelRatio }
      }))
      for (const size of sizes) {
        expect(size.requestedWidth).toBeGreaterThanOrEqual(profile.coverWidth)
        expect(size.requestedWidth).toBeLessThanOrEqual(Math.ceil(size.cssWidth * size.dpr * 1.5))
      }
      if (reserved) {
        await slot.scrollIntoViewIfNeeded()
        await expect(toolbar).toBeVisible()
        expect((await slot.boundingBox())!.height).toBe(reserved.height)
      }
      await quiet()
      await expectTilesReady()
      decodedTiles = await visibleTiles()
      const metrics = await collectMetrics(page)
      expect(metrics.clsAfterReady).toBeLessThanOrEqual(0.1)
      await testInfo.attach('scroll-media', { body: JSON.stringify({ sizes, metrics, tileRequests, decodedTiles, health: health() }), contentType: 'application/json' })
      expectHealthy()
      await page.screenshot({ path: testInfo.outputPath('map-after-scroll.png') })
    })
  })
}
