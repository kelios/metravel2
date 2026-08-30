/**
 * Performance budget tests for the main public pages: Home, Search, Map, Places,
 * the quests catalog and one deterministic quest detail.
 *
 * Companion to `e2e/travel-details-perf-budget.spec.ts` (which covers the travel
 * details page). Runs against a **production build** (dist/prod) served locally
 * and measures Core Web Vitals + network transfer per page via the browser
 * Performance API.
 *
 * Run:
 *   npm run e2e:perf-budget:pages   (три browser projects / три budget profiles + negative probe)
 *
 * Числовые бюджеты живут в `helpers/pagesPerfBudgets.ts` — по записи на пару
 * (маршрут, профиль). Переменные окружения (`PERF_CLS_MAX`, `PERF_LCP_MAX_MS`,
 * `PERF_MAX_TOTAL_KB`, … и их варианты с суффиксом `_HOME`/`_SEARCH`/…) могут
 * только УЖЕСТОЧИТЬ потолок: послабление игнорируется и печатается в отчёте
 * (#1287). Снять baseline можно `PERF_BUDGET_BASELINE=1` — в CI запрещено.
 */

import { test, expect, type Page, type Route } from '@playwright/test'
import type { ApiQuestBundle, ApiQuestMeta } from '../api/quests'
import {
  injectPerfObservers,
  beginPostReadyClsCollection,
  collectMetrics,
  collectFirstScreenElements,
  collectObservedProfile,
  createNetworkTracker,
  applyCpuThrottling,
  MOBILE_THROTTLE_PROFILE,
} from './helpers/perfBudget'
import {
  FORBIDDEN_SHIFT_SOURCES,
  evaluatePageBudget,
  evaluateTransferBudget,
  resolveEffectiveBudget,
  type PerfProfile,
} from './helpers/pagesPerfBudgets'
import { PERF_DESKTOP_VIEWPORTS, PERF_PROFILE_BY_PROJECT } from './helpers/perfProjects'

type PageTarget = {
  key: string
  name: string
  path: string
  /** Page-specific ready selector; falls back to <h1> then networkidle. */
  readySelector: string
  requireReadySelector?: boolean
}

type MapFixtureCounters = {
  filters: number
  travels: number
  clusters: number
}

type QuestDetailFixtureCounters = {
  detail: number
  list: number
}

type CatalogFixtureCounters = {
  places: number
  quests: number
  unexpectedMethods: string[]
}

const PERF_QUEST_ID = 'perf-budget-quest'
// CH is intentionally outside the Belkraj/Tripvenue support table. The detail
// fixture therefore exercises the quest layout without a third-party iframe.
const PERF_QUEST_CITY = {
  id: 98_041,
  slug: 'zurich',
  name: 'Zurich',
  countryId: '41',
  countryName: 'Switzerland',
  countryCode: 'CH',
  lat: 47.3769,
  lng: 8.5417,
} as const
const PERF_QUEST_PATH = `/quests/${PERF_QUEST_CITY.slug}/${PERF_QUEST_ID}`
const PERF_QUEST_MAPS_URL =
  `https://www.openstreetmap.org/?mlat=${PERF_QUEST_CITY.lat}&mlon=${PERF_QUEST_CITY.lng}`

