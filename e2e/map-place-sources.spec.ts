import { test, expect } from './fixtures'
import { preacceptCookies } from './helpers/navigation'

/**
 * #1568 — приёмочный flow «один физический объект = один маркер + карточка с
 * перелистыванием материалов» на фикстурах (Национальная библиотека: travel 389
 * и 646 описывают одно место).
 *
 * Тест закрывает интеграцию слайсов, которую не видит ни одна из их проверок:
 * группировку маркеров (#1573) вместе с pager карточки (#1572) и ленивой
 * загрузкой источников (#1571), плюс сетевой контракт из Task Contract:
 * sources запрашиваются ТОЛЬКО после открытия карточки и один раз на place.
 *
 * Живой API (`GET /api/map/places/{place_id}/sources/`) здесь намеренно
 * замокан: фикстуры дают детерминированный flow, а приёмка на задеплоенном
 * backend — отдельный шаг MAP-20 (`docs/MANUAL_TEST_CASES.md`).
 */

const PLACE_ID = 501
const NEARBY_PLACE_ID = 502

const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8m2p8AAAAASUVORK5CYII=',
  'base64',
)

/** Две записи одного места: разные статьи, фото и point_id — но общий place_id. */
const LIBRARY_SOURCE_A = {
  source_id: 'travel-address:14029',
  point_id: 14029,
  travel_id: 389,
  article_title: 'Из Мозыря в Микашевичи через Минск',
  article_url: '/travels/iz-mozyrya-v-mikashevichi?id=389',
  thumbnail_url: 'https://images.example.test/e2e-source-a.png',
  thumbnail_width: 400,
  thumbnail_height: 300,
}

const LIBRARY_SOURCE_B = {
  source_id: 'travel-address:15688',
  point_id: 15688,
  travel_id: 646,
  article_title: 'Минск за выходные: путеводитель по столице Беларуси',
  article_url: '/travels/minsk-za-vykhodnye?id=646',
  thumbnail_url: 'https://images.example.test/e2e-source-b.png',
  thumbnail_width: 400,
  thumbnail_height: 300,
}

/** Плоские строки map-выдачи: переходная форма DTO с добавленными place-полями. */
const LIBRARY_ROW_A = {
  id: 14029,
  place_id: PLACE_ID,
  coord: '53.931290,27.645900',
  lat: '53.931290',
  lng: '27.645900',
  address: 'Национальная библиотека Беларуси',
  categoryName: 'Библиотека',
  source_count: 2,
  primary_source: LIBRARY_SOURCE_A,
  travelImageThumbUrl: LIBRARY_SOURCE_A.thumbnail_url,
  urlTravel: LIBRARY_SOURCE_A.article_url,
  articleUrl: '',
}

const LIBRARY_ROW_B = {
  ...LIBRARY_ROW_A,
  id: 15688,
  primary_source: LIBRARY_SOURCE_B,
  travelImageThumbUrl: LIBRARY_SOURCE_B.thumbnail_url,
  urlTravel: LIBRARY_SOURCE_B.article_url,
}

/** Соседнее самостоятельное место: другой place_id — склейки быть не должно. */
const NEARBY_ROW = {
  id: 15687,
  place_id: NEARBY_PLACE_ID,
  coord: '53.933000,27.652000',
  lat: '53.933000',
  lng: '27.652000',
  address: 'Центральный ботанический сад НАН',
  categoryName: 'Ботанический сад',
  source_count: 1,
  primary_source: {
    source_id: 'travel-address:15687',
    point_id: 15687,
    travel_id: 646,
    article_title: 'Минск за выходные',
    article_url: '/travels/minsk-za-vykhodnye?id=646',
    thumbnail_url: 'https://images.example.test/e2e-source-c.png',
    thumbnail_width: 400,
    thumbnail_height: 300,
  },
  travelImageThumbUrl: 'https://images.example.test/e2e-source-c.png',
  urlTravel: '/travels/minsk-za-vykhodnye?id=646',
  articleUrl: '',
}

const MAP_ROWS = [LIBRARY_ROW_A, LIBRARY_ROW_B, NEARBY_ROW]

type SourcesTracker = { count: number }

async function installMapMocks(page: any): Promise<SourcesTracker> {
  const tracker: SourcesTracker = { count: 0 }

  const fulfillPng = (route: any) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: TRANSPARENT_PNG })

  await page.route('**://tile.openstreetmap.org/**', fulfillPng)
  await page.route('**://*.tile.openstreetmap.org/**', fulfillPng)
  await page.route('**/proxy/tiles/osm/**', fulfillPng)
  await page.route('https://images.example.test/**', fulfillPng)

  await page.route('**/api/filterformap/**', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ categoryTravelAddress: [] }),
    }),
  )

  const fulfillRows = (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MAP_ROWS),
    })

  await page.route('**/api/travels/search_travels_for_map/**', fulfillRows)
  await page.route('**/api/travels/search_travels_for_map_lite/**', fulfillRows)

  // Серверная кластеризация отдаёт те же места как markers (#1347 payload).
  await page.route('**/api/map/clusters/**', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        clusters: [],
        markers: MAP_ROWS,
        total_count: MAP_ROWS.length,
        source: 'places',
      }),
    }),
  )

  // Ленивая коллекция материалов: считаем КАЖДОЕ обращение, чтобы поймать
  // как преждевременный запрос на рендере маркеров, так и повторный на листании.
  await page.route('**/api/map/places/**/sources/**', (route: any) => {
    tracker.count += 1
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [LIBRARY_SOURCE_A, LIBRARY_SOURCE_B], next: null }),
    })
  })

  return tracker
}

