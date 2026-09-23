import type { Page } from '@playwright/test'

import { expect, test } from './fixtures'
import {
  LARGE_TRIP_DAY_SIZES,
  LARGE_TRIP_ID,
  LARGE_TRIP_POINT_COUNT,
  largeTripDayIndices,
  largeTripDto,
  mockLargePlannedTrip,
  routeMapMarkers,
  waitForFakeAuth,
  waitForSettledRouteMap,
} from './helpers/largePlannedTripFixture'

/**
 * #2059 — карта вкладки «Маршрут» на крупной поездке. Норматив —
 * `docs/features/trips-plan-route-tab-mock.md` §4.
 *
 * Замер на проде (trip 47, 61 точка, 23.09.2026): маркеры без номеров и без
 * кластеров слипались в 5–6 пятен; над картой было 6 строк текста; на
 * 1440×900 карта была ~390 px в высоту в колонке 464 px, потому что весь экран
 * держал ширину 860 px. Пороги: одиночных маркеров на общем виде ≤ 15, номера
 * после приближения = номера списка, шапка карты ≤ 3 строк, высота
 * `.leaflet-container` на 1440×900 ≥ 600 px при шапке поездки 860 px.
 *
 * Бэкенд замокан общей фикстурой крупной поездки (#2058) — спека
 * детерминирована и гоняется на собранном `dist`.
 */

const DAY_COUNT = LARGE_TRIP_DAY_SIZES.length
const MAX_SINGLE_MARKERS_OVERVIEW = 15
const MAX_HEADER_LINES = 3
const DESKTOP_MAP_MIN_HEIGHT = 600
const TRIP_HEADER_WIDTH = 860

async function openLargeTrip(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport)
  await page.goto(`/trips/plan/${LARGE_TRIP_ID}`, { waitUntil: 'domcontentloaded' })
  await waitForFakeAuth(page)
  await expect(page.getByTestId('trip-plan-panel-route').first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId(`route-builder-day-toggle-${DAY_COUNT}`)).toBeAttached({ timeout: 30_000 })
}

/**
 * Строки текста шапки карты — по рамкам строк текста, а не по числу узлов:
 * перенос длинной причины тоже считается строкой. Рамки одной строки (чипы
 * и счётчик с разными отступами) склеиваются по вертикали с допуском.
 */
const headerTextLines = (page: Page) =>
  page.evaluate(() => {
    const header = document.querySelector<HTMLElement>('[data-testid="trip-plan-map-header"]')
    if (!header) return { rows: -1, lines: -1 }
    const centers: number[] = []
    const walker = document.createTreeWalker(header, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim()) continue
      const range = document.createRange()
      range.selectNodeContents(node)
      for (const rect of Array.from(range.getClientRects())) {
        if (rect.width > 0 && rect.height > 0) centers.push(rect.top + rect.height / 2)
      }
    }
    centers.sort((a, b) => a - b)
    let lines = 0
    let last = Number.NEGATIVE_INFINITY
    for (const center of centers) {
      if (center - last > 8) lines += 1
      last = center
    }
    return { rows: header.children.length, lines }
  })

const width = async (page: Page, testId: string) =>
  Math.round((await page.getByTestId(testId).first().boundingBox())?.width ?? Number.NaN)