// Числовые бюджеты живут в `helpers/pagesPerfBudgets.ts` — по записи на пару
// (маршрут, профиль). Здесь остаётся только то, что описывает саму страницу
// (#1287): раньше общий `CLS_MAX = 0.3` пропускал регресс главной с 0,2431.
const PAGES: PageTarget[] = [
  {
    key: 'HOME',
    name: 'Home',
    path: '/',
    readySelector: '[data-testid="home-hero"]',
  },
  {
    key: 'SEARCH',
    name: 'Search',
    path: '/search',
    // The deterministic fixture has two rows. Waiting for row 1 makes the CLS
    // and first-screen DOM measurements describe the loaded catalog, not a race
    // between the route shell and its async results.
    readySelector: '[data-testid="travel-row-1"]',
    requireReadySelector: true,
  },
  {
    key: 'MAP',
    name: 'Map',
    path: '/map',
    readySelector: '[data-testid="map-leaflet-wrapper"]',
  },
  {
    key: 'PLACES',
    name: 'Places',
    path: '/places',
    readySelector: '[data-testid="places-card-98041"]',
    requireReadySelector: true,
  },
  // #1161: каталог квестов держит обложки на `/quest-cover/**` — путь, который до
  // #1113 вообще не распознавался как медийный и уходил без `w`.
  {
    key: 'QUESTS',
    name: 'Quests',
    path: '/quests',
    readySelector: `[data-testid="quest-card-${PERF_QUEST_ID}"]`,
    requireReadySelector: true,
  },
  // #1564: the catalog did not exercise the responsive quest-wizard layout,
  // where the <1280 px CLS regression occurred. The API is fully intercepted
  // below, so this route never depends on a live quest or backend response.
  {
    key: 'QUEST_DETAIL',
    name: 'Quest detail',
    path: PERF_QUEST_PATH,
    readySelector: '[data-testid="quest-trust-bar"]',
    requireReadySelector: true,
  },
]

const SEARCH_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8ZKfkAAAAASUVORK5CYII='
const SEARCH_TRAVELS = Array.from({ length: 6 }, (_, index) => ({
  id: 980_100 + index,
  slug: `perf-search-${index}`,
  url: `/travels/perf-search-${index}`,
  name: `Стабильная карточка поиска ${index + 1}`,
  countryName: 'Беларусь',
  cityName: 'Минск',
  travel_image_thumb_url: SEARCH_PIXEL,
  travel_image_thumb_small_url: SEARCH_PIXEL,
  publish: true,
  moderation: true,
  year: '2026',
}))

const PERF_PLACE = {
  id: '98041',
  title: 'Детерминированное место для perf gate',
  address: 'Минск, тестовый адрес',
  category: { id: 98_041, name: 'Достопримечательности' },
  country: { code: 'BY', name: 'Беларусь' },
  lat: 53.9023,
  lng: 27.5619,
  travel: { url: '/travels/perf-budget-place' },
  image: null,
}

const PERF_QUEST_META = {
  id: 98_040,
  quest_id: PERF_QUEST_ID,
  title: 'Детерминированный квест для perf gate',
  points: 1,
  city_id: String(PERF_QUEST_CITY.id),
  city_name: PERF_QUEST_CITY.name,
  country_id: PERF_QUEST_CITY.countryId,
  country_name: PERF_QUEST_CITY.countryName,
  country_code: PERF_QUEST_CITY.countryCode,
  lat: PERF_QUEST_CITY.lat,
  lng: PERF_QUEST_CITY.lng,
  duration_min: 45,
  difficulty: 'easy',
  tags: { urban: true },
  pet_friendly: true,
  cover_url: null,
  rating_avg: null,
  rating_count: 0,
  user_rating: null,
  completions_count: 0,
  is_completed_by_me: false,
  first_completer: null,
} satisfies ApiQuestMeta

