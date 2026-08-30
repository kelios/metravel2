import type { Browser, Page } from '@playwright/test'

import { expect, test } from './fixtures'
import {
  FALLBACK_TRAVEL_ID,
  FALLBACK_TRAVEL_SLUG,
  gotoWithRetry,
  mockFallbackTravelDetails,
  mockUnavailableApi,
  preacceptCookies,
} from './helpers/navigation'
import { collectMetrics, injectPerfObservers } from './helpers/perfBudget'

type StaticHeaderGeometry = {
  bottom: number
  contextHeight: number
  height: number
}

/**
 * The fallback helper owns only its explicit travel endpoints. Register this
 * handler afterwards so those requests fall through to the fixture while every
 * unrelated API call fails locally instead of reaching a live backend.
 */
async function blockUnmockedApiAroundTravelFixture(page: Page) {
  await page.route('**/api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname
    const isFixtureRequest =
      pathname.includes(`/travels/resolve-slug/${FALLBACK_TRAVEL_SLUG}/`) ||
      pathname.includes(`/travels/by-slug/${FALLBACK_TRAVEL_SLUG}/`) ||
      pathname === `/api/travels/${FALLBACK_TRAVEL_ID}/` ||
      pathname.includes(`/api/travels/${FALLBACK_TRAVEL_ID}/near/`) ||
      pathname.includes('/api/travels/popular/')

    if (isFixtureRequest) {
      await route.fallback()
      return
    }

    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'E2E API unavailable' }),
    })
  })
}

async function readStaticHeader(
  browser: Browser,
  baseURL: string,
  route: string,
  width: number,
  expectTravelMarker: boolean,
): Promise<StaticHeaderGeometry> {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    viewport: { width, height: 900 },
  })

  try {
    const staticPage = await context.newPage()
    await staticPage.goto(route, { waitUntil: 'domcontentloaded' })

    const header = staticPage.getByTestId('main-header')
    await expect(header, 'the static export must contain the global header').toBeVisible()
    await expect(staticPage.locator('[data-header-slot="account"]')).toHaveCount(1)
    await expect(staticPage.locator('[data-header-context-fallback="travel"]')).toHaveCount(
      expectTravelMarker ? 1 : 0,
    )

    const headerBox = await header.boundingBox()
    expect(headerBox, 'the static header must have measurable geometry').not.toBeNull()
    const contextBox = expectTravelMarker
      ? await staticPage.locator('[data-header-context-fallback="travel"]').boundingBox()
      : null

    return {
      bottom: headerBox!.y + headerBox!.height,
      contextHeight: contextBox?.height ?? 0,
      height: headerBox!.height,
    }
  } finally {
    await context.close()
  }
}

async function waitForRuntimeHeader(page: Page) {
  await expect(page.locator('[data-header-slot="account"]')).toHaveCount(0)
  await expect(page.locator('[data-header-context-fallback="travel"]')).toHaveCount(0)

  const box = await page.getByTestId('main-header').boundingBox()
  expect(box, 'the hydrated app must keep the global header mounted').not.toBeNull()
  return box!
}

const TRAVEL_GEOMETRY = [
  { width: 390, expectedContextHeight: 52 },
  { width: 1024, expectedContextHeight: 46 },
  { width: 1366, expectedContextHeight: 0 },
  { width: 1920, expectedContextHeight: 0 },
] as const

