import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  devices,
  type APIRequestContext,
  type Locator,
  type Page,
  type Request,
  type Route,
  type TestInfo,
} from '@playwright/test'

import { expect, test } from './fixtures'
import { seedNecessaryConsent } from './helpers/storage'

const EVIDENCE_DIR = resolve('.codex-temp/task-1603/live')
const GPS_LAT = 50.06143
const GPS_LNG = 19.93658
const GPS_JPEG_NAME = 'task-1603-real-exif-gps.jpg'
const PIXEL_7_MOBILE_WEB = {
  userAgent: devices['Pixel 7'].userAgent,
  viewport: devices['Pixel 7'].viewport,
  deviceScaleFactor: devices['Pixel 7'].deviceScaleFactor,
  isMobile: devices['Pixel 7'].isMobile,
  hasTouch: devices['Pixel 7'].hasTouch,
}

// Valid 10x10 JPEG with real EXIF GPS tags (50.06143 N, 19.93658 E).
// The live contract deliberately does not set __METRAVEL_E2E_EXIF_GPS__.
const GPS_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAASABIAAD/4QDKRXhpZgAATU0AKgAAAAgAAodpAAQAAAABAAAAJoglAAQAAAABAAAAUAAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAACqADAAQAAAABAAAACgAAAAAABQAAAAEAAAAEAgMAAAABAAIAAAACTgAAAAACAAUAAAADAAAAkgADAAIAAAACRQAAAAAEAAUAAAADAAAAqgAAAAAAAAAyAAAAAQAAAAMAAAABAAAoLwAAAPoAAAATAAAAAQAAADgAAAABAAAFtQAAAH3/wAARCAAKAAoDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9sAQwACAgICAgIDAgIDBQMDAwUGBQUFBQYIBgYGBgYICggICAgICAoKCgoKCgoKDAwMDAwMDg4ODg4PDw8PDw8PDw8P/9sAQwECAgIEBAQHBAQHEAsJCxAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ/90ABAAB/9oADAMBAAIRAxEAPwD93o7yKO9ex8ssVAO4n1qZYLkKA1xkgcnYBmsv/mNzf7g/pXQVmncpK5//2Q==',
  'base64',
)

const TILE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=',
  'base64',
)

type Viewport = { width: number; height: number; label: 'desktop' | 'mobile' }

type PointSnapshot = {
  id: number
  lat: number
  lng: number
  country: number | null
  address: string
  categories: number[]
}

type UploadRecord = {
  collection: string
  filename: string
  id: string
}

type BrowserTelemetry = {
  consoleErrors: string[]
  failedRequests: string[]
  httpErrors: string[]
  mutationResponses: Array<{ method: string; url: string; status: number }>
  tokenHeaderRequests: string[]
  uploads: UploadRecord[]
  upserts: string[]
}

type LiveCookieApiContext = {
  appBase: string
  csrfToken: string
  request: APIRequestContext
}

type TelemetryErrorCounts = Pick<
  BrowserTelemetry,
  'consoleErrors' | 'failedRequests' | 'httpErrors'
>

const pointSnapshot = (point: Record<string, unknown>): PointSnapshot => ({
  id: Number(point.id),
  lat: Number(point.lat),
  lng: Number(point.lng),
  country: point.country == null ? null : Number(point.country),
  address: String(point.address ?? ''),
  categories: Array.isArray(point.categories)
    ? point.categories.map(Number).sort((left, right) => left - right)
    : [],
})

const pointSnapshots = (travel: Record<string, unknown>): PointSnapshot[] => {
  const points = Array.isArray(travel.coordsMeTravel)
    ? travel.coordsMeTravel
    : []
  return points.map((point) => pointSnapshot(point as Record<string, unknown>))
}

const multipartField = (body: string, field: string): string => {
  const match = body.match(
    new RegExp(`name="${field}"\\r?\\n\\r?\\n([^\\r\\n]+)`),
  )
  return match?.[1]?.trim() ?? ''
}

const multipartFilename = (body: string): string => {
  const match = body.match(/name="file";\s*filename="([^"]+)"/i)
  return match?.[1]?.trim() ?? ''
}

const uploadRecord = (request: Request): UploadRecord => {
  const body = request.postDataBuffer()?.toString('utf8') ?? ''
  return {
    collection: multipartField(body, 'collection'),
    filename: multipartFilename(body),
    id: multipartField(body, 'id'),
  }
}

const isUploadRequest = (request: Request): boolean =>
  request.method() === 'POST' &&
  /\/(?:api\/)?upload\/?(?:\?|$)/.test(request.url())

const isUpsertRequest = (request: Request): boolean =>
  request.method() === 'PUT' &&
  /\/api\/travels\/upsert\/?(?:\?|$)/.test(request.url())