const PERF_QUEST_BUNDLE = {
  id: PERF_QUEST_META.id,
  quest_id: PERF_QUEST_ID,
  title: PERF_QUEST_META.title,
  cover_url: null,
  intro: {
    id: 'intro',
    step_id: 'intro',
    title: 'Начало маршрута',
    location: PERF_QUEST_CITY.name,
    story: 'Стабильное вступление для измерения первого экрана.',
    task: 'Начните квест.',
    hint: null,
    answer_pattern: null,
    lat: PERF_QUEST_CITY.lat,
    lng: PERF_QUEST_CITY.lng,
    maps_url: PERF_QUEST_MAPS_URL,
    image_url: null,
    order: 0,
    is_intro: true,
    country_code: PERF_QUEST_CITY.countryCode,
  },
  steps: [
    {
      id: 1,
      step_id: 'perf-step-1',
      title: 'Первая точка',
      location: PERF_QUEST_CITY.name,
      story: 'Стабильный шаг без внешних медиа.',
      task: 'Введите любое слово.',
      hint: 'Подойдёт любой непустой ответ.',
      answer_pattern: { type: 'any_text', value: { min_length: 1 } },
      lat: PERF_QUEST_CITY.lat,
      lng: PERF_QUEST_CITY.lng,
      maps_url: PERF_QUEST_MAPS_URL,
      image_url: null,
      order: 1,
      is_intro: false,
      country_code: PERF_QUEST_CITY.countryCode,
    },
  ],
  finale: { text: 'Квест завершён.', video_url: null, poster_url: null },
  storage_key: PERF_QUEST_ID,
  city: {
    id: PERF_QUEST_CITY.id,
    name: PERF_QUEST_CITY.name,
    lat: PERF_QUEST_CITY.lat,
    lng: PERF_QUEST_CITY.lng,
    country_code: PERF_QUEST_CITY.countryCode,
  },
  rating_avg: null,
  rating_count: 0,
  user_rating: null,
  completions_count: 0,
  is_completed_by_me: false,
  first_completer: null,
} satisfies ApiQuestBundle

function shouldIgnoreBudgetRequest(target: PageTarget, url: string) {
  if (target.key !== 'MAP') return false

  try {
    const parsed = new URL(url)
    return parsed.pathname.startsWith('/proxy/tiles/')
  } catch {
    return false
  }
}

async function waitForReady(page: Page, selector: string, requireReadySelector = false) {
  if (requireReadySelector) {
    await page.waitForSelector(selector, { timeout: 30_000 })
  } else {
    await Promise.race([
      page.waitForSelector(selector, { timeout: 30_000 }).catch(() => null),
      page.waitForSelector('h1', { timeout: 30_000 }).catch(() => null),
    ])
  }
  await page.waitForLoadState('networkidle').catch(() => null)
}

async function installDeterministicSearchApi(page: Page, target: PageTarget) {
  if (target.key !== 'SEARCH') return

  const fulfillJson = (route: Route, body: unknown) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })

  await page.route('**/getFiltersTravel/**', (route) =>
    fulfillJson(route, {
      categories: [],
      categoryTravelAddress: [],
      companions: [],
      complexity: [],
      month: [],
      over_nights_stay: [],
      sortings: [
        { id: 'newest', name: 'Сначала новые' },
        { id: 'oldest', name: 'Сначала старые' },
        { id: 'popular_desc', name: 'Популярные' },
      ],
      transports: [],
    }),
  )
  await page.route('**/countriesforsearch/**', (route) => fulfillJson(route, []))

  const fulfillTravelCatalog = async (route: Route) => {
    const request = route.request()
    if (request.method() !== 'GET') {
      await route.fallback()
      return
    }

    const pathname = new URL(request.url()).pathname
    if (pathname.endsWith('/travels/facets/')) {
      await fulfillJson(route, { total: SEARCH_TRAVELS.length, facets: {} })
      return
    }
    if (pathname.endsWith('/api/travels/') || pathname === '/travels/') {
      await fulfillJson(route, { data: SEARCH_TRAVELS, total: SEARCH_TRAVELS.length })
      return
    }

    await route.fallback()
  }

  await page.route('**/api/travels/**', fulfillTravelCatalog)
  await page.route('**/travels/**', fulfillTravelCatalog)
}

