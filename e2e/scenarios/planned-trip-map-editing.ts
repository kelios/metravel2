import { test as base, expect, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import { apiContextFromEnv, apiRequestContext } from '../helpers/e2eApi'
import { seedNecessaryConsent } from '../helpers/storage'

// Registered only by public-trips.spec.ts, which already belongs to live-contract.
// No *.spec.ts entry here: the deterministic regression suite must not create trips.
type Point = { title: string; description: string; point_type: string; lat: number; lng: number }
type PlannerFixture = { id: number; api: APIRequestContext; readPoints: () => Promise<Point[]> }
const initialPoints: Point[] = [
  { title: 'E2E старт', description: '', point_type: 'custom', lat: 53.9, lng: 27.56 },
  { title: 'E2E середина', description: '', point_type: 'custom', lat: 53.91, lng: 27.58 },
  { title: 'E2E финиш', description: '', point_type: 'custom', lat: 53.92, lng: 27.6 },
]

function requireLocalTarget(baseURL: string | undefined) {
  if (process.env.E2E_SUITE !== 'live-contract' || process.env.E2E_ALLOW_LIVE_MUTATIONS !== '1') {
    throw new Error('Planner map editing requires E2E_SUITE=live-contract E2E_ALLOW_LIVE_MUTATIONS=1')
  }
  for (const [name, value] of Object.entries({ baseURL, E2E_API_URL: process.env.E2E_API_URL })) {
    if (!value || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(value).hostname)) {
      throw new Error(`${name} must explicitly target the local stack for planner map editing`)
    }
  }
}

const test = base.extend<{ planner: PlannerFixture }>({
  planner: async ({ baseURL }, runFixture) => {
    requireLocalTarget(baseURL)
    const auth = await apiContextFromEnv()
    if (!auth) throw new Error('Planner map editing requires a real authenticated storageState')
    const api = await apiRequestContext(auth)
    let id: number | undefined
    try {
      const created = await api.post('/api/trips/planned/', { data: {
        title: `E2E planner map ${Date.now()}`,
        description: 'Temporary local #1832 fixture',
        start_date: new Date(Date.now() + 30 * 86400000).toISOString(),
        status: 'planned', is_public: true, max_participants: 4, transport_mode: 'walk',
        create_telegram_group: false,
      } })
      expect(created.status(), 'Create local planner fixture').toBe(201)
      id = Number((await created.json()).id)
      expect(Number.isSafeInteger(id) && id > 0).toBe(true)
      const seeded = await api.put(`/api/trips/planned/${id}/route/`, { data: {
        points: initialPoints.map((point, index) => ({ ...point, order: index + 1 })),
      } })
      expect(seeded.ok(), 'Seed local route').toBe(true)
      const readPoints = async (): Promise<Point[]> => {
        const response = await api.get(`/api/trips/planned/${id}/`)
        expect(response.ok(), 'Read persisted route independently of UI cache').toBe(true)
        const trip = await response.json()
        expect(Array.isArray(trip.route?.points)).toBe(true)
        return trip.route.points.map((point: Point) => ({
          ...point, lat: Number(point.lat), lng: Number(point.lng),
        }))
      }
      await runFixture({ id, api, readPoints })
    } finally {
      try {
        if (id) {
          const deleted = await api.delete(`/api/trips/${id}/`)
          expect(deleted.ok() || deleted.status() === 404, 'Remove only this test’s trip').toBe(true)
        }
      } finally {
        await api.dispose()
      }
    }
  },
})

async function seedUi(page: Page) {
  await page.addInitScript(seedNecessaryConsent)
  await page.addInitScript(() => localStorage.setItem('@metravel/locale-preference:v1',
    JSON.stringify({ version: 1, mode: 'explicit', locale: 'ru' })))
}

const map = (page: Page) => page.getByTestId('trip-plan-route-map')
const markers = (page: Page) => map(page).locator('.metravel-trip-plan-marker')

async function openPlanner(page: Page, planner: PlannerFixture) {
  await seedUi(page)
  const loaded = page.waitForResponse(response =>
    new URL(response.url()).pathname === `/api/trips/planned/${planner.id}/` &&
    response.request().method() === 'GET')
  await page.goto(`/trips/plan/${planner.id}`, { waitUntil: 'domcontentloaded' })
  expect((await loaded).ok(), 'Planner must load the real API trip').toBe(true)
  await expect(map(page).locator('.leaflet-container')).toBeVisible({ timeout: 30_000 })
  await expect(markers(page)).toHaveCount(3)
}

async function openPopup(page: Page, index: number) {
  const marker = markers(page).nth(index)
  await marker.scrollIntoViewIfNeeded()
  await marker.click({ position: { x: 17, y: 8 } })
  await expect(map(page).locator('.leaflet-popup')).toBeVisible()
}