const installBrowserTelemetry = (page: Page): BrowserTelemetry => {
  const telemetry: BrowserTelemetry = {
    consoleErrors: [],
    failedRequests: [],
    httpErrors: [],
    mutationResponses: [],
    tokenHeaderRequests: [],
    uploads: [],
    upserts: [],
  }

  page.on('console', (message) => {
    if (message.type() === 'error') telemetry.consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => telemetry.consoleErrors.push(error.message))
  page.on('request', (request) => {
    if (isUploadRequest(request)) telemetry.uploads.push(uploadRecord(request))
    if (isUpsertRequest(request)) telemetry.upserts.push(request.url())
    const authorization = request.headers().authorization ?? ''
    if (authorization && /\/api\//.test(request.url())) {
      telemetry.tokenHeaderRequests.push(`${request.method()} ${request.url()}`)
    }
  })
  page.on('requestfailed', (request) => {
    telemetry.failedRequests.push(
      `${request.method()} ${request.url()} — ${request.failure()?.errorText ?? 'unknown error'}`,
    )
  })
  page.on('response', (response) => {
    const request = response.request()
    if (isUploadRequest(request) || isUpsertRequest(request)) {
      telemetry.mutationResponses.push({
        method: request.method(),
        url: response.url(),
        status: response.status(),
      })
    }
    if (response.status() >= 400) {
      telemetry.httpErrors.push(
        `${request.method()} ${response.url()} — ${response.status()}`,
      )
    }
  })

  return telemetry
}

const expectCleanTelemetry = (telemetry: BrowserTelemetry): void => {
  expect(telemetry.consoleErrors, 'browser console/page errors').toEqual([])
  expect(telemetry.failedRequests, 'browser request failures').toEqual([])
  expect(telemetry.httpErrors, 'browser HTTP >= 400 responses').toEqual([])
  expect(
    telemetry.tokenHeaderRequests,
    'web API must use the HttpOnly cookie, not Authorization',
  ).toEqual([])
}

const telemetryErrorCounts = (
  telemetry: BrowserTelemetry,
): Record<keyof TelemetryErrorCounts, number> => ({
  consoleErrors: telemetry.consoleErrors.length,
  failedRequests: telemetry.failedRequests.length,
  httpErrors: telemetry.httpErrors.length,
})

const restoreTelemetryErrorCounts = (
  telemetry: BrowserTelemetry,
  counts: Record<keyof TelemetryErrorCounts, number>,
): void => {
  telemetry.consoleErrors.length = counts.consoleErrors
  telemetry.failedRequests.length = counts.failedRequests
  telemetry.httpErrors.length = counts.httpErrors
}

const firstId = (raw: unknown): number | null => {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const first = raw[0]
  const value =
    first && typeof first === 'object'
      ? ((first as Record<string, unknown>).id ??
        (first as Record<string, unknown>).country_id)
      : first
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

const readLiveEnv = () => {
  const email = String(process.env.E2E_EMAIL ?? '').trim()
  const password = String(process.env.E2E_PASSWORD ?? '').trim()
  const apiBase = String(process.env.E2E_API_URL ?? '')
    .trim()
    .replace(/\/+$/, '')
  const appApiBase = String(process.env.EXPO_PUBLIC_API_URL ?? '')
    .trim()
    .replace(/\/+$/, '')
  const appBase = String(
    process.env.BASE_URL ??
      `http://127.0.0.1:${Number(process.env.E2E_WEB_PORT || '8085')}`,
  )
    .trim()
    .replace(/\/+$/, '')
  const sameCookieHost = (() => {
    try {
      return new URL(appBase).hostname === new URL(apiBase).hostname
    } catch {
      return false
    }
  })()
  const canRun =
    String(process.env.E2E_SUITE ?? '')
      .trim()
      .toLowerCase() === 'live-contract' &&
    process.env.E2E_ALLOW_LIVE_MUTATIONS === '1' &&
    Boolean(email && password && apiBase) &&
    (!appApiBase || appApiBase === apiBase) &&
    /^(?:http:\/\/localhost|http:\/\/127\.0\.0\.1)(?::\d+)?$/.test(apiBase) &&
    /^(?:http:\/\/localhost|http:\/\/127\.0\.0\.1)(?::\d+)?$/.test(appBase) &&
    sameCookieHost
  return { appBase, canRun }
}

const apiUrl = (apiCtx: LiveCookieApiContext, path: string): string =>
  new URL(path, `${apiCtx.appBase}/`).toString()

const csrfHeaders = (apiCtx: LiveCookieApiContext): Record<string, string> => ({
  'X-CSRFToken': apiCtx.csrfToken,
})

const readCookieApiContext = async (
  page: Page,
  env: ReturnType<typeof readLiveEnv>,
): Promise<LiveCookieApiContext> => {
  // live-contract global setup owns the only login. Reuse that state instead of
  // rotating the account token per test and invalidating sibling live specs.
  const cookies = await page.context().cookies(env.appBase)
  const authCookie = cookies.find((cookie) => cookie.name === 'authToken')
  const csrfCookie = cookies.find((cookie) => cookie.name === 'csrftoken')
  expect(
    authCookie,
    'required auth storageState must contain authToken',
  ).toBeTruthy()
  expect(authCookie?.httpOnly, 'browser auth cookie must remain HttpOnly').toBe(
    true,
  )
  expect(authCookie?.secure, 'browser auth cookie must remain Secure').toBe(
    true,
  )
  expect(
    csrfCookie,
    'cookie-authenticated mutations require csrftoken',
  ).toBeTruthy()

  const storageState = await page.context().storageState()
  const appOrigin = new URL(env.appBase).origin
  const appStorage = storageState.origins.find(
    (origin) => origin.origin === appOrigin,
  )
  const userId =
    appStorage?.localStorage.find((entry) => entry.name === 'userId')?.value ??
    ''
  expect(
    userId,
    'required auth storageState must contain non-secret user metadata',
  ).not.toBe('')

  const apiCtx: LiveCookieApiContext = {
    appBase: env.appBase,
    csrfToken: String(csrfCookie?.value ?? ''),
    request: page.context().request,
  }
  const probe = await apiCtx.request.get(
    apiUrl(apiCtx, '/api/user/me/verifications/'),
  )
  expect(
    probe.ok(),
    'global HttpOnly cookie session must be valid',
  ).toBeTruthy()
  return apiCtx
}

const readTravel = async (
  apiCtx: LiveCookieApiContext,
  travelId: number,
): Promise<Record<string, unknown>> => {
  const response = await apiCtx.request.get(
    apiUrl(apiCtx, `/api/travels/${travelId}/`),
  )
  expect(
    response.ok(),
    `travel ${travelId} must be readable through cookie auth`,
  ).toBeTruthy()
  return (await response.json()) as Record<string, unknown>
}

const upsertTravel = async (
  apiCtx: LiveCookieApiContext,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const response = await apiCtx.request.put(
    apiUrl(apiCtx, '/api/travels/upsert/'),
    {
      data: payload,
      headers: csrfHeaders(apiCtx),
    },
  )
  expect(
    response.ok(),
    `travel upsert must succeed, received ${response.status()}`,
  ).toBeTruthy()
  return (await response.json()) as Record<string, unknown>
}

const createTestTravel = async (
  apiCtx: LiveCookieApiContext,
  label: string,
  createdTravels: Set<string | number>,
): Promise<{
  travelId: number
  name: string
  initialPoints: PointSnapshot[]
}> => {
  const [filtersResponse, countriesResponse] = await Promise.all([
    apiCtx.request.get(apiUrl(apiCtx, '/api/getFiltersTravel/')),
    apiCtx.request.get(apiUrl(apiCtx, '/api/countries/')),
  ])
  expect(
    filtersResponse.ok(),
    'travel filters must load for live seed',
  ).toBeTruthy()
  expect(
    countriesResponse.ok(),
    'countries must load for live seed',
  ).toBeTruthy()
  const filters = (await filtersResponse.json()) as Record<string, unknown>
  const countriesRaw = (await countriesResponse.json()) as unknown

  const categoryId = firstId(filters.categoryTravelAddress)
  const countries =
    countriesRaw &&
    typeof countriesRaw === 'object' &&
    !Array.isArray(countriesRaw)
      ? ((countriesRaw as Record<string, unknown>).results ??
        (countriesRaw as Record<string, unknown>).data ??
        countriesRaw)
      : countriesRaw
  const countryId = firstId(countries)
  expect(categoryId, 'point category fixture is required').not.toBeNull()
  expect(countryId, 'country fixture is required').not.toBeNull()
  if (categoryId == null || countryId == null) {
    throw new Error('Local reference data is missing point category or country')
  }

  const unique = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`
  const name = `E2E #1603 ${label} ${unique}`
  const created = await upsertTravel(apiCtx, {
    id: null,
    name,
    description: `Локальный тестовый черновик #1603 (${label}) с двумя сохранёнными точками.`,
    categories: [],
    transports: [],
    month: [],
    complexity: [],
    companions: [],
    over_nights_stay: [],
    cities: [],
    countries: [countryId],
    budget: null,
    year: 2026,
    number_peoples: 1,
    number_days: 1,
    minus: null,
    plus: null,
    recommendation: null,
    youtube_link: null,
    visa: false,
    publish: false,
    moderation: false,
    gallery: [],
    thumbs200ForCollectionArr: [],
    travelImageThumbUrlArr: [],
    travelImageAddress: [],
    coordsMeTravel: [
      {
        id: null,
        lat: 53.90111,
        lng: 27.56111,
        country: countryId,
        address: `#1603 ${label} first`,
        categories: [categoryId],
        image: null,
      },
      {
        id: null,
        lat: 53.90222,
        lng: 27.56222,
        country: countryId,
        address: `#1603 ${label} second`,
        categories: [categoryId],
        image: null,
      },
    ],
  })

  const travelId = Number(created?.id)
  expect(
    Number.isInteger(travelId) && travelId > 0,
    'upsert must return a positive test travel id',
  ).toBeTruthy()
  // Register immediately: every assertion below can fail, but the auto fixture
  // must still know exactly which test-owned record needs fallback cleanup.
  createdTravels.add(travelId)
  const readback = await readTravel(apiCtx, travelId)
  const initialPoints = pointSnapshots(readback)
  expect(initialPoints).toHaveLength(2)
  expect(
    initialPoints.every((point) => Number.isInteger(point.id) && point.id > 0),
  ).toBeTruthy()
  expect(new Set(initialPoints.map((point) => point.id)).size).toBe(
    initialPoints.length,
  )
  expect(
    initialPoints.map(({ address, categories, country, lat, lng }) => ({
      address,
      categories,
      country,
      lat,
      lng,
    })),
  ).toEqual([
    {
      address: `#1603 ${label} first`,
      categories: [categoryId],
      country: countryId,
      lat: 53.90111,
      lng: 27.56111,
    },
    {
      address: `#1603 ${label} second`,
      categories: [categoryId],
      country: countryId,
      lat: 53.90222,
      lng: 27.56222,
    },
  ])
  return { travelId, name, initialPoints }
}

const seedBrowserAuth = async (page: Page, travelId: number): Promise<void> => {
  await page.addInitScript(seedNecessaryConsent)
  await page.addInitScript(
    (payload: { travelId: number }) => {
      try {
        Object.keys(window.localStorage)
          .filter((key) => key.startsWith('metravel_travel_draft_'))
          .forEach((key) => window.localStorage.removeItem(key))
        window.localStorage.removeItem('secure_userToken')
        window.localStorage.removeItem('secure_refreshToken')
        window.localStorage.setItem(
          `metravel_travel_wizard_step_${payload.travelId}`,
          JSON.stringify({ step: 2, timestamp: Date.now(), schemaVersion: 1 }),
        )
        delete (
          window as typeof window & { __METRAVEL_E2E_EXIF_GPS__?: unknown }
        ).__METRAVEL_E2E_EXIF_GPS__
      } catch {
        // Browser storage may be unavailable in a hardened context.
      }
    },
    { travelId },
  )
  await page.route(/\/proxy\/tiles\/osm\//, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: TILE_PNG,
    })
  })
  await page.route(
    'https://nominatim.openstreetmap.org/reverse**',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          display_name: 'Rynek Główny, Kraków, Polska',
          name: 'Rynek Główny',
          address: { country: 'Polska', country_code: 'pl', city: 'Kraków' },
        }),
      })
    },
  )
}