async function installDeterministicMapApi(
  page: Page,
  target: PageTarget,
): Promise<MapFixtureCounters> {
  const counters: MapFixtureCounters = { filters: 0, travels: 0, clusters: 0 }
  if (target.key !== 'MAP') return counters

  const fulfillJson = (route: Route, body: unknown) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })

  await page.route('**/api/filterformap/**', (route) => {
    counters.filters += 1
    return fulfillJson(route, {
      countries: [],
      categories: [],
      categoryTravelAddress: [],
      companions: [],
      complexity: [],
      month: [],
      over_nights_stay: [],
      transports: [],
      year: [],
    })
  })
  await page.route('**/api/travels/search_travels_for_map/**', (route) => {
    counters.travels += 1
    return fulfillJson(route, { results: [], total: 0 })
  })
  await page.route('**/api/map/clusters/**', (route) => {
    counters.clusters += 1
    return fulfillJson(route, { clusters: [], markers: [], total_count: 0 })
  })

  return counters
}

async function installDeterministicCatalogApi(
  page: Page,
  target: PageTarget,
): Promise<CatalogFixtureCounters> {
  const counters: CatalogFixtureCounters = { places: 0, quests: 0, unexpectedMethods: [] }
  const fulfillJson = (route: Route, body: unknown, status = 200) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })

  if (target.key === 'PLACES') {
    await page.route((url) => url.pathname === '/api/places/catalog/', (route) => {
      if (route.request().method() !== 'GET') {
        counters.unexpectedMethods.push(
          `${route.request().method()} ${new URL(route.request().url()).pathname}`,
        )
        return fulfillJson(route, { detail: 'Method disabled by deterministic perf fixture' }, 405)
      }
      counters.places += 1
      return fulfillJson(route, {
        count: 1,
        results: [PERF_PLACE],
        facets: {
          categories: [{ id: PERF_PLACE.category.id, name: PERF_PLACE.category.name, count: 1 }],
          countries: [{ code: PERF_PLACE.country.code, name: PERF_PLACE.country.name, count: 1 }],
        },
      })
    })
  }

  if (target.key === 'QUESTS') {
    await page.route((url) => url.pathname === '/api/quests/', (route) => {
      if (route.request().method() !== 'GET') {
        counters.unexpectedMethods.push(
          `${route.request().method()} ${new URL(route.request().url()).pathname}`,
        )
        return fulfillJson(route, { detail: 'Method disabled by deterministic perf fixture' }, 405)
      }
      counters.quests += 1
      return fulfillJson(route, [PERF_QUEST_META])
    })
  }

  return counters
}

async function installDeterministicQuestDetailApi(
  page: Page,
  target: PageTarget,
): Promise<QuestDetailFixtureCounters> {
  const counters: QuestDetailFixtureCounters = { detail: 0, list: 0 }
  if (target.key !== 'QUEST_DETAIL') return counters

  const fulfillJson = (route: Route, body: unknown, status = 200) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })

  // One catch-all makes the fixture fail closed: no API request from the quest
  // screen or shared shell can escape to the local/live backend during a perf run.
  await page.route('**/api/**', (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname

    if (request.method() !== 'GET') {
      return fulfillJson(route, { detail: 'Method disabled by deterministic perf fixture' }, 405)
    }
    if (pathname.includes(`/quests/by-quest-id/${PERF_QUEST_ID}/`)) {
      counters.detail += 1
      return fulfillJson(route, PERF_QUEST_BUNDLE)
    }
    if (pathname === '/api/quests/') {
      counters.list += 1
      return fulfillJson(route, [PERF_QUEST_META])
    }
    if (pathname.includes('/travels/near-location/')) {
      return fulfillJson(route, { results: [] })
    }
    if (pathname.includes(`/quests/quest${PERF_QUEST_ID}/reviews/`)) {
      return fulfillJson(route, [])
    }

    return fulfillJson(route, {})
  })

  return counters
}

function expectMapFixturesUsed(target: PageTarget, counters: MapFixtureCounters) {
  if (target.key !== 'MAP') return

  for (const [endpoint, count] of Object.entries(counters)) {
    expect(count, `Map ${endpoint} fixture was not exercised`).toBeGreaterThan(0)
  }
}

