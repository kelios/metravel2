/**
 * Performance budget tests for the main public pages: Home, Search, Map, Places.
 *
 * Companion to `e2e/travel-details-perf-budget.spec.ts` (which covers the travel
 * details page). Runs against a **production build** (dist/prod) served locally
 * and measures Core Web Vitals + network transfer per page via the browser
 * Performance API.
 *
 * Run:
 *   npm run e2e:perf-budget:pages   (оба профиля + негативная проба)
 *
 * Числовые бюджеты живут в `helpers/pagesPerfBudgets.ts` — по записи на пару
 * (маршрут, профиль). Переменные окружения (`PERF_CLS_MAX`, `PERF_LCP_MAX_MS`,
 * `PERF_MAX_TOTAL_KB`, … и их варианты с суффиксом `_HOME`/`_SEARCH`/…) могут
 * только УЖЕСТОЧИТЬ потолок: послабление игнорируется и печатается в отчёте
 * (#1287). Снять baseline можно `PERF_BUDGET_BASELINE=1` — в CI запрещено.
 */

import { test, expect } from '@playwright/test'
import {
  injectPerfObservers,
  beginPostReadyClsCollection,
  collectMetrics,
  collectFirstScreenElements,
  collectObservedProfile,
  createNetworkTracker,
} from './helpers/perfBudget'
import {
  FORBIDDEN_SHIFT_SOURCES,
  evaluatePageBudget,
  evaluateTransferBudget,
  resolveEffectiveBudget,
  type PerfProfile,
} from './helpers/pagesPerfBudgets'

type PageTarget = {
  key: string
  name: string
  path: string
  /** Page-specific ready selector; falls back to <h1> then networkidle. */
  readySelector: string
}

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
    readySelector: '[data-testid="search-container"]',
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
    readySelector: 'h1',
  },
  // #1161: каталог квестов держит обложки на `/quest-cover/**` — путь, который до
  // #1113 вообще не распознавался как медийный и уходил без `w`.
  {
    key: 'QUESTS',
    name: 'Quests',
    path: '/quests',
    readySelector: 'h1',
  },
]

function shouldIgnoreBudgetRequest(target: PageTarget, url: string) {
  if (target.key !== 'MAP') return false

  try {
    const parsed = new URL(url)
    return parsed.pathname.startsWith('/proxy/tiles/')
  } catch {
    return false
  }
}

async function waitForReady(page: any, selector: string) {
  await Promise.race([
    page.waitForSelector(selector, { timeout: 30_000 }).catch(() => null),
    page.waitForSelector('h1', { timeout: 30_000 }).catch(() => null),
  ])
  await page.waitForLoadState('networkidle').catch(() => null)
}

async function installDeterministicSearchApi(page: any, target: PageTarget) {
  if (target.key !== 'SEARCH') return

  const fulfillJson = (route: any, body: unknown) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })

  await page.route('**/getFiltersTravel/**', (route: any) =>
    fulfillJson(route, {
      categories: [],
      categoryTravelAddress: [],
      companions: [],
      complexity: [],
      month: [],
      over_nights_stay: [],
      sortings: [],
      transports: [],
    }),
  )
  await page.route('**/countriesforsearch/**', (route: any) => fulfillJson(route, []))

  const fulfillTravelCatalog = async (route: any) => {
    const request = route.request()
    if (request.method() !== 'GET') {
      await route.fallback()
      return
    }

    const pathname = new URL(request.url()).pathname
    if (pathname.endsWith('/travels/facets/')) {
      await fulfillJson(route, { total: 0, facets: {} })
      return
    }
    if (pathname.endsWith('/api/travels/') || pathname === '/travels/') {
      await fulfillJson(route, { data: [], total: 0 })
      return
    }

    await route.fallback()
  }

  await page.route('**/api/travels/**', fulfillTravelCatalog)
  await page.route('**/travels/**', fulfillTravelCatalog)
}

/** Профиль берётся из проекта Playwright, а не из ширины вьюпорта. */
function profileFromProject(projectName: string): PerfProfile {
  if (projectName === 'chromium-mobile') return 'mobile'
  if (projectName === 'chromium') return 'desktop'
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

      await injectPerfObservers(page)
      await installDeterministicSearchApi(page, target)

      await page.goto(target.path, { waitUntil: 'load', timeout: 60_000 })
      await waitForReady(page, target.readySelector)
      const observedProfile = await collectObservedProfile(page)
      const domCounts = await collectFirstScreenElements(page)
      await beginPostReadyClsCollection(page)
      await page.waitForTimeout(500)

      const metrics = await collectMetrics(page)
      const resolved = BASELINE_MODE ? null : resolveEffectiveBudget(target.key, profile)
      const budget = resolved?.budget ?? null

      const report = {
        page: target.path,
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
      // desktop-браузере — это не мобильный замер (#1287).
      if (profile === 'mobile') {
        expect(observedProfile.hasTouch, 'mobile profile without touch support').toBe(true)
        expect(observedProfile.devicePixelRatio, 'mobile profile with DPR 1').toBeGreaterThan(1)
        expect(observedProfile.mobileUserAgent, 'mobile profile without a mobile user agent').toBe(true)
      } else {
        expect(observedProfile.hasTouch, 'desktop profile reported touch support').toBe(false)
      }

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

      const tracker = createNetworkTracker(page, {
        ignoreBudgetRequest: (url) => shouldIgnoreBudgetRequest(target, url),
      })
      await page.goto(target.path, { waitUntil: 'load', timeout: 60_000 })
      await waitForReady(page, target.readySelector)

      const stats = tracker.getStats()
      console.log(`\n📦 NETWORK BUDGET — ${target.name} (${profile})`)
      console.log(
        JSON.stringify(
          {
            totalKB: stats.totalKB,
            jsKB: stats.jsKB,
            imgKB: stats.imgKB,
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