const openWizardRoute = async (
  page: Page,
  travelId: number,
  name: string,
  viewport: Viewport,
): Promise<void> => {
  await page.setViewportSize({ width: viewport.width, height: viewport.height })
  await seedBrowserAuth(page, travelId)
  await page.goto(`/travel/${travelId}`, { waitUntil: 'domcontentloaded' })
  const browserAuthState = await page.evaluate(() => ({
    authCookieVisible: document.cookie
      .split(';')
      .some((cookie) => cookie.trim().startsWith('authToken=')),
    secureRefreshToken: window.localStorage.getItem('secure_refreshToken'),
    secureUserToken: window.localStorage.getItem('secure_userToken'),
  }))
  expect(browserAuthState).toEqual({
    authCookieVisible: false,
    secureRefreshToken: null,
    secureUserToken: null,
  })
  await expect(page.getByPlaceholder('Например: Неделя в Грузии')).toHaveValue(
    name,
    {
      timeout: 30_000,
    },
  )

  const desktopCount = page.getByText(/^Точек:\s*2$/)
  const mobileShowPoints = page.getByRole('button', {
    name: /^Показать точки \(2\)$/i,
  })
  await expect(desktopCount.or(mobileShowPoints).first()).toBeVisible({
    timeout: 30_000,
  })
  if (
    viewport.label === 'mobile' &&
    (await mobileShowPoints.isVisible().catch(() => false))
  ) {
    await mobileShowPoints.click()
  }
  await expect(page.locator('#markers-list-panel [id^="marker-"]')).toHaveCount(
    2,
    {
      timeout: 30_000,
    },
  )
}