async function saveRoute(page: Page, planner: PlannerFixture) {
  const saved = page.waitForResponse(response =>
    response.request().method() === 'PUT' &&
    new URL(response.url()).pathname === `/api/trips/planned/${planner.id}/route/`)
  await page.getByTestId('route-builder-save').click()
  const response = await saved
  expect(response.ok(), 'Persist route through the real API').toBe(true)
  await expect(page.getByTestId('route-builder-save')).toBeHidden()
  return response.request().postDataJSON() as { points: Point[] }
}

async function selectRealAddress(page: Page, form: Locator, query: string) {
  const responsePromise = page.waitForResponse(response => {
    const url = new URL(response.url())
    return url.hostname === 'nominatim.openstreetmap.org' && url.pathname === '/search' &&
      url.searchParams.get('q') === query
  })
  await form.getByPlaceholder('Найти место по названию или адресу').fill(query)
  const response = await responsePromise
  expect(response.ok(), 'Live geocoder must return a successful response').toBe(true)
  const results = await response.json() as Array<{ display_name: string; lat: string; lon: string }>
  expect(results.length, 'Live geocoder must return an address suggestion').toBeGreaterThan(0)
  const first = results[0]
  await form.getByRole('option', { name: first.display_name, exact: true }).first().click()
  return { lat: Number(first.lat), lng: Number(first.lon) }
}