function expectQuestDetailFixturesUsed(
  target: PageTarget,
  counters: QuestDetailFixtureCounters,
) {
  if (target.key !== 'QUEST_DETAIL') return

  expect(counters.detail, 'Quest detail fixture was not exercised').toBeGreaterThan(0)
  expect(counters.list, 'Quest list fixture was not exercised').toBeGreaterThan(0)
}

function expectCatalogFixturesUsed(target: PageTarget, counters: CatalogFixtureCounters) {
  if (target.key !== 'PLACES' && target.key !== 'QUESTS') return

  expect(
    counters.unexpectedMethods,
    'Catalog fixture received non-GET requests',
  ).toEqual([])
  if (target.key === 'PLACES') {
    expect(counters.places, 'Places catalog fixture was not exercised').toBeGreaterThan(0)
  }
  if (target.key === 'QUESTS') {
    expect(counters.quests, 'Quests catalog fixture was not exercised').toBeGreaterThan(0)
  }
}

/** Профиль берётся из проекта Playwright, а не из ширины вьюпорта. */
function profileFromProject(projectName: string): PerfProfile {
  const profile = PERF_PROFILE_BY_PROJECT[projectName as keyof typeof PERF_PROFILE_BY_PROJECT]
  if (profile) return profile
  throw new Error(
    `pages-perf-budget: project "${projectName}" is not mapped to a performance profile. ` +
      'Add the mapping instead of measuring an unknown profile.',
  )
}

/**
 * Режим снятия baseline: печатает измерения и не сверяет их с таблицей.
 * Нужен ровно один раз — чтобы заполнить таблицу реальными числами, а не
 * придуманными. В CI запрещён: там гейт обязан именно проверять.
 */
const BASELINE_MODE = process.env.PERF_BUDGET_BASELINE === '1'

// Проверка на уровне модуля, а не внутри теста: иначе защита зависела бы от
// `mode: 'serial'` — при параллельном режиме второй тест молча пропустил бы
// транспортные бюджеты.
if (BASELINE_MODE && process.env.CI) {
  throw new Error('PERF_BUDGET_BASELINE is forbidden in CI: the gate must assert, not just report')
}

