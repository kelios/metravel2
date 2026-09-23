import type { Locator, Page } from '@playwright/test'

import { expect, test } from './fixtures'
import { ensureAuthedStorageFallback, mockFakeAuthApis } from './helpers/auth'

/**
 * #2053 — ни одна подпись кнопки во вкладке «Маршрут» не обрезана.
 *
 * Замер на проде (trip 47, 23.09.2026): текстовых узлов внутри кнопок вкладки
 * со `scrollWidth > clientWidth` было 5 на 320, 5 на 390 и 4 на 1440, а на 320
 * «GPX» и «KML» сжимались до 0 px. Причина — правило слоя `ToolActionsRow`
 * (`flexShrink: 1` у подписанной кнопки в непереносимом ряду), поэтому guard
 * меряет ВСЕ кнопки вкладки, а не список известных: новая обрезанная подпись
 * где угодно во вкладке валит спеку. Раскладка блока «Файл маршрута» — макет
 * `docs/features/trips-plan-route-tab-mock.md` §0 и §1.
 *
 * Бэкенд замокан: спека детерминирована и гоняется на собранном `dist`.
 */

const TRIP_ID = 205301
const ORIGINAL_ID = 7
const ORIGINAL_NAME = 'Mullerthal_Trail_Routes_1-3.kml'
const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

const VIEWPORTS = [
  { name: 'mobile-320', width: 320, height: 800 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'desktop-1440', width: 1440, height: 900 },
] as const

// Кнопки, до которых guard обязан дойти: без них «0 обрезанных» ничего бы не
// доказывало.
const REQUIRED_BUTTONS = [
  'trip-route-import-picker',
  'trip-route-export-gpx',
  'trip-route-export-kml',
  'trip-route-import-download-original',
  'trip-route-import-remove-original',
  'route-order-suggest',
]

// Точки Mullerthal Trail, как в поездке владельца trip 47: пешком, у каждой
// координаты; точек больше четырёх — кнопка подбора порядка доступна.
const savedPoints = [
  { title: 'Эхтернах', lat: 49.8117, lng: 6.4214 },
  { title: 'Бердорф', lat: 49.8206, lng: 6.3508 },
  { title: 'Мюллерталь', lat: 49.7897, lng: 6.3208 },
  { title: 'Консдорф', lat: 49.7797, lng: 6.3372 },
  { title: 'Шейдген', lat: 49.77, lng: 6.378 },
].map((point, index) => ({
  id: index + 1,
  point_type: 'custom',
  order: index + 1,
  description: '',
  ...point,
}))

// Проложенная линия с промежуточными вершинами: маршрут «здоровый», превью
// не перестраивает его и не шлёт запросов к маршрутизатору.
const routeGeometry = savedPoints.flatMap((point, index) => {
  const next = savedPoints[index + 1]
  if (!next) return [[point.lng, point.lat]]
  return [0, 0.5].map((step) => [
    point.lng + (next.lng - point.lng) * step,
    point.lat + (next.lat - point.lat) * step,
  ])
})