const openFirstPointEditor = async (page: Page): Promise<Locator> => {
  const markerCard = page.locator('#marker-0')
  await expect(markerCard).toBeVisible({ timeout: 30_000 })
  await markerCard
    .getByRole('button', { name: 'Редактировать', exact: true })
    .click()
  const imageLabel = page.getByText('Изображение точки', { exact: true })
  await expect(imageLabel).toBeVisible({ timeout: 15_000 })
  return imageLabel.locator('..').locator('..')
}

const gpsFilePayload = () => ({
  name: GPS_JPEG_NAME,
  mimeType: 'image/jpeg',
  buffer: GPS_JPEG,
})

const dispatchGpsJpegDrop = async (target: Locator): Promise<void> => {
  const dataTransfer = await target.evaluateHandle(
    (_element, payload: { base64: string; name: string }) => {
      const bytes = Uint8Array.from(atob(payload.base64), (char) =>
        char.charCodeAt(0),
      )
      const transfer = new DataTransfer()
      transfer.items.add(
        new File([bytes], payload.name, { type: 'image/jpeg' }),
      )
      return transfer
    },
    { base64: GPS_JPEG.toString('base64'), name: GPS_JPEG_NAME },
  )

  try {
    await target.dispatchEvent('dragenter', { dataTransfer })
    await target.dispatchEvent('dragover', { dataTransfer })
    await target.dispatchEvent('drop', { dataTransfer })
  } finally {
    await dataTransfer.dispose()
  }
}