for (const target of PAGES) {
  test.describe(`@perf ${target.name} — Performance Budget (prod build)`, () => {
    test.describe.configure({ mode: 'serial' })

    test(`${target.name}: Core Web Vitals within budget`, async ({ page }, testInfo) => {
      const profile = profileFromProject(testInfo.project.name)
      const pageErrors: string[] = []
      page.on('pageerror', (error) => pageErrors.push(error.message))

      if (target.key === 'SEARCH') {
        await page.setViewportSize(
          profile === 'mobile'
            ? { width: 412, height: 823 }
            : testInfo.project.name === 'chromium-narrow'
              ? PERF_DESKTOP_VIEWPORTS['chromium-narrow']
              : { ...PERF_DESKTOP_VIEWPORTS.chromium, height: 900 },
        )
        // #1499: CPU-троттлинг идёт через общий хелпер, чтобы множитель жил
        // одним определением на все перф-гейты, а не тремя копиями.
        await applyCpuThrottling(page, MOBILE_THROTTLE_PROFILE.cpuRate)
      }

      await injectPerfObservers(page)
      await installDeterministicSearchApi(page, target)
      const mapFixtureCounters = await installDeterministicMapApi(page, target)
      const catalogFixtureCounters = await installDeterministicCatalogApi(page, target)
      const questFixtureCounters = await installDeterministicQuestDetailApi(page, target)

      await page.goto(target.path, { waitUntil: 'load', timeout: 60_000 })
      await waitForReady(page, target.readySelector, target.requireReadySelector)
      expectMapFixturesUsed(target, mapFixtureCounters)
      expectCatalogFixturesUsed(target, catalogFixtureCounters)
      expectQuestDetailFixturesUsed(target, questFixtureCounters)
      const observedProfile = await collectObservedProfile(page)
      const domCounts = await collectFirstScreenElements(page)
      await beginPostReadyClsCollection(page)
      await page.waitForTimeout(500)

      if (target.key === 'SEARCH') {
        const screenshotPath = testInfo.outputPath(`search-${profile}-settled.png`)
        await page.screenshot({ path: screenshotPath, fullPage: false })
        await testInfo.attach(`search-${profile}-settled`, {
          path: screenshotPath,
          contentType: 'image/png',
        })
      }

      const metrics = await collectMetrics(page)
      const resolved = BASELINE_MODE ? null : resolveEffectiveBudget(target.key, profile)
      const budget = resolved?.budget ?? null

      const report = {
        page: target.path,
        project: testInfo.project.name,
        requestedProfile: profile,
        observedProfile,
        budget,
        ignoredOverrides: resolved?.ignoredOverrides ?? [],
        metrics: {
          lcp: metrics.lcp != null ? `${Math.round(metrics.lcp)}ms` : 'N/A',
          fcp: metrics.fcp != null ? `${Math.round(metrics.fcp)}ms` : 'N/A',
          tbt: `${Math.round(metrics.tbt)}ms`,
          clsTotal: metrics.cls.toFixed(4),
          clsAfterReady: metrics.clsAfterReady.toFixed(4),
          longTaskCount: metrics.longTaskCount,
          firstScreenElements: domCounts.firstScreenElements,
          documentElements: domCounts.documentElements,
        },
        clsSources: metrics.clsSources,
      }
      console.log(`\n📊 PERF BUDGET — ${target.name} (${profile})`)
      console.log(JSON.stringify(report, null, 2))
      testInfo.annotations.push({ type: 'perf-budget', description: JSON.stringify(report) })

      // Запрошенный и фактический профиль обязаны совпадать: узкий вьюпорт на
      // desktop-браузере — отдельный responsive budget, а не мобильный замер (#1287/#1564).
      if (profile === 'mobile') {
        expect(observedProfile.hasTouch, 'mobile profile without touch support').toBe(true)
        expect(observedProfile.devicePixelRatio, 'mobile profile with DPR 1').toBeGreaterThan(1)
        expect(observedProfile.mobileUserAgent, 'mobile profile without a mobile user agent').toBe(true)
      } else {
        expect(observedProfile.hasTouch, 'desktop profile reported touch support').toBe(false)
        const expectedWidth =
          testInfo.project.name === 'chromium-narrow'
            ? PERF_DESKTOP_VIEWPORTS['chromium-narrow'].width
            : PERF_DESKTOP_VIEWPORTS.chromium.width
        expect(
          observedProfile.viewportWidth,
          `${testInfo.project.name} rendered at the wrong width`,
        ).toBe(expectedWidth)
        if (testInfo.project.name === 'chromium-narrow') {
          expect(
            observedProfile.viewportHeight,
            'chromium-narrow must exercise the 1152x720 regression viewport',
          ).toBe(PERF_DESKTOP_VIEWPORTS['chromium-narrow'].height)
        }
      }

      expect(pageErrors, `${target.name} (${profile}) emitted page errors`).toEqual([])

      if (BASELINE_MODE) {
        console.log(`\n⚠️  BASELINE MODE — budgets not asserted for ${target.name} (${profile})`)
        return
      }

      const violations = evaluatePageBudget(
        {
          cls: metrics.cls,
          firstScreenElements: domCounts.firstScreenElements,
          lcp: metrics.lcp,
          fcp: metrics.fcp,
          tbt: metrics.tbt,
          longTaskCount: metrics.longTaskCount,
          clsSourceFingerprints: metrics.clsSources.flatMap((entry) => entry.sources),
        },
        budget!,
      )

      // Позитивный контроль запрещённых узлов: если селектор перестал находиться,
      // проверка «узла нет в сдвигах» проходила бы вхолостую.
      for (const forbidden of budget!.skipHeaderPositiveControl ? [] : FORBIDDEN_SHIFT_SOURCES) {
        if (!forbidden.presentOn.includes(profile)) continue
        expect(
          await page.locator(forbidden.selector).count(),
          `${forbidden.id}: selector ${forbidden.selector} matched nothing on ${profile} — the forbidden-source check would pass vacuously`,
        ).toBeGreaterThan(0)
      }

      expect(
        violations,
        `${target.name} (${profile}) budget violations:\n${JSON.stringify(violations, null, 2)}`,
      ).toEqual([])
    })

    test(`${target.name}: Network transfer budget (JS/total/requests)`, async ({ page }, testInfo) => {
      const profile = profileFromProject(testInfo.project.name)
      const budget = BASELINE_MODE ? null : resolveEffectiveBudget(target.key, profile).budget
      await injectPerfObservers(page)
      await installDeterministicSearchApi(page, target)
      const mapFixtureCounters = await installDeterministicMapApi(page, target)
      const catalogFixtureCounters = await installDeterministicCatalogApi(page, target)
      const questFixtureCounters = await installDeterministicQuestDetailApi(page, target)

      const tracker = createNetworkTracker(page, {
        ignoreBudgetRequest: (url) => shouldIgnoreBudgetRequest(target, url),
      })
      await page.goto(target.path, { waitUntil: 'load', timeout: 60_000 })
      await waitForReady(page, target.readySelector, target.requireReadySelector)
      expectMapFixturesUsed(target, mapFixtureCounters)
      expectCatalogFixturesUsed(target, catalogFixtureCounters)
      expectQuestDetailFixturesUsed(target, questFixtureCounters)

      const stats = tracker.getStats()
      console.log(`\n📦 NETWORK BUDGET — ${target.name} (${profile})`)
      console.log(
        JSON.stringify(
          {
            totalKB: stats.totalKB,
            jsKB: stats.jsKB,
            imgKB: stats.imgKB,
            project: testInfo.project.name,
            requestCount: {
              budgetScoped: stats.requestCount,
              all: stats.allRequestCount,
              ignoredThirdParty: stats.ignoredThirdPartyRequestCount,
              ignoredBudget: stats.ignoredBudgetRequestCount,
            },
            largestResources: stats.largestResources,
            mediaRequestsWithoutWidth: stats.mediaRequestsWithoutWidth,
          },
          null,
          2,
        ),
      )
      test.info().annotations.push({ type: 'network-budget', description: JSON.stringify(stats) })

      // #1161: медиа-запрос без `w` возвращает мастер целиком — 132 344 B вместо
      // 2 582 B на плитке 132×132 (замер прода 2026-07-30). Раньше это правило жило
      // комментарием в `utils/imageProxy.ts` и трижды нарушалось незаметно
      // (#1103, #1113, #1104), поэтому здесь оно проверяется трафиком, а не кодом.
      expect(
        stats.mediaRequestsWithoutWidth,
        `${target.name}: ${stats.mediaRequestsWithoutWidth.length} медиа-запрос(ов) без w — прокси отдаёт мастер целиком`,
      ).toEqual([])

      if (BASELINE_MODE) {
        console.log(`\n⚠️  BASELINE MODE — transfer budgets not asserted for ${target.name} (${profile})`)
        return
      }

      // Транспортные бюджеты берутся из таблицы на пару (маршрут, профиль):
      // при DPR>1 картинки выбирают другие ступени `?w=`, поэтому один общий
      // потолок для обеих раскладок либо слишком мягкий, либо ложно красный.
      // Сравнение — та же общая функция, что покрыта unit-тестами.
      const transferViolations = evaluateTransferBudget(
        { jsKB: stats.jsKB, totalKB: stats.totalKB, requestCount: stats.requestCount },
        budget!,
      )
      expect(
        transferViolations,
        `${target.name} (${profile}) transfer violations (all requests=${stats.allRequestCount}):\n${JSON.stringify(transferViolations, null, 2)}`,
      ).toEqual([])
    })
  })
}
