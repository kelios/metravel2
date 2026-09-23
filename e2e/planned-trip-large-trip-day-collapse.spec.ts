import type { Page } from '@playwright/test'

import { expect, test } from './fixtures'
import {
  LARGE_TRIP_DAY_SIZES,
  LARGE_TRIP_ID,
  LARGE_TRIP_POINT_COUNT,
  largeTripDayIndices,
  largeTripPoints,
  mockLargePlannedTrip,
  routeMapMarkers,
  waitForFakeAuth,
  waitForSettledRouteMap,
} from './helpers/largePlannedTripFixture'

/**
 * #2058 — дни в шаге «Точки маршрута» сворачиваются, день показывается на
 * карте. Норматив — `docs/features/trips-plan-route-tab-mock.md` §3.
 *
 * Замер на проде (trip 47, 61 точка в 17 днях, 23.09.2026): на 390×844 верх
 * «Итога маршрута» стоял на 12 086 px; на 1440×900 содержимое списка точек
 * было 10 684 px в окне 520 px. Пороги спеки: ≤ 2 500 px и ≤ 1 200 px.
 *
 * Бэкенд замокан общей фикстурой крупной поездки: спека детерминирована и
 * гоняется на собранном `dist`.
 */

const DAY_COUNT = LARGE_TRIP_DAY_SIZES.length
const MOBILE_SUMMARY_TOP_MAX = 2_500
const DESKTOP_LIST_CONTENT_MAX = 1_200

/** Верх узла от начала страницы: смещение в окне плюс прокрутка всех предков. */
const documentTop = (page: Page, testId: string) =>
  page.evaluate((id) => {
    const node = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
    if (!node) return Number.NaN
    let scrolled = window.scrollY
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      scrolled += parent.scrollTop
    }
    return Math.round(node.getBoundingClientRect().top + scrolled)
  }, testId)

/** Сумма прокрутки всех предков узла — «сдвинулась ли страница». */
const pageScrollOffset = (page: Page, testId: string) =>
  page.evaluate((id) => {
    const node = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
    let scrolled = window.scrollY
    for (let parent = node?.parentElement ?? null; parent; parent = parent.parentElement) {
      scrolled += parent.scrollTop
    }
    return scrolled
  }, testId)

type DayFrame = {
  found: number
  spanShare: number
  inside: boolean
}

/**
 * Где на карте стоят маркеры точек `indices`: какую долю контейнера занимает
 * их рамка по большей оси и все ли они внутри карты. #2059: маркер находится
 * по своему номеру (номер = индекс + 1), потому что точки, собранные в
 * кластер, в DOM не стоят и порядок узлов больше не равен порядку маршрута.
 */
const dayFrame = async (page: Page, containerTestId: string, indices: number[]): Promise<DayFrame> => {
  const { container, markers } = await routeMapMarkers(page, containerTestId)
  const labels = new Set(indices.map((index) => String(index + 1)))
  const centers = markers
    .filter((marker) => labels.has(marker.label))
    .map((marker) => ({ x: (marker.left + marker.right) / 2, y: (marker.top + marker.bottom) / 2 }))
  if (!container || !centers.length) return { found: centers.length, spanShare: 0, inside: false }
  const xs = centers.map((center) => center.x)
  const ys = centers.map((center) => center.y)
  const spanShare = Math.max(
    (Math.max(...xs) - Math.min(...xs)) / container.width,
    (Math.max(...ys) - Math.min(...ys)) / container.height,
  )
  const inside = centers.length === indices.length && centers.every(
    (center) =>
      center.x >= container.left && center.x <= container.right && center.y >= container.top && center.y <= container.bottom,
  )
  return { found: centers.length, spanShare, inside }
}

async function openLargeTrip(page: Page, viewport: { width: number; height: number }) {
  await mockLargePlannedTrip(page)
  await page.setViewportSize(viewport)
  await page.goto(`/trips/plan/${LARGE_TRIP_ID}`, { waitUntil: 'domcontentloaded' })
  await waitForFakeAuth(page)
  await expect(page.getByTestId('trip-plan-panel-route').first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId(`route-builder-day-toggle-${DAY_COUNT}`)).toBeAttached({ timeout: 30_000 })
}