const expectTravelPoints = async (
  apiCtx: LiveCookieApiContext,
  travelId: number,
  expected: PointSnapshot[],
): Promise<Record<string, unknown>> => {
  await expect
    .poll(async () => pointSnapshots(await readTravel(apiCtx, travelId)), {
      timeout: 30_000,
    })
    .toEqual(expected)
  return readTravel(apiCtx, travelId)
}

const expectExistingPointsUnchanged = (
  travel: Record<string, unknown>,
  initialPoints: PointSnapshot[],
): void => {
  expect(pointSnapshots(travel).slice(0, initialPoints.length)).toEqual(
    initialPoints,
  )
}

const cleanupTestTravel = async (
  apiCtx: LiveCookieApiContext,
  travelId: number | null,
  testInfo: TestInfo,
): Promise<void> => {
  if (travelId == null) return
  const deleteResponse = await apiCtx.request.delete(
    apiUrl(apiCtx, `/api/travels/${travelId}/`),
    {
      headers: csrfHeaders(apiCtx),
    },
  )
  expect(
    deleteResponse.ok() || deleteResponse.status() === 404,
    `test-created travel ${travelId} delete must succeed`,
  ).toBeTruthy()
  const response = await apiCtx.request.get(
    apiUrl(apiCtx, `/api/travels/${travelId}/`),
  )
  const cleanupStatus = response.status()
  expect(cleanupStatus, `test-created travel ${travelId} must be deleted`).toBe(
    404,
  )
  await testInfo.attach('cleanup', {
    body: Buffer.from(
      JSON.stringify({
        deleteStatus: deleteResponse.status(),
        readAfterDeleteStatus: cleanupStatus,
        travelId,
      }),
    ),
    contentType: 'application/json',
  })
}