async function expectCoordinates(page: Page, prefix: string, point: { lat: number; lng: number }) {
  await expect.poll(async () => Number(await page.getByTestId(`${prefix}-lat`).inputValue())).toBeCloseTo(point.lat, 5)
  await expect.poll(async () => Number(await page.getByTestId(`${prefix}-lng`).inputValue())).toBeCloseTo(point.lng, 5)
}

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900, isMobile: false, hasTouch: false },
  { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true },
]) {
  test.describe(`Local planner map editing — ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.isMobile, hasTouch: viewport.hasTouch })
    test.setTimeout(120_000)

    test('manual point addition survives save and reload', async ({ page, planner }, testInfo) => {
      await openPlanner(page, planner)
      await page.getByTestId('route-builder-add-action').click()
      await page.getByTestId('route-builder-type-custom').click()
      await page.getByTestId('route-builder-name').fill('E2E ручная точка')
      await page.getByTestId('route-builder-lat').fill('53.93')
      await page.getByTestId('route-builder-lng').fill('27.61')
      await page.getByTestId('route-builder-add').click()
      await expect(page.getByTestId('route-builder-point-3')).toContainText('E2E ручная точка')
      const body = await saveRoute(page, planner)
      expect(body.points[3]).toMatchObject({ title: 'E2E ручная точка', lat: 53.93, lng: 27.61 })
      expect((await planner.readPoints())[3]).toMatchObject({ title: 'E2E ручная точка', lat: 53.93, lng: 27.61 })
      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(page.getByTestId('route-builder-point-3')).toContainText('E2E ручная точка')
      await expect(markers(page)).toHaveCount(4)
      await page.screenshot({ path: testInfo.outputPath('manual-point.png'), fullPage: true })
    })

    test('real address search fills add and edit forms without committing selection or cancellation', async ({ page, planner }, testInfo) => {
      await openPlanner(page, planner)
      await page.getByTestId('route-builder-add-action').click()
      await page.getByTestId('route-builder-type-rest').click()
      await page.getByTestId('route-builder-name').fill('E2E название пользователя')
      await page.getByTestId('route-builder-description').fill('E2E описание пользователя')
      const address = await selectRealAddress(page, page.getByTestId('route-builder-add-form'), 'Острава')
      await expectCoordinates(page, 'route-builder', address)
      await expect(page.getByTestId('route-builder-name')).toHaveValue('E2E название пользователя')
      await expect(page.getByTestId('route-builder-description')).toHaveValue('E2E описание пользователя')
      await expect(markers(page)).toHaveCount(3)
      expect(await planner.readPoints()).toHaveLength(3)
      await page.getByTestId('route-builder-add-cancel').click()
      await expect(markers(page)).toHaveCount(3)
      await expect(page.getByTestId('route-builder-save')).toBeHidden()

      await page.getByTestId('route-builder-add-action').click()
      await selectRealAddress(page, page.getByTestId('route-builder-add-form'), 'Brno')
      const added = {
        lat: Number(await page.getByTestId('route-builder-lat').inputValue()),
        lng: Number(await page.getByTestId('route-builder-lng').inputValue()),
      }
      await page.getByTestId('route-builder-name').fill('E2E адресная точка')
      await page.getByTestId('route-builder-add').click()
      await expect(page.getByTestId('route-builder-point-3')).toContainText('E2E адресная точка')
      const addBody = await saveRoute(page, planner)
      expect(addBody.points[3]).toMatchObject({ ...added, title: 'E2E адресная точка' })
      await page.getByTestId('route-builder-edit-3').click()
      const editAddress = await selectRealAddress(page, page.getByTestId('route-builder-edit-form'), 'Olomouc')
      await expectCoordinates(page, 'route-builder-edit', editAddress)
      await expect(page.getByTestId('route-builder-edit-name')).toHaveValue('E2E адресная точка')
      expect((await planner.readPoints())[3]).toMatchObject(added)
      await page.getByTestId('route-builder-edit-save').click()
      const editBody = await saveRoute(page, planner)
      expect(editBody.points[3].lat).toBeCloseTo(editAddress.lat, 5)
      expect(editBody.points[3].lng).toBeCloseTo(editAddress.lng, 5)
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.getByTestId('route-builder-edit-3').click()
      await expectCoordinates(page, 'route-builder-edit', editAddress)
      await page.screenshot({ path: testInfo.outputPath('address-edit.png'), fullPage: true })
    })

    test('owner marker drag and popup edit/delete persist the changed route', async ({ page, planner }, testInfo) => {
      await openPlanner(page, planner)
      await expect(markers(page).first()).toHaveClass(/leaflet-marker-draggable/)
      const marker = markers(page).first()
      await marker.scrollIntoViewIfNeeded()
      const box = await marker.boundingBox()
      expect(box).not.toBeNull()
      await page.mouse.move(box!.x + 17, box!.y + 8)
      await page.mouse.down()
      await page.mouse.move(box!.x + 57, box!.y + 38, { steps: 16 })
      await page.mouse.up()
      await page.getByTestId('route-builder-edit-0').click()
      await expect.poll(async () => Number(await page.getByTestId('route-builder-edit-lat').inputValue())).not.toBeCloseTo(initialPoints[0].lat, 5)
      await expect.poll(async () => Number(await page.getByTestId('route-builder-edit-lng').inputValue())).not.toBeCloseTo(initialPoints[0].lng, 5)
      const moved = {
        lat: Number(await page.getByTestId('route-builder-edit-lat').inputValue()),
        lng: Number(await page.getByTestId('route-builder-edit-lng').inputValue()),
      }
      await page.getByTestId('route-builder-edit-cancel').click()
      await saveRoute(page, planner)
      expect((await planner.readPoints())[0]).toMatchObject(moved)
      await page.reload({ waitUntil: 'domcontentloaded' })
      await openPopup(page, 0)
      await page.getByTestId('trip-plan-map-edit-point-0').click()
      await expectCoordinates(page, 'route-builder-edit', moved)
      await page.getByTestId('route-builder-edit-name').fill('E2E изменено с карты')
      await page.getByTestId('route-builder-edit-save').click()
      await saveRoute(page, planner)
      expect((await planner.readPoints())[0].title).toBe('E2E изменено с карты')
      await openPopup(page, 0)
      await page.getByTestId('trip-plan-map-delete-point-0').click()
      await expect(markers(page)).toHaveCount(2)
      await expect(page.getByTestId('route-builder-point-0')).toContainText('E2E середина')
      const deletedBody = await saveRoute(page, planner)
      expect(deletedBody.points.map(point => point.title)).toEqual(initialPoints.slice(1).map(point => point.title))
      expect(await planner.readPoints()).toHaveLength(2)
      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(markers(page)).toHaveCount(2)
      await expect(page.getByTestId('route-builder-point-0')).toContainText('E2E середина')
      await page.screenshot({ path: testInfo.outputPath('map-edit-delete.png'), fullPage: true })
    })

    test('guest markers remain read-only and expose no map actions', async ({ browser, baseURL, planner }, testInfo) => {
      const guest = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] },
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: viewport.isMobile, hasTouch: viewport.hasTouch })
      try {
        const page = await guest.newPage()
        const mutations: string[] = []
        page.on('request', request => {
          if (new URL(request.url()).pathname.startsWith(`/api/trips/planned/${planner.id}/`) &&
              ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) mutations.push(request.method())
        })
        await openPlanner(page, planner)
        await openPopup(page, 0)
        await expect(map(page).locator('.leaflet-marker-draggable')).toHaveCount(0)
        await expect(page.getByTestId(/trip-plan-map-(edit|delete)-point-/)).toHaveCount(0)
        await expect(page.getByTestId('route-builder-add-action')).toHaveCount(0)
        await expect(page.getByTestId('route-builder-save')).toHaveCount(0)
        expect(mutations).toEqual([])
        expect(await planner.readPoints()).toEqual(initialPoints.map(point => expect.objectContaining(point)))
        await page.screenshot({ path: testInfo.outputPath('guest-popup.png'), fullPage: true })
      } finally {
        await guest.close()
      }
    })
  })
}