const expectAllDaysCollapsed = async (page: Page) => {
  for (let day = 1; day <= DAY_COUNT; day += 1) {
    await expect(page.getByTestId(`route-builder-day-toggle-${day}`)).toHaveAttribute('aria-expanded', 'false')
  }
  // Строки свёрнутых дней не смонтированы вовсе.
  await expect(page.getByTestId('route-builder-point-0')).toHaveCount(0)
  await expect(page.getByTestId(`route-builder-point-${LARGE_TRIP_POINT_COUNT - 1}`)).toHaveCount(0)
}

test.describe('Planned trip route tab — collapsible days on a large trip (#2058)', () => {
  test('mobile-390: days start collapsed, «Итог маршрута» within 2 500 px, «на карте» shows the day', async ({
    page,
  }, testInfo) => {
    await openLargeTrip(page, { width: 390, height: 844 })
    await expectAllDaysCollapsed(page)

    const summaryTop = await documentTop(page, 'route-builder-step-summary')
    const pointsTop = await documentTop(page, 'route-builder-step-points')
    const pointsHeight = (await page.getByTestId('route-builder-step-points').boundingBox())?.height ?? Number.NaN
    testInfo.annotations.push({
      type: 'measure',
      description: `390x844: step-summary top ${summaryTop}px, step-points top ${pointsTop}px height ${Math.round(pointsHeight)}px`,
    })
    console.log(`[#2058] 390x844 step-summary top=${summaryTop}px step-points top=${pointsTop}px height=${Math.round(pointsHeight)}px`)
    expect(summaryTop).toBeLessThanOrEqual(MOBILE_SUMMARY_TOP_MAX)

    // Заголовок дня — тач-таргет не ниже 44 px.
    const toggleBox = await page.getByTestId('route-builder-day-toggle-10').boundingBox()
    expect(toggleBox?.height ?? 0).toBeGreaterThanOrEqual(44)

    // «На карте» поднимает страницу к карте и ставит в кадр только точки дня.
    const day = DAY_COUNT
    const mapButton = page.getByTestId(`route-builder-day-map-${day}`)
    await page.getByTestId('route-builder-step-summary').scrollIntoViewIfNeeded()
    await mapButton.scrollIntoViewIfNeeded()
    // Карта уехала вверх за край экрана — ровно то, что чинит «на карте».
    await expect.poll(async () => (await page.getByTestId('route-mobile-map').boundingBox())?.y ?? 0).toBeLessThan(0)
    await mapButton.click()
    await expect
      .poll(async () => (await page.getByTestId('route-mobile-map').boundingBox())?.y ?? -1, { timeout: 10_000 })
      .toBeGreaterThanOrEqual(-1)
    const mapTop = (await page.getByTestId('route-mobile-map').boundingBox())?.y ?? Number.NaN
    expect(mapTop).toBeLessThan(844 / 2)
    await expect
      .poll(async () => dayFrame(page, 'route-mobile-map', largeTripDayIndices(day)), { timeout: 10_000 })
      .toMatchObject({ found: largeTripDayIndices(day).length, inside: true })
    expect((await dayFrame(page, 'route-mobile-map', largeTripDayIndices(day))).spanShare).toBeGreaterThanOrEqual(0.35)
    // «На карте» день не раскрывает.
    await expect(page.getByTestId(`route-builder-day-toggle-${day}`)).toHaveAttribute('aria-expanded', 'false')

    // Касание заголовка раскрывает свой день и только его.
    await page.getByTestId('route-builder-day-toggle-3').click()
    await expect(page.getByTestId('route-builder-day-toggle-3')).toHaveAttribute('aria-expanded', 'true')
    for (const index of largeTripDayIndices(3)) {
      await expect(page.getByTestId(`route-builder-point-${index}`)).toBeVisible()
    }
    await expect(page.getByTestId(`route-builder-point-${largeTripDayIndices(4)[0]}`)).toHaveCount(0)

    await page.screenshot({ path: testInfo.outputPath('large-trip-days-390.png'), fullPage: true })
  })

  test('desktop-1440: collapsed list fits 1 200 px, expanding a day fits the sticky map to it', async ({
    page,
  }, testInfo) => {
    await openLargeTrip(page, { width: 1440, height: 900 })
    await expectAllDaysCollapsed(page)

    const list = page.getByTestId('route-builder-point-list-scroll')
    const { scrollHeight, clientHeight } = await list.evaluate((node) => ({
      scrollHeight: node.scrollHeight,
      clientHeight: node.clientHeight,
    }))
    testInfo.annotations.push({
      type: 'measure',
      description: `1440x900: point-list scrollHeight ${scrollHeight}px, clientHeight ${clientHeight}px`,
    })
    console.log(`[#2058] 1440x900 point-list scrollHeight=${scrollHeight}px clientHeight=${clientHeight}px`)
    expect(scrollHeight).toBeLessThanOrEqual(DESKTOP_LIST_CONTENT_MAX)
    // Desktop сохраняет собственный скролл списка (#1600) — ни одного `[⌖]`.
    await expect(page.locator('[data-testid^="route-builder-day-map-"]')).toHaveCount(0)

    const day = 5
    const indices = largeTripDayIndices(day)
    // Карта успокоилась: трек загружен, кадр подогнан, каждая точка учтена
    // маркером или кластером (#2059).
    await waitForSettledRouteMap(page, 'route-builder-map-column')
    const before = await dayFrame(page, 'route-builder-map-column', indices)
    expect(before.spanShare).toBeLessThan(0.1)
    // Заголовок подводится к кадру заранее: `click()` Playwright сам прокрутил
    // бы страницу и спрятал ответ на вопрос «прокрутило ли её приложение».
    const toggle = page.getByTestId(`route-builder-day-toggle-${day}`)
    await toggle.scrollIntoViewIfNeeded()
    const scrollBefore = await pageScrollOffset(page, 'route-builder')

    await toggle.click()
    await expect(page.getByTestId(`route-builder-day-toggle-${day}`)).toHaveAttribute('aria-expanded', 'true')
    await expect
      .poll(async () => {
        const frame = await dayFrame(page, 'route-builder-map-column', indices)
        return frame.inside && frame.spanShare >= 0.35
      }, { timeout: 10_000 })
      .toBe(true)
    const after = await dayFrame(page, 'route-builder-map-column', indices)
    testInfo.annotations.push({
      type: 'measure',
      description: `1440x900: day ${day} markers span ${before.spanShare.toFixed(3)} -> ${after.spanShare.toFixed(3)} of the map`,
    })
    console.log(`[#2058] 1440x900 day ${day} span ${before.spanShare.toFixed(3)} -> ${after.spanShare.toFixed(3)}`)
    // Карта подгоняется сама — страница не прокручивается.
    expect(Math.abs((await pageScrollOffset(page, 'route-builder')) - scrollBefore)).toBeLessThanOrEqual(1)

    // Перетаскивание внутри развёрнутого дня: вторая точка дня 3 встаёт первой.
    await page.getByTestId('route-builder-day-toggle-3').click()
    const [first, second] = largeTripDayIndices(3)
    const firstName = largeTripPoints[first].title
    const secondName = largeTripPoints[second].title
    await expect(page.getByTestId(`route-builder-point-${first}`)).toContainText(firstName)
    const handle = page.getByTestId(`route-builder-drag-${second}`)
    await handle.scrollIntoViewIfNeeded()
    const handleBox = await handle.boundingBox()
    const firstBox = await page.getByTestId(`route-builder-point-${first}`).boundingBox()
    const secondBox = await page.getByTestId(`route-builder-point-${second}`).boundingBox()
    if (!handleBox || !firstBox || !secondBox) throw new Error('drag geometry is not measurable')
    const shift = firstBox.y + firstBox.height / 2 - (secondBox.y + secondBox.height / 2)
    const startX = handleBox.x + handleBox.width / 2
    const startY = handleBox.y + handleBox.height / 2
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX, startY + shift, { steps: 8 })
    await page.mouse.up()
    await expect(page.getByTestId(`route-builder-point-${first}`)).toContainText(secondName)
    await expect(page.getByTestId(`route-builder-point-${second}`)).toContainText(firstName)

    await page.screenshot({ path: testInfo.outputPath('large-trip-days-1440.png') })
  })
})