test.describe('#1603 point-photo isolation live local contract', () => {
  const env = readLiveEnv()

  test.beforeAll(async () => {
    expect(
      env.canRun,
      'requires live-contract suite, local browser/API targets, matching EXPO_PUBLIC_API_URL, credentials, and E2E_ALLOW_LIVE_MUTATIONS=1',
    ).toBeTruthy()
    await mkdir(EVIDENCE_DIR, { recursive: true })
  })

  test.describe('desktop web', () => {
    test.use({ viewport: { width: 1440, height: 900 } })

    test('1440: portal drop is N→N and explicit Из фото is N→N+1 after reload', async ({
      page,
      createdTravels,
    }, testInfo) => {
      test.setTimeout(180_000)
      let travelId: number | null = null
      let apiCtx: LiveCookieApiContext | null = null

      try {
        apiCtx = await readCookieApiContext(page, env)
        const seeded = await createTestTravel(apiCtx, 'desktop', createdTravels)
        travelId = seeded.travelId
        const telemetry = installBrowserTelemetry(page)
        await openWizardRoute(page, travelId, seeded.name, {
          width: 1440,
          height: 900,
          label: 'desktop',
        })

        const modalEditor = await openFirstPointEditor(page)
        const modalFileInput = modalEditor.locator('input[type="file"]')
        await expect(modalFileInput).toBeAttached({ timeout: 15_000 })
        const existingUploadResponse = page.waitForResponse(
          (response) => isUploadRequest(response.request()),
          { timeout: 30_000 },
        )
        await dispatchGpsJpegDrop(modalFileInput.locator('..'))
        expect(
          (await existingUploadResponse).ok(),
          'existing-point image upload must succeed',
        ).toBeTruthy()
        expect(telemetry.uploads.at(-1)).toEqual({
          collection: 'travelImageAddress',
          filename: GPS_JPEG_NAME,
          id: String(seeded.initialPoints[0].id),
        })
        await expect(
          page.locator('#markers-list-panel [id^="marker-"]'),
        ).toHaveCount(2)

        const existingSaveResponse = page.waitForResponse(
          (response) => isUpsertRequest(response.request()),
          { timeout: 30_000 },
        )
        await modalEditor
          .getByRole('button', { name: 'Сохранить', exact: true })
          .click()
        expect(
          (await existingSaveResponse).ok(),
          'existing-point save must succeed',
        ).toBeTruthy()
        const afterExistingUpload = await readTravel(apiCtx, travelId)
        expectExistingPointsUnchanged(afterExistingUpload, seeded.initialPoints)
        expect(pointSnapshots(afterExistingUpload)).toHaveLength(2)
        const persistedExistingPoint = (
          afterExistingUpload.coordsMeTravel as Record<string, unknown>[]
        )[0]
        expect(String(persistedExistingPoint.image ?? '')).not.toBe('')

        await page.reload({ waitUntil: 'domcontentloaded' })
        await expect(page.getByText(/^Точек:\s*2$/)).toBeVisible({
          timeout: 30_000,
        })
        const afterExistingReload = await readTravel(apiCtx, travelId)
        expect(pointSnapshots(afterExistingReload)).toEqual(
          seeded.initialPoints,
        )

        const existingScreenshot = resolve(
          EVIDENCE_DIR,
          'desktop-existing-point-n-to-n.png',
        )
        await page.screenshot({ path: existingScreenshot, fullPage: true })
        await testInfo.attach('desktop-existing-point-n-to-n', {
          path: existingScreenshot,
          contentType: 'image/png',
        })

        const importInput = page
          .locator('#markers-list-panel input[type="file"]')
          .first()
        await expect(importInput).toBeAttached()
        const explicitUpsertResponse = page.waitForResponse(
          (response) => isUpsertRequest(response.request()),
          { timeout: 45_000 },
        )
        const explicitUploadResponse = page.waitForResponse(
          (response) =>
            isUploadRequest(response.request()) &&
            uploadRecord(response.request()).id !==
              String(seeded.initialPoints[0].id),
          { timeout: 45_000 },
        )
        await importInput.setInputFiles(gpsFilePayload())
        expect(
          (await explicitUpsertResponse).ok(),
          'explicit photo point save must succeed',
        ).toBeTruthy()
        expect(
          (await explicitUploadResponse).ok(),
          'explicit photo point upload must succeed',
        ).toBeTruthy()

        await expect(
          page.locator('#markers-list-panel [id^="marker-"]'),
        ).toHaveCount(3, {
          timeout: 30_000,
        })
        await expect
          .poll(
            async () =>
              pointSnapshots(await readTravel(apiCtx!, travelId!)).length,
            {
              timeout: 30_000,
            },
          )
          .toBe(3)
        const afterExplicitImport = await readTravel(apiCtx, travelId)
        expectExistingPointsUnchanged(afterExplicitImport, seeded.initialPoints)
        const afterExplicitPoints = pointSnapshots(afterExplicitImport)
        const importedPoint = afterExplicitPoints[2]
        expect(Number.isInteger(importedPoint.id) && importedPoint.id > 0).toBe(
          true,
        )
        expect(seeded.initialPoints.map((point) => point.id)).not.toContain(
          importedPoint.id,
        )
        expect(importedPoint.lat).toBeCloseTo(GPS_LAT, 5)
        expect(importedPoint.lng).toBeCloseTo(GPS_LNG, 5)
        expect(
          Number.isInteger(importedPoint.country) &&
            Number(importedPoint.country) > 0,
        ).toBe(true)
        expect(importedPoint.address).not.toBe('')
        expect(importedPoint.categories).toEqual([])
        const importedPointRaw = (
          afterExplicitImport.coordsMeTravel as Record<string, unknown>[]
        )[2]
        expect(String(importedPointRaw.image ?? '')).not.toBe('')
        const explicitUpload = telemetry.uploads.at(-1)
        expect(explicitUpload?.collection).toBe('travelImageAddress')
        expect(explicitUpload?.id).toBe(String(importedPoint.id))

        await page.reload({ waitUntil: 'domcontentloaded' })
        await expect(page.getByText(/^Точек:\s*3$/)).toBeVisible({
          timeout: 30_000,
        })
        const afterExplicitReload = await readTravel(apiCtx, travelId)
        expect(pointSnapshots(afterExplicitReload)).toEqual(afterExplicitPoints)
        expect(telemetry.uploads).toHaveLength(2)
        expect(
          telemetry.mutationResponses.filter(({ method }) => method === 'POST'),
        ).toHaveLength(2)
        expect(
          telemetry.mutationResponses.every(({ status }) => status < 400),
        ).toBe(true)
        expectCleanTelemetry(telemetry)

        const explicitScreenshot = resolve(
          EVIDENCE_DIR,
          'desktop-explicit-photo-n-to-n-plus-one.png',
        )
        await page.screenshot({ path: explicitScreenshot, fullPage: true })
        await testInfo.attach('desktop-explicit-photo-n-to-n-plus-one', {
          path: explicitScreenshot,
          contentType: 'image/png',
        })
        await testInfo.attach('desktop-network-contract', {
          body: Buffer.from(
            JSON.stringify({
              uploads: telemetry.uploads,
              mutationResponses: telemetry.mutationResponses,
              upsertCount: telemetry.upserts.length,
              finalErrors: {
                console: telemetry.consoleErrors,
                failedRequests: telemetry.failedRequests,
                http: telemetry.httpErrors,
                tokenHeaderRequests: telemetry.tokenHeaderRequests,
              },
              initialPoints: seeded.initialPoints,
              finalPoints: pointSnapshots(afterExplicitReload),
            }),
          ),
          contentType: 'application/json',
        })
      } finally {
        if (apiCtx) {
          await cleanupTestTravel(apiCtx, travelId, testInfo)
          if (travelId != null) createdTravels.delete(travelId)
        }
      }
    })
  })

  test.describe('mobile web', () => {
    test.use({
      ...PIXEL_7_MOBILE_WEB,
      viewport: { width: 390, height: 844 },
    })

    test('390x844: cancel and upload error keep N; gallery retry saves N→N after reload', async ({
      page,
      createdTravels,
    }, testInfo) => {
      test.setTimeout(180_000)
      let travelId: number | null = null
      let apiCtx: LiveCookieApiContext | null = null

      try {
        apiCtx = await readCookieApiContext(page, env)
        const seeded = await createTestTravel(apiCtx, 'mobile', createdTravels)
        travelId = seeded.travelId
        const telemetry = installBrowserTelemetry(page)
        await openWizardRoute(page, travelId, seeded.name, {
          width: 390,
          height: 844,
          label: 'mobile',
        })

        const uploadCountBeforeCancel = telemetry.uploads.length
        const upsertCountBeforeCancel = telemetry.upserts.length
        let modalEditor = await openFirstPointEditor(page)
        const cancelledPickerInput = modalEditor.getByTestId(
          'photo-upload-mobile-gallery-input',
        )
        await expect(cancelledPickerInput).toBeAttached()
        // A dismissed system picker fires no selected file. Dispatching change on
        // the untouched input exercises that exact empty FileList branch.
        await cancelledPickerInput.dispatchEvent('change')
        await page.waitForTimeout(500)
        expect(telemetry.uploads).toHaveLength(uploadCountBeforeCancel)
        expect(telemetry.upserts).toHaveLength(upsertCountBeforeCancel)
        await expectTravelPoints(apiCtx, travelId, seeded.initialPoints)

        await modalEditor
          .getByRole('button', { name: 'Отмена', exact: true })
          .click()
        await expect(
          page.getByText('Изображение точки', { exact: true }),
        ).toBeHidden()
        await page.waitForTimeout(500)
        expect(telemetry.uploads).toHaveLength(uploadCountBeforeCancel)
        expect(telemetry.upserts).toHaveLength(upsertCountBeforeCancel)
        await expectTravelPoints(apiCtx, travelId, seeded.initialPoints)
        expectCleanTelemetry(telemetry)

        modalEditor = await openFirstPointEditor(page)
        const errorInput = modalEditor.getByTestId(
          'photo-upload-mobile-gallery-input',
        )
        await expect(errorInput).toBeAttached()
        const uploadCountBeforeError = telemetry.uploads.length
        const upsertCountBeforeError = telemetry.upserts.length
        const errorCountsBeforeUpload = telemetryErrorCounts(telemetry)
        const failUpload = async (route: Route) => {
          await route.fulfill({
            status: 422,
            contentType: 'application/json',
            body: JSON.stringify({
              detail: 'intentional #1603 upload failure',
            }),
          })
        }
        await page.route(/\/(?:api\/)?upload\/?(?:\?|$)/, failUpload)
        const failedUploadResponse = page.waitForResponse(
          (response) =>
            isUploadRequest(response.request()) && response.status() === 422,
          { timeout: 30_000 },
        )
        await errorInput.setInputFiles(gpsFilePayload())
        await failedUploadResponse
        await expect(
          page.getByText(/Произошла ошибка при загрузке/i),
        ).toBeVisible({
          timeout: 15_000,
        })
        await expect(
          page.locator('#markers-list-panel [id^="marker-"]'),
        ).toHaveCount(2)
        await expectTravelPoints(apiCtx, travelId, seeded.initialPoints)
        expect(telemetry.uploads).toHaveLength(uploadCountBeforeError + 1)
        expect(telemetry.upserts).toHaveLength(upsertCountBeforeError)
        const expectedFailureHttpErrors = telemetry.httpErrors.slice(
          errorCountsBeforeUpload.httpErrors,
        )
        const expectedFailureConsoleErrors = telemetry.consoleErrors.slice(
          errorCountsBeforeUpload.consoleErrors,
        )
        const expectedFailureRequestErrors = telemetry.failedRequests.slice(
          errorCountsBeforeUpload.failedRequests,
        )
        expect(expectedFailureHttpErrors).toHaveLength(1)
        expect(expectedFailureHttpErrors[0]).toMatch(/POST .*\/api\/upload\/? .*422$/)
        expect(expectedFailureConsoleErrors.length).toBeGreaterThan(0)
        expect(
          expectedFailureConsoleErrors.every((entry) =>
            entry.includes('Ошибка при загрузке'),
          ),
        ).toBe(true)
        expect(expectedFailureRequestErrors).toEqual([])
        const expectedUploadFailure = {
          consoleErrors: expectedFailureConsoleErrors,
          failedRequests: expectedFailureRequestErrors,
          httpErrors: expectedFailureHttpErrors,
        }

        await page.unroute(/\/(?:api\/)?upload\/?(?:\?|$)/, failUpload)
        restoreTelemetryErrorCounts(telemetry, errorCountsBeforeUpload)
        const successfulUploadResponse = page.waitForResponse(
          (response) =>
            isUploadRequest(response.request()) && response.status() < 400,
          { timeout: 30_000 },
        )
        await errorInput.setInputFiles(gpsFilePayload())
        expect(
          (await successfulUploadResponse).ok(),
          'mobile gallery upload retry must succeed',
        ).toBeTruthy()
        expect(telemetry.uploads).toHaveLength(uploadCountBeforeError + 2)
        expect(telemetry.uploads.at(-1)).toEqual({
          collection: 'travelImageAddress',
          filename: GPS_JPEG_NAME,
          id: String(seeded.initialPoints[0].id),
        })

        const saveResponse = page.waitForResponse(
          (response) => isUpsertRequest(response.request()),
          { timeout: 30_000 },
        )
        await modalEditor
          .getByRole('button', { name: 'Сохранить', exact: true })
          .click()
        expect(
          (await saveResponse).ok(),
          'mobile existing-point save must succeed',
        ).toBeTruthy()
        const afterMobileSave = await readTravel(apiCtx, travelId)
        expectExistingPointsUnchanged(afterMobileSave, seeded.initialPoints)
        const afterMobileSavePoints = pointSnapshots(afterMobileSave)
        expect(afterMobileSavePoints).toHaveLength(2)
        const mobilePointRaw = (
          afterMobileSave.coordsMeTravel as Record<string, unknown>[]
        )[0]
        expect(String(mobilePointRaw.image ?? '')).not.toBe('')

        await page.reload({ waitUntil: 'domcontentloaded' })
        const showPointsButton = page.getByRole('button', {
          name: /^Показать точки \(2\)$/i,
        })
        await expect(showPointsButton).toBeVisible({ timeout: 30_000 })
        await showPointsButton.click()
        await expect(
          page.locator('#markers-list-panel [id^="marker-"]'),
        ).toHaveCount(2)
        const afterMobileReload = await readTravel(apiCtx, travelId)
        expect(pointSnapshots(afterMobileReload)).toEqual(afterMobileSavePoints)
        const mobileUploadStatuses = telemetry.mutationResponses
          .filter(({ method }) => method === 'POST')
          .map(({ status }) => status)
        expect(mobileUploadStatuses).toHaveLength(2)
        expect(mobileUploadStatuses[0]).toBe(422)
        expect(mobileUploadStatuses[1]).toBeGreaterThanOrEqual(200)
        expect(mobileUploadStatuses[1]).toBeLessThan(400)
        expect(
          telemetry.mutationResponses.some(
            ({ method, status }) => method === 'PUT' && status < 400,
          ),
        ).toBe(true)
        expectCleanTelemetry(telemetry)

        const mobileScreenshot = resolve(
          EVIDENCE_DIR,
          'mobile-cancel-error-retry-n-to-n.png',
        )
        await page.screenshot({ path: mobileScreenshot, fullPage: true })
        await testInfo.attach('mobile-cancel-error-retry-n-to-n', {
          path: mobileScreenshot,
          contentType: 'image/png',
        })
        await testInfo.attach('mobile-network-contract', {
          body: Buffer.from(
            JSON.stringify({
              uploads: telemetry.uploads,
              mutationResponses: telemetry.mutationResponses,
              upsertCount: telemetry.upserts.length,
              expectedUploadFailure,
              finalErrors: {
                console: telemetry.consoleErrors,
                failedRequests: telemetry.failedRequests,
                http: telemetry.httpErrors,
                tokenHeaderRequests: telemetry.tokenHeaderRequests,
              },
              initialPoints: seeded.initialPoints,
              finalPoints: pointSnapshots(afterMobileReload),
            }),
          ),
          contentType: 'application/json',
        })
      } finally {
        if (apiCtx) {
          await cleanupTestTravel(apiCtx, travelId, testInfo)
          if (travelId != null) createdTravels.delete(travelId)
        }
      }
    })
  })
})