test.describe('Planned trip route tab — numbered markers, clusters and a large desktop map (#2059)', () => {
  test('desktop-1440: workspace 1 200 px, map ≥ 600 px, header ≤ 3 lines, clusters and list numbers', async ({
    page,
  }, testInfo) => {
    await mockLargePlannedTrip(page)
    await openLargeTrip(page, { width: 1440, height: 900 })

    const mapScope = 'route-builder-map-column'
    const overview = await waitForSettledRouteMap(page, mapScope)

    // Размеры: шапка поездки 860, рабочая область «Маршрута» до 1 200, карта высокая.
    const coverWidth = await width(page, 'trip-plan-cover')
    const tabsWidth = await width(page, 'trip-plan-tabs')
    const panelWidth = await width(page, 'trip-plan-panel-route')
    const mapHeight = Math.round(overview.container?.height ?? Number.NaN)
    const mapWidth = Math.round(overview.container?.width ?? Number.NaN)
    const header = await headerTextLines(page)
    const clusteredPoints = overview.clusters.reduce((sum, cluster) => sum + cluster.count, 0)
    const measure = `1440x900: cover ${coverWidth}px, tabs ${tabsWidth}px, route panel ${panelWidth}px, ` +
      `map ${mapWidth}x${mapHeight}px, header rows ${header.rows} lines ${header.lines}, ` +
      `overview singles ${overview.markers.length} clusters ${overview.clusters.length} (${clusteredPoints} points)`
    testInfo.annotations.push({ type: 'measure', description: measure })
    console.log(`[#2059] ${measure}`)

    expect(coverWidth).toBe(TRIP_HEADER_WIDTH)
    expect(tabsWidth).toBe(TRIP_HEADER_WIDTH)
    expect(panelWidth).toBe(1200)
    expect(mapHeight).toBeGreaterThanOrEqual(DESKTOP_MAP_MIN_HEIGHT)
    expect(header.rows).toBeLessThanOrEqual(MAX_HEADER_LINES)
    expect(header.lines).toBeLessThanOrEqual(MAX_HEADER_LINES)
    await expect(page.getByTestId('trip-plan-map-point-count')).toHaveText(`${LARGE_TRIP_POINT_COUNT} точка`)
    await expect(page.getByTestId('trip-plan-map-marker-hint')).toHaveCount(0)

    // Общий вид: близкие точки собраны в кластеры, одиночных маркеров ≤ 15,
    // и каждая точка учтена ровно один раз — маркером или числом кластера.
    expect(overview.markers.length).toBeLessThanOrEqual(MAX_SINGLE_MARKERS_OVERVIEW)
    expect(overview.clusters.length).toBeGreaterThan(0)
    expect(overview.markers.length + clusteredPoints).toBe(LARGE_TRIP_POINT_COUNT)

    // Приближение к дню: маркеры дня раскрыты, и номер каждого — номер строки списка.
    const day = 5
    const indices = largeTripDayIndices(day)
    const expectedLabels = indices.map((index) => String(index + 1))
    await page.getByTestId(`route-builder-day-toggle-${day}`).click()
    await expect(page.getByTestId(`route-builder-day-toggle-${day}`)).toHaveAttribute('aria-expanded', 'true')
    await expect
      .poll(async () => {
        const labels = new Set((await routeMapMarkers(page, mapScope)).markers.map((marker) => marker.label))
        return expectedLabels.filter((label) => labels.has(label))
      }, { timeout: 10_000 })
      .toEqual(expectedLabels)
    for (const index of indices) {
      await expect(page.getByTestId(`route-builder-point-${index}`)).toContainText(String(index + 1))
    }

    // #1781 не сломан кластерами: маркер дня тянется, остаётся на месте дропа,
    // а кадр после перетаскивания не прыгает (соседи дня стоят где стояли).
    // Позиции — относительно карты: появление «Сохранить» сдвигает страницу.
    const relative = async (label: string) => {
      const { container, markers } = await routeMapMarkers(page, mapScope)
      const marker = markers.find((item) => item.label === label)
      return marker && container
        ? { x: Math.round(marker.left - container.left), y: Math.round(marker.top - container.top) }
        : null
    }
    const dragged = await relative(expectedLabels[0])
    const neighbour = await relative(expectedLabels[1])
    const draggedBox = (await routeMapMarkers(page, mapScope)).markers.find((marker) => marker.label === expectedLabels[0])
    if (!dragged || !neighbour || !draggedBox) throw new Error('day markers are not measurable')
    const grabX = (draggedBox.left + draggedBox.right) / 2
    const grabY = (draggedBox.top + draggedBox.bottom) / 2
    await page.mouse.move(grabX, grabY)
    await page.mouse.down()
    await page.mouse.move(grabX + 60, grabY + 40, { steps: 10 })
    await page.mouse.up()
    await expect
      .poll(async () => {
        const moved = await relative(expectedLabels[0])
        return moved ? [moved.x - dragged.x, moved.y - dragged.y] : null
      }, { timeout: 5_000 })
      .toEqual([60, 40])
    await expect(page.getByTestId('route-builder-save')).toBeVisible()
    const neighbourAfter = await relative(expectedLabels[1])
    const dragMeasure = `1440x900 drag: marker ${expectedLabels[0]} moved by 60x40, ` +
      `neighbour ${expectedLabels[1]} ${neighbour.x},${neighbour.y} -> ${neighbourAfter?.x},${neighbourAfter?.y}`
    testInfo.annotations.push({ type: 'measure', description: dragMeasure })
    console.log(`[#2059] ${dragMeasure}`)
    expect(neighbourAfter).toEqual(neighbour)

    await page.screenshot({ path: testInfo.outputPath('large-trip-map-1440.png') })
  })

  // #2073: во встроенной desktop-карте (`fill=false` — RouteBuilder.tsx рендерит
  // 'stack' на не-mobile ширинах) легенда «Оригинальный трек из файла» и легенда
  // погодных слоёв садятся в один нижний левый угол (`TripPlanRouteMapHeader.tsx`
  // `legendBottom`, `WeatherLegend.web.tsx` `left:12, bottom:WEATHER_LEGEND_BOTTOM_OFFSET,
  // zIndex:700`). Task Contract требует, чтобы обе легенды читались одновременно —
  // фикс поднимает легенду трека над погодной высотой её измеренного `onLayout`
  // (`TripPlanRouteMap.web.tsx`), а не прячет её. Порог теста — обе легенды видны
  // и их прямоугольники физически не пересекаются.
  test('desktop-1440: weather overlay legend does not cover the original-track legend (#2073)', async ({
    page,
  }, testInfo) => {
    await mockLargePlannedTrip(page)
    await openLargeTrip(page, { width: 1440, height: 900 })

    const mapScope = 'route-builder-map-column'
    await waitForSettledRouteMap(page, mapScope)
    await expect(page.getByTestId('trip-plan-map-original-track-legend').first()).toBeVisible()

    await page.getByTestId('trip-plan-map-layers').click()
    await page.getByTestId('map-overlay-weather-temp').click()
    await expect(page.getByTestId('weather-legend')).toBeVisible({ timeout: 10_000 })
    // Обе легенды остаются в DOM одновременно — фикс не прячет легенду трека.
    await expect(page.getByTestId('trip-plan-map-original-track-legend').first()).toBeVisible()

    const legendBoxes = async () => ({
      weatherBox: await page.getByTestId('weather-legend').boundingBox(),
      trackBox: await page.getByTestId('trip-plan-map-original-track-legend').first().boundingBox(),
    })
    // Высота погодной легенды приходит из onLayout (ResizeObserver) после первого
    // кадра: до замера легенда трека кадр стоит под ней — ждём подъёма, а не ловим кадр.
    await expect.poll(async () => {
      const { weatherBox: w, trackBox: t } = await legendBoxes()
      if (!w || !t) return 'unmeasured'
      return t.y + t.height <= w.y ? 'stacked' : 'overlapping'
    }).toBe('stacked')
    const { weatherBox, trackBox } = await legendBoxes()
    expect(weatherBox).not.toBeNull()
    expect(trackBox).not.toBeNull()

    const measure = trackBox && weatherBox
      ? `1440x900 legends: track ${Math.round(trackBox.x)},${Math.round(trackBox.y)} ` +
        `${Math.round(trackBox.width)}x${Math.round(trackBox.height)}, weather ` +
        `${Math.round(weatherBox.x)},${Math.round(weatherBox.y)} ${Math.round(weatherBox.width)}x${Math.round(weatherBox.height)}`
      : '1440x900 legends: boundingBox() returned null'
    testInfo.annotations.push({ type: 'measure', description: measure })
    console.log(`[#2073] ${measure}`)

    if (trackBox && weatherBox) {
      const overlaps = trackBox.x < weatherBox.x + weatherBox.width
        && trackBox.x + trackBox.width > weatherBox.x
        && trackBox.y < weatherBox.y + weatherBox.height
        && trackBox.y + trackBox.height > weatherBox.y
      expect(overlaps).toBe(false)
    } else {
      throw new Error('legend bounding boxes are not measurable')
    }
  })

  test('desktop-1440: approximate route keeps the map header within 3 lines', async ({ page }, testInfo) => {
    await mockLargePlannedTrip(page)
    const warning = { code: 'ors_http_404', message: 'Provider route is unavailable; direct-line fallback was used.' }
    const degraded = {
      ...largeTripDto,
      route_summary: { ...largeTripDto.route_summary, provider: 'direct' },
      routing_state: { provider: 'direct', is_optimal: false, fallback_reason: 'ors_http_404', warnings: [warning] },
    }
    // Позже зарегистрированный маршрут Playwright проверяет первым.
    await page.route(`**/api/trips/planned/${LARGE_TRIP_ID}/`, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback()
        return
      }
      await waitForFakeAuth(page)
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(degraded) })
    })
    await page.route('**/api/routing/route/', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          geometry: largeTripDto.route_geometry,
          distance_m: 1_128_400,
          duration_s: 805_000,
          provider: 'direct',
          is_optimal: false,
          fallback_reason: 'ors_http_404',
          warnings: [warning],
        }),
      }),
    )
    await openLargeTrip(page, { width: 1440, height: 900 })

    await expect(page.getByTestId('trip-plan-map-route-reason')).toBeVisible({ timeout: 30_000 })
    const header = await headerTextLines(page)
    const reasonBox = await page.getByTestId('trip-plan-map-route-reason').boundingBox()
    const reasonLines = await page.getByTestId('trip-plan-map-route-reason').evaluate((node) => {
      const lineHeight = Number.parseFloat(getComputedStyle(node).lineHeight)
      return Math.round(node.getBoundingClientRect().height / lineHeight)
    })
    const measure = `1440x900 approximate: header rows ${header.rows} lines ${header.lines}, ` +
      `reason ${Math.round(reasonBox?.width ?? 0)}px wide, ${reasonLines} line(s)`
    testInfo.annotations.push({ type: 'measure', description: measure })
    console.log(`[#2059] ${measure}`)

    expect(header.rows).toBeLessThanOrEqual(MAX_HEADER_LINES)
    // Макет §2: причина до 2 строк; в колонке 394 px она занимала 3.
    expect(reasonLines).toBeLessThanOrEqual(2)
    await expect(page.getByTestId('trip-plan-map-route-status')).toHaveText('Приблизительный маршрут')
  })

  test('mobile-390: numbered clusters, and «на карте» keeps day markers clear of the map buttons', async ({
    page,
  }, testInfo) => {
    await mockLargePlannedTrip(page)
    await openLargeTrip(page, { width: 390, height: 844 })

    const mapScope = 'route-mobile-map'
    const overview = await waitForSettledRouteMap(page, mapScope)
    expect(overview.markers.length).toBeLessThanOrEqual(MAX_SINGLE_MARKERS_OVERVIEW)
    expect(overview.clusters.length).toBeGreaterThan(0)

    // Замечание приёмки #2058: после «на карте» верхняя-правая точка дня
    // вставала под «Слои». Каждый маркер дня — внутри карты и мимо кнопок.
    const day = DAY_COUNT
    const expectedLabels = largeTripDayIndices(day).map((index) => String(index + 1))
    const mapButton = page.getByTestId(`route-builder-day-map-${day}`)
    await mapButton.scrollIntoViewIfNeeded()
    await mapButton.click()
    await expect
      .poll(async () => {
        const labels = new Set((await routeMapMarkers(page, mapScope)).markers.map((marker) => marker.label))
        return expectedLabels.filter((label) => labels.has(label))
      }, { timeout: 10_000 })
      .toEqual(expectedLabels)
    const focused = await routeMapMarkers(page, mapScope)
    const obstacles = await page.evaluate((scopeId) => {
      const scope = document.querySelector(`[data-testid="${scopeId}"]`)
      const selectors = [
        '[data-testid="trip-plan-map-layers"]',
        '[data-testid="trip-plan-map-fullscreen"]',
        '.leaflet-control-zoom',
      ]
      return selectors.flatMap((selector) =>
        Array.from(scope?.querySelectorAll<HTMLElement>(selector) ?? []).map((node) => {
          const rect = node.getBoundingClientRect()
          return { selector, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
        }),
      )
    }, mapScope)
    const box = focused.container
    if (!box) throw new Error('map container is not measurable')
    const overlaps: string[] = []
    for (const marker of focused.markers.filter((item) => expectedLabels.includes(item.label))) {
      const inside = marker.left >= box.left && marker.right <= box.right && marker.top >= box.top && marker.bottom <= box.bottom
      if (!inside) overlaps.push(`${marker.label}: outside the map`)
      for (const obstacle of obstacles) {
        const intersects = marker.left < obstacle.right && marker.right > obstacle.left &&
          marker.top < obstacle.bottom && marker.bottom > obstacle.top
        if (intersects) overlaps.push(`${marker.label}: under ${obstacle.selector}`)
      }
    }
    const topMost = Math.min(...focused.markers.filter((item) => expectedLabels.includes(item.label)).map((item) => item.top))
    const measure = `390x844: overview singles ${overview.markers.length} clusters ${overview.clusters.length}; ` +
      `day ${day} markers top edge ${Math.round(topMost - box.top)}px below the map top, obstacles ${obstacles.length}`
    testInfo.annotations.push({ type: 'measure', description: measure })
    console.log(`[#2059] ${measure}`)
    expect(overlaps).toEqual([])

    await page.screenshot({ path: testInfo.outputPath('large-trip-map-390.png'), fullPage: true })
  })
})
