/**
 * Performance budget tests for the main public pages: Home, Search, Map, Places.
 *
 * Companion to `e2e/travel-details-perf-budget.spec.ts` (which covers the travel
 * details page). Runs against a **production build** (dist/prod) served locally
 * and measures Core Web Vitals + network transfer per page via the browser
 * Performance API.
 *
 * Run:
 *   yarn build:web:prod
 *   npx playwright test e2e/pages-perf-budget.spec.ts --project=chromium
 *
 * Budgets default to lenient local values and tighten under CI. Override per
 * env (applies to all pages):
 *   PERF_LCP_MAX_MS  PERF_TBT_MAX_MS  PERF_CLS_MAX  PERF_FCP_MAX_MS
 *   PERF_MAX_JS_KB   PERF_MAX_TOTAL_KB  PERF_MAX_REQUESTS  PERF_MAX_LONG_TASKS
 * Per-page LCP override:
 *   PERF_LCP_MAX_MS_HOME / _SEARCH / _MAP / _PLACES
 */

import { test, expect } from '@playwright/test'
import {
  envNum,
  injectPerfObservers,
  collectMetrics,
  createNetworkTracker,
} from './helpers/perfBudget'

const IS_CI = Boolean(process.env.CI)

const TBT_MAX_MS = envNum('PERF_TBT_MAX_MS', IS_CI ? 600 : 1500)
const CLS_MAX = envNum('PERF_CLS_MAX', 0.3)
const FCP_MAX_MS = envNum('PERF_FCP_MAX_MS', IS_CI ? 3000 : 6000)
const MAX_LONG_TASKS = envNum('PERF_MAX_LONG_TASKS', IS_CI ? 8 : 20)

const MAX_JS_TRANSFER_KB = envNum('PERF_MAX_JS_KB', 2600)
const MAX_TOTAL_TRANSFER_KB = envNum('PERF_MAX_TOTAL_KB', IS_CI ? 7000 : 9000)
const MAX_REQUESTS = envNum('PERF_MAX_REQUESTS', 120)

type PageTarget = {
  key: string
  name: string
  path: string
  /** Page-specific ready selector; falls back to <h1> then networkidle. */
  readySelector: string
  /** Default LCP budget (ms) — map/places are heavier, so more lenient. */
  lcpMaxMs: number
}

const DEFAULT_LCP = IS_CI ? 4000 : 10_000

const PAGES: PageTarget[] = [
  {
    key: 'HOME',
    name: 'Home',
    path: '/',
    readySelector: '[data-testid="home-hero"]',
    lcpMaxMs: envNum('PERF_LCP_MAX_MS_HOME', envNum('PERF_LCP_MAX_MS', DEFAULT_LCP)),
  },
  {
    key: 'SEARCH',
    name: 'Search',
    path: '/search',
    readySelector: '[data-testid="search-container"]',
    lcpMaxMs: envNum('PERF_LCP_MAX_MS_SEARCH', envNum('PERF_LCP_MAX_MS', DEFAULT_LCP)),
  },
  {
    key: 'MAP',
    name: 'Map',
    path: '/map',
    readySelector: '[data-testid="map-leaflet-wrapper"]',
    lcpMaxMs: envNum('PERF_LCP_MAX_MS_MAP', envNum('PERF_LCP_MAX_MS', IS_CI ? 6000 : 12_000)),
  },
  {
    key: 'PLACES',
    name: 'Places',
    path: '/places',
    readySelector: 'h1',
    lcpMaxMs: envNum('PERF_LCP_MAX_MS_PLACES', envNum('PERF_LCP_MAX_MS', IS_CI ? 5000 : 11_000)),
  },
]

async function waitForReady(page: any, selector: string) {
  await Promise.race([
    page.waitForSelector(selector, { timeout: 30_000 }).catch(() => null),
    page.waitForSelector('h1', { timeout: 30_000 }).catch(() => null),
  ])
  await page.waitForLoadState('networkidle').catch(() => null)
}