const tripDto = {
  id: TRIP_ID,
  title: 'E2E подписи вкладки «Маршрут»',
  description: '',
  start_date: '2026-10-03T09:00:00',
  status: 'planned',
  transport_mode: 'walk',
  bike_type: 'regular',
  owner: 1,
  participants: [],
  route: { points: savedPoints },
  route_geometry: routeGeometry,
  route_summary: {
    distance_km: 38.4,
    duration_min: 540,
    elevation_gain_m: 0,
    stops_count: savedPoints.length - 2,
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

// Сохранённый оригинал — ответ `GET /api/trips/planned/{id}/routes/`.
const storedOriginal = {
  id: ORIGINAL_ID,
  original_name: ORIGINAL_NAME,
  ext: 'kml',
  size: 185548,
  created_at: '2026-09-20T08:00:00Z',
  updated_at: '2026-09-20T08:00:00Z',
}

const originalKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Mullerthal Trail</name>
<Placemark><name>Route 1</name><LineString><coordinates>
${savedPoints.map((point) => `${point.lng},${point.lat},0`).join(' ')}
</coordinates></LineString></Placemark></Document></kml>`

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
      // Хранилище может быть недоступно до первого документа — helper'ы
      // авторизации проставят то же значение на origin приложения.
    }
  })

const waitForFakeAuth = (page: Page) =>
  expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('userId')), {
      timeout: 15_000,
    })
    .toBe('1')

async function mockOwnerTripWithOriginal(page: Page) {
  await ensureAuthedStorageFallback(page)
  await mockFakeAuthApis(page)
  await seedConsent(page)

  await page.route('**/proxy/tiles/osm/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: TRANSPARENT_PNG }),
  )
  await page.route('**/api/trips/route-templates/', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  await page.route(`**/api/trips/planned/${TRIP_ID}/routes/`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([storedOriginal]),
    }),
  )
  await page.route(`**/api/trips/planned/${TRIP_ID}/routes/${ORIGINAL_ID}/download/`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/vnd.google-earth.kml+xml',
      headers: { 'Content-Disposition': `attachment; filename="${ORIGINAL_NAME}"` },
      body: originalKml,
    }),
  )
  // Сводка без высот и не от ORS: экран не запускает пересчёт профиля.
  await page.route(`**/api/trips/${TRIP_ID}/route-summary/`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ trip: TRIP_ID, provider: 'fallback', status: 'unavailable', polyline: null }),
    }),
  )
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
  await page.route('**/api/routing/route/', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        geometry: routeGeometry,
        distance_m: 38_400,
        duration_s: 32_400,
        provider: 'ors',
        is_optimal: true,
        fallback_reason: null,
        warnings: [],
      }),
    }),
  )
}

type ClippedLabel = {
  button: string
  text: string
  scrollWidth: number
  clientWidth: number
  scrollHeight: number
  clientHeight: number
}

type LabelAudit = {
  buttons: number
  labels: number
  measuredTestIds: string[]
  clipped: ClippedLabel[]
}

/**
 * Замер как на проде: у каждого элемента внутри кнопки, который сам держит
 * текст, нужная ширина `scrollWidth` не больше видимой `clientWidth` (+1 px на
 * округление). Многоточие и сжатие до нуля дают `scrollWidth > clientWidth`.
 * Высота меряется так же: слой переносит длинную подпись, но держит её в двух
 * строках (`labelNumberOfLines={2}`), и подпись, которой нужна третья строка,
 * срезается по высоте — это такая же обрезка.
 */
const auditButtonLabels = (panel: Locator) =>
  panel.evaluate((root): LabelAudit => {
    const buttons = Array.from(root.querySelectorAll<HTMLElement>('[role="button"], button'))
    const clipped: ClippedLabel[] = []
    const measuredTestIds: string[] = []
    let labels = 0

    for (const button of buttons) {
      const testId = button.getAttribute('data-testid')
      if (testId) measuredTestIds.push(testId)
      const nodes = [button, ...Array.from(button.querySelectorAll<HTMLElement>('*'))]
      for (const node of nodes) {
        const ownText = Array.from(node.childNodes)
          .filter((child) => child.nodeType === Node.TEXT_NODE)
          .map((child) => child.textContent ?? '')
          .join('')
          .trim()
        if (!ownText) continue
        labels += 1
        const clippedWidth = node.scrollWidth > node.clientWidth + 1
        const clippedHeight = node.scrollHeight > node.clientHeight + 1
        if (clippedWidth || clippedHeight) {
          clipped.push({
            button: testId ?? button.getAttribute('aria-label') ?? '',
            text: ownText,
            scrollWidth: node.scrollWidth,
            clientWidth: node.clientWidth,
            scrollHeight: node.scrollHeight,
            clientHeight: node.clientHeight,
          })
        }
      }
    }

    return { buttons: buttons.length, labels, measuredTestIds, clipped }
  })

const box = async (locator: Locator) => {
  const value = await locator.boundingBox()
  expect(value, 'element has a layout box').not.toBeNull()
  return value as NonNullable<typeof value>
}

test.describe('Planned trip route tab — button labels are never clipped (#2053)', () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.name}: every button label in the route tab fits`, async ({ page }, testInfo) => {
      await mockOwnerTripWithOriginal(page)
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto(`/trips/plan/${TRIP_ID}`, { waitUntil: 'domcontentloaded' })
      await waitForFakeAuth(page)

      const panel = page.getByTestId('trip-plan-panel-route').first()
      await expect(panel).toBeVisible({ timeout: 30_000 })
      const block = panel.getByTestId('route-builder-route-file').first()
      const card = block.getByTestId('trip-route-import-stored-original')
      await expect(card).toBeVisible({ timeout: 30_000 })
      await expect(panel.getByTestId('route-order-suggest').first()).toBeVisible()
      // Ширина подписи зависит от шрифта: меряем после его загрузки.
      await page.evaluate(async () => {
        await document.fonts.ready
      })

      const audit = await auditButtonLabels(panel)
      expect(audit.measuredTestIds).toEqual(expect.arrayContaining(REQUIRED_BUTTONS))
      expect(audit.labels).toBeGreaterThan(REQUIRED_BUTTONS.length)
      expect(audit.clipped, `clipped labels among ${audit.buttons} buttons`).toEqual([])

      // Блок «Файл маршрута» по макету §1: импорт во всю ширину, под ним GPX и
      // KML одной ширины (одна строка поровну или по строке каждая), ниже —
      // карточка оригинала.
      const importBox = await box(block.getByTestId('trip-route-import-picker'))
      const gpxBox = await box(block.getByTestId('trip-route-export-gpx'))
      const kmlBox = await box(block.getByTestId('trip-route-export-kml'))
      const cardBox = await box(card)
      expect(Math.abs(gpxBox.width - kmlBox.width)).toBeLessThanOrEqual(2)
      const rowLeft = Math.min(gpxBox.x, kmlBox.x)
      const rowRight = Math.max(gpxBox.x + gpxBox.width, kmlBox.x + kmlBox.width)
      expect(Math.abs(importBox.x - rowLeft)).toBeLessThanOrEqual(1)
      expect(Math.abs(importBox.x + importBox.width - rowRight)).toBeLessThanOrEqual(1)
      expect(importBox.y + importBox.height).toBeLessThanOrEqual(Math.min(gpxBox.y, kmlBox.y) + 1)
      expect(Math.max(gpxBox.y + gpxBox.height, kmlBox.y + kmlBox.height)).toBeLessThanOrEqual(
        cardBox.y + 1,
      )

      // Скачивание оригинала — в его карточке; строки-дубля с именем файла нет,
      // а само имя видно целиком, до двух строк.
      await expect(card.getByTestId('trip-route-import-download-original')).toHaveAccessibleName(
        'Скачать оригинал',
      )
      await expect(block.getByTestId('trip-route-original-download-block')).toHaveCount(0)
      await expect(block.getByText(/Исходный файл маршрута/)).toHaveCount(0)
      const nameFits = await card
        .getByText(ORIGINAL_NAME, { exact: true })
        .evaluate((node) => ({
          width: node.scrollWidth <= node.clientWidth + 1,
          height: node.scrollHeight <= node.clientHeight + 1,
        }))
      expect(nameFits).toEqual({ width: true, height: true })

      await block.screenshot({ path: testInfo.outputPath(`route-file-${viewport.width}.png`) })
    })
  }
})