test.describe('Travel header hydration geometry #1563', () => {
  for (const { width, expectedContextHeight } of TRAVEL_GEOMETRY) {
    test(
      `static and runtime travel headers match at ${width}px`,
      async ({ browser, page }, testInfo) => {
        await page.setViewportSize({ width, height: 900 })
        await preacceptCookies(page)
        await mockFallbackTravelDetails(page)
        await blockUnmockedApiAroundTravelFixture(page)

        const baseURL = testInfo.project.use.baseURL
        expect(baseURL, 'Playwright project must define a local baseURL').toBeTruthy()
        const staticHeader = await readStaticHeader(
          browser,
          String(baseURL),
          `/travels/${FALLBACK_TRAVEL_SLUG}`,
          width,
          true,
        )

        await gotoWithRetry(page, `/travels/${FALLBACK_TRAVEL_SLUG}`)
        await expect(page.getByTestId('travel-details-page')).toBeVisible({ timeout: 30_000 })

        const runtimeHeader = await waitForRuntimeHeader(page)

        expect(staticHeader.contextHeight).toBeCloseTo(expectedContextHeight, 0)
        expect(Math.abs(staticHeader.height - runtimeHeader.height)).toBeLessThanOrEqual(1)
        expect(
          Math.abs(staticHeader.bottom - (runtimeHeader.y + runtimeHeader.height)),
        ).toBeLessThanOrEqual(1)

        const runtimeContext = page.getByTestId('header-context-bar')
        if (expectedContextHeight === 0) {
          await expect(runtimeContext).toHaveCount(0)
        } else {
          await expect(runtimeContext).toHaveCount(1)
          const contextBox = await runtimeContext.boundingBox()
          expect(contextBox, 'runtime context row must be measurable').not.toBeNull()
          expect(contextBox!.height).toBeCloseTo(expectedContextHeight, 0)
        }
      },
    )
  }

  test('travel hydration CLS stays below the recorded 1100px baseline', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 900 })
    await injectPerfObservers(page)
    await mockFallbackTravelDetails(page)
    await blockUnmockedApiAroundTravelFixture(page)

    await gotoWithRetry(page, `/travels/${FALLBACK_TRAVEL_SLUG}`)
    await expect(page.getByTestId('travel-details-page')).toBeVisible({ timeout: 30_000 })
    await waitForRuntimeHeader(page)

    const metrics = await collectMetrics(page)
    expect(metrics.cls, `CLS sources: ${JSON.stringify(metrics.clsSources)}`).toBeLessThan(0.0358)
  })

  test('home is an unmarked stable-header control', async ({ browser, page }, testInfo) => {
    await page.setViewportSize({ width: 1366, height: 900 })
    await preacceptCookies(page)
    await mockUnavailableApi(page)

    const baseURL = testInfo.project.use.baseURL
    expect(baseURL, 'Playwright project must define a local baseURL').toBeTruthy()
    const staticHeader = await readStaticHeader(browser, String(baseURL), '/', 1366, false)

    await gotoWithRetry(page, '/')
    await expect(page.getByTestId('home-hero')).toBeVisible({ timeout: 30_000 })

    const runtimeHeader = await waitForRuntimeHeader(page)

    expect(Math.abs(staticHeader.height - runtimeHeader.height)).toBeLessThanOrEqual(1)
  })

  test(
    'quest context bar remains visible and never receives the travel marker',
    async ({ browser, page }, testInfo) => {
      await page.setViewportSize({ width: 1024, height: 900 })
      await preacceptCookies(page)
      await mockUnavailableApi(page)

      const baseURL = testInfo.project.use.baseURL
      expect(baseURL, 'Playwright project must define a local baseURL').toBeTruthy()
      const staticHeader = await readStaticHeader(
        browser,
        String(baseURL),
        '/quests/minsk/header-hydration-control',
        1024,
        false,
      )

      await gotoWithRetry(page, '/quests/minsk/header-hydration-control')
      await expect(page.getByTestId('main-header')).toBeVisible({ timeout: 30_000 })
      await expect(page.locator('[data-header-slot="account"]')).toHaveCount(0)
      await expect(page.getByTestId('header-context-bar')).toBeVisible({ timeout: 30_000 })
      await expect(page.locator('[data-header-context-fallback="travel"]')).toHaveCount(0)

      // Контракт требует равенства статической и рантаймовой шапки на всех трёх
      // маршрутах, а не только на `/` и `/travels/*`: расхождение 130 → 78 в
      // #1563 появилось именно на маршруте, для которого такого контроля не было.
      const runtimeHeader = await waitForRuntimeHeader(page)
      expect(
        Math.abs(staticHeader.height - runtimeHeader.height),
        `quest header must not resize on hydration: static ${staticHeader.height}px vs runtime ${runtimeHeader.height}px`,
      ).toBeLessThanOrEqual(1)
    },
  )
})