async function gotoMap(page: any) {
  const mapWrapper = page.getByTestId('map-leaflet-wrapper')

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const url = attempt === 0 ? '/map' : `/map?e2eRetry=${attempt}`
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    const appeared = await mapWrapper.isVisible({ timeout: 5_000 }).catch(() => false)
    if (appeared) return
  }

  await mapWrapper.waitFor({ state: 'visible', timeout: 30_000 })
}

test.describe('#1568 map place sources — one marker, paged sources', () => {
  test('groups two articles of one place into a single marker and pages both sources', async ({
    page,
  }) => {
    await preacceptCookies(page)
    await page.addInitScript(() => {
      window.localStorage.setItem('metravel_map_onboarding_completed', 'true')
    })
    const sources = await installMapMocks(page)

    await gotoMap(page)
    await page.waitForSelector('.metravel-pin-marker', { state: 'visible', timeout: 30_000 })

    // Три строки выдачи описывают два места: библиотека склеена в один маркер.
    await expect
      .poll(async () => page.locator('.metravel-pin-marker').count(), { timeout: 15_000 })
      .toBe(2)

    // Маркеры сети не касаются: sources ленивы до первого открытия карточки.
    expect(sources.count).toBe(0)

    // Штампуем живые DOM-узлы маркеров: если слой пересоберётся при листании
    // источников, штамп исчезнет вместе со старыми элементами (#1347 churn).
    await page.evaluate(() => {
      document
        .querySelectorAll('.metravel-pin-marker')
        .forEach((el) => el.setAttribute('data-e2e-marker-stamp', '1'))
    })

    // Первое место выдачи — библиотека (две записи, склеенные в один маркер).
    await page.locator('.metravel-pin-marker').first().click({ force: true })

    const counter = page.getByTestId('place-source-pager-counter')
    await expect(counter).toHaveText('Материал 1 из 2', { timeout: 15_000 })
    await expect.poll(async () => sources.count, { timeout: 10_000 }).toBe(1)

    const primaryAction = page.getByTestId('popup-primary-action').first()
    await expect(primaryAction).toBeVisible()

    // Вперёд: второй материал со своей статьёй.
    await page.getByTestId('place-source-pager-next').click()
    await expect(counter).toHaveText('Материал 2 из 2', { timeout: 10_000 })

    // Назад: снова первый.
    await page.getByTestId('place-source-pager-prev').click()
    await expect(counter).toHaveText('Материал 1 из 2', { timeout: 10_000 })

    // Листание идёт по кэшу: ни одного нового запроса sources.
    expect(sources.count).toBe(1)

    // И не трогает marker layer: оба исходных узла живы со своим штампом.
    await expect(page.locator('.metravel-pin-marker[data-e2e-marker-stamp="1"]')).toHaveCount(2)
  })

  test('keeps a nearby distinct place separate and renders no pager for a single source', async ({
    page,
  }) => {
    await preacceptCookies(page)
    await page.addInitScript(() => {
      window.localStorage.setItem('metravel_map_onboarding_completed', 'true')
    })
    const sources = await installMapMocks(page)

    await gotoMap(page)
    await page.waitForSelector('.metravel-pin-marker', { state: 'visible', timeout: 30_000 })
    await expect
      .poll(async () => page.locator('.metravel-pin-marker').count(), { timeout: 15_000 })
      .toBe(2)

    // Второй маркер — соседний ботанический сад с одним материалом.
    await page.locator('.metravel-pin-marker').nth(1).click({ force: true })

    const popup = page.locator('.leaflet-popup')
    const overlayClose = page.locator('[aria-label="Закрыть"]')
    const opened = await popup
      .isVisible({ timeout: 10_000 })
      .catch(() => false)
    if (!opened) await expect(overlayClose).toBeVisible({ timeout: 10_000 })

    await expect(page.getByTestId('place-source-pager')).toHaveCount(0)
    expect(sources.count).toBe(0)
  })
})

test.describe('#1568 map place sources — mobile web surface', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  })

  test('bottom card pages both sources of one place and keeps sources cached', async ({ page }) => {
    await preacceptCookies(page)
    await page.addInitScript(() => {
      window.localStorage.setItem('metravel_map_onboarding_completed', 'true')
    })
    const sources = await installMapMocks(page)

    await gotoMap(page)
    await page.waitForSelector('.metravel-pin-marker', { state: 'visible', timeout: 30_000 })
    await expect
      .poll(async () => page.locator('.metravel-pin-marker').count(), { timeout: 15_000 })
      .toBe(2)
    expect(sources.count).toBe(0)

    await page.locator('.metravel-pin-marker').first().click({ force: true })

    const counter = page.getByTestId('place-source-pager-counter')
    await expect(counter).toHaveText('Материал 1 из 2', { timeout: 15_000 })
    await expect.poll(async () => sources.count, { timeout: 10_000 }).toBe(1)

    await page.getByTestId('place-source-pager-next').tap()
    await expect(counter).toHaveText('Материал 2 из 2', { timeout: 10_000 })

    await page.getByTestId('place-source-pager-prev').tap()
    await expect(counter).toHaveText('Материал 1 из 2', { timeout: 10_000 })

    expect(sources.count).toBe(1)
  })
})
