import type { Page } from '@playwright/test'

import { expect } from '../fixtures'
import { ensureAuthedStorageFallback, mockFakeAuthApis } from './auth'
import { seedNecessaryConsent } from './storage'

/**
 * Общая фикстура «крупная поездка» планировщика (#2058, её же берут #2059 про
 * карту и #2060 про шапку): форма поездки владельца trip 47 на проде
 * (23.09.2026) — 61 точка в 17 днях, описание 6 274 знака, загруженный KML.
 * Координаты синтетические: день 1 — Краков, день 2 — Мюнхен после ночного
 * поезда, дни 3–17 — горный поход, каждый день в своём квадрате ~10 км.
 *
 * Бэкенд замокан целиком (`mockLargePlannedTrip`), поэтому спеки на фикстуре
 * детерминированы и гоняются на собранном `dist` под fake auth.
 */

export const LARGE_TRIP_ID = 205801
export const LARGE_TRIP_START_DATE = '2026-09-25'
/** Точек в каждом из 17 дней: сумма 61. */
export const LARGE_TRIP_DAY_SIZES = [1, 3, 6, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3] as const
export const LARGE_TRIP_POINT_COUNT = 61
export const LARGE_TRIP_DESCRIPTION_LENGTH = 6274
export const LARGE_TRIP_ORIGINAL_ID = 58
export const LARGE_TRIP_ORIGINAL_NAME = 'Alpine_Traverse_17_days.kml'

const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

type FixturePoint = {
  id: number
  point_type: 'custom' | 'overnight'
  order: number
  title: string
  description: string
  lat: number
  lng: number
  day_number: number
}

const coordinatesFor = (day: number, slot: number): { lat: number; lng: number } => {
  if (day === 1) return { lat: 50.0647, lng: 19.945 }
  if (day === 2) {
    return [
      { lat: 48.1402, lng: 11.5601 },
      { lat: 48.1374, lng: 11.5755 },
      { lat: 48.1642, lng: 11.6056 },
    ][slot]
  }
  // Горный поход: день сдвигается на восток, точки дня — на северо-восток.
  return {
    lat: Number((47.45 + ((day - 3) % 3) * 0.02 + slot * 0.03).toFixed(4)),
    lng: Number((12.0 + (day - 3) * 0.18 + slot * 0.04).toFixed(4)),
  }
}

export const largeTripPoints: FixturePoint[] = LARGE_TRIP_DAY_SIZES.flatMap((size, dayIndex) =>
  Array.from({ length: size }, (_, slot) => ({ day: dayIndex + 1, slot })),
).map(({ day, slot }, index) => ({
  id: index + 1,
  // Последняя точка каждого дня — ночёвка, как в поездке владельца.
  point_type: slot === LARGE_TRIP_DAY_SIZES[day - 1] - 1 ? 'overnight' : 'custom',
  order: index + 1,
  title: day === 1 ? 'Ночь 1 · ночной поезд Краков → Мюнхен' : `День ${day} · точка ${slot + 1}`,
  description: slot === 0 ? `Старт дня ${day}: вода, перекус, проверить прогноз.` : '',
  ...coordinatesFor(day, slot),
  day_number: day,
}))

/** Индексы (0-based, порядок маршрута) точек дня `day`. */
export const largeTripDayIndices = (day: number): number[] =>
  largeTripPoints.flatMap((point, index) => (point.day_number === day ? [index] : []))

const DESCRIPTION_PARAGRAPH =
  'Поход через перевалы с ночёвками в хижинах. Воду набирать в каждой хижине, ' +
  'запас на два часа. На гребне ветер, куртка обязательна. Спуск в долину по ' +
  'серпантину занимает дольше, чем кажется по карте. '

export const LARGE_TRIP_DESCRIPTION = DESCRIPTION_PARAGRAPH.repeat(
  Math.ceil(LARGE_TRIP_DESCRIPTION_LENGTH / DESCRIPTION_PARAGRAPH.length),
).slice(0, LARGE_TRIP_DESCRIPTION_LENGTH)

const routeGeometry = largeTripPoints.map((point) => [point.lng, point.lat])

export const LARGE_TRIP_KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Alpine traverse</name>
<Placemark><name>Track</name><LineString><coordinates>
${largeTripPoints.map((point) => `${point.lng},${point.lat},0`).join(' ')}
</coordinates></LineString></Placemark></Document></kml>`

export const largeTripStoredOriginal = {
  id: LARGE_TRIP_ORIGINAL_ID,
  original_name: LARGE_TRIP_ORIGINAL_NAME,
  ext: 'kml',
  size: LARGE_TRIP_KML.length,
  created_at: '2026-09-20T08:00:00Z',
  updated_at: '2026-09-20T08:00:00Z',
}

export const largeTripDto = {
  id: LARGE_TRIP_ID,
  title: 'E2E крупная поездка: 61 точка, 17 дней',
  description: LARGE_TRIP_DESCRIPTION,
  start_date: `${LARGE_TRIP_START_DATE}T21:40:00`,
  status: 'planned',
  transport_mode: 'walk',
  bike_type: 'regular',
  owner: 1,
  participants: [],
  route: { points: largeTripPoints },
  route_geometry: routeGeometry,
  route_summary: {
    distance_km: 1128.4,
    duration_min: 15600,
    elevation_gain_m: 0,
    stops_count: LARGE_TRIP_POINT_COUNT,
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

export const waitForFakeAuth = (page: Page) =>
  expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('userId')), {
      timeout: 15_000,
    })
    .toBe('1')

/**
 * Владелец (fake auth, userId 1) открывает свою крупную поездку. Мокаются
 * поездка, список файлов маршрута с загруженным KML и его скачивание, сводка
 * маршрута без высот, шаблоны, маршрутизатор и тайлы.
 */
export async function mockLargePlannedTrip(page: Page): Promise<void> {
  await ensureAuthedStorageFallback(page)
  await mockFakeAuthApis(page)
  await page.addInitScript(seedNecessaryConsent)

  await page.route('**/proxy/tiles/osm/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: TRANSPARENT_PNG }),
  )
  await page.route('**/api/trips/route-templates/', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  await page.route(`**/api/trips/planned/${LARGE_TRIP_ID}/routes/`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([largeTripStoredOriginal]),
    }),
  )
  await page.route(
    `**/api/trips/planned/${LARGE_TRIP_ID}/routes/${LARGE_TRIP_ORIGINAL_ID}/download/`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/vnd.google-earth.kml+xml',
        headers: { 'Content-Disposition': `attachment; filename="${LARGE_TRIP_ORIGINAL_NAME}"` },
        body: LARGE_TRIP_KML,
      }),
  )
  // Сводка без высот и не от ORS: экран не запускает пересчёт профиля.
  await page.route(`**/api/trips/${LARGE_TRIP_ID}/route-summary/`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ trip: LARGE_TRIP_ID, provider: 'fallback', status: 'unavailable', polyline: null }),
    }),
  )
  await page.route(`**/api/trips/planned/${LARGE_TRIP_ID}/`, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }
    await waitForFakeAuth(page)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(largeTripDto),
    })
  })
  await page.route('**/api/routing/route/', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        geometry: routeGeometry,
        distance_m: 1_128_400,
        duration_s: 936_000,
        provider: 'ors',
        is_optimal: true,
        fallback_reason: null,
        warnings: [],
      }),
    }),
  )
}