for (const target of PAGES) {
  test.describe(`@perf ${target.name} — Performance Budget (prod build)`, () => {
    test.describe.configure({ mode: 'serial' })

    test(`${target.name}: Core Web Vitals within budget (desktop)`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await injectPerfObservers(page)

      await page.goto(target.path, { waitUntil: 'load', timeout: 60_000 })
      await waitForReady(page, target.readySelector)

      const metrics = await collectMetrics(page)

      const report = {
        page: target.path,
        thresholds: { lcpMaxMs: target.lcpMaxMs, TBT_MAX_MS, CLS_MAX, FCP_MAX_MS, MAX_LONG_TASKS },
        metrics: {
          lcp: metrics.lcp != null ? `${Math.round(metrics.lcp)}ms` : 'N/A',
          fcp: metrics.fcp != null ? `${Math.round(metrics.fcp)}ms` : 'N/A',
          tbt: `${Math.round(metrics.tbt)}ms`,
          cls: metrics.cls.toFixed(4),
          longTaskCount: metrics.longTaskCount,
        },
        clsSources: metrics.clsSources,
      }
      console.log(`\n📊 PERF BUDGET — ${target.name} (Desktop)`)
      console.log(JSON.stringify(report, null, 2))
      test.info().annotations.push({ type: 'perf-budget', description: JSON.stringify(report) })

      if (metrics.lcp != null) {
        expect(metrics.lcp, `${target.name} LCP ${Math.round(metrics.lcp)}ms > ${target.lcpMaxMs}ms`).toBeLessThanOrEqual(
          target.lcpMaxMs,
        )
      }
      if (metrics.fcp != null) {
        expect(metrics.fcp, `${target.name} FCP ${Math.round(metrics.fcp)}ms > ${FCP_MAX_MS}ms`).toBeLessThanOrEqual(
          FCP_MAX_MS,
        )
      }
      expect(metrics.tbt, `${target.name} TBT ${Math.round(metrics.tbt)}ms > ${TBT_MAX_MS}ms`).toBeLessThanOrEqual(
        TBT_MAX_MS,
      )
      expect(metrics.cls, `${target.name} CLS ${metrics.cls.toFixed(4)} > ${CLS_MAX}`).toBeLessThanOrEqual(CLS_MAX)
      expect(
        metrics.longTaskCount,
        `${target.name} ${metrics.longTaskCount} long tasks > ${MAX_LONG_TASKS}`,
      ).toBeLessThanOrEqual(MAX_LONG_TASKS)
    })

    test(`${target.name}: Network transfer budget (JS/total/requests)`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await injectPerfObservers(page)

      const tracker = createNetworkTracker(page)
      await page.goto(target.path, { waitUntil: 'load', timeout: 60_000 })
      await waitForReady(page, target.readySelector)

      const stats = tracker.getStats()
      console.log(`\n📦 NETWORK BUDGET — ${target.name}`)
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
            },
            largestResources: stats.largestResources,
          },
          null,
          2,
        ),
      )
      test.info().annotations.push({ type: 'network-budget', description: JSON.stringify(stats) })

      expect(stats.jsKB, `${target.name} JS ${stats.jsKB}KB > ${MAX_JS_TRANSFER_KB}KB`).toBeLessThanOrEqual(
        MAX_JS_TRANSFER_KB,
      )
      expect(stats.totalKB, `${target.name} total ${stats.totalKB}KB > ${MAX_TOTAL_TRANSFER_KB}KB`).toBeLessThanOrEqual(
        MAX_TOTAL_TRANSFER_KB,
      )
      expect(
        stats.requestCount,
        `${target.name} ${stats.requestCount} first-party requests > ${MAX_REQUESTS} (all=${stats.allRequestCount})`,
      ).toBeLessThanOrEqual(MAX_REQUESTS)
    })
  })
}
