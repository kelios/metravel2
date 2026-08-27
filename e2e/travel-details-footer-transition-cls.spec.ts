import { expect, test, type Page } from '@playwright/test'

import {
  FALLBACK_TRAVEL_SLUG,
  mockFallbackTravelDetails,
  preacceptCookies,
} from './helpers/navigation'
import {
  installTravelFooterLayoutShiftGuard,
  readTravelFooterLayoutShiftReport,
  resetTravelFooterLayoutShiftGuard,
} from './helpers/travelFooterLayoutShiftGuard'
import { isRecoverableReactHydrationError } from './helpers/consoleGuards'

const VIEWPORTS = [
  { height: 640, label: 'desktop-narrow', totalClsBudget: 0.388872, width: 1024 },
  { height: 768, label: 'desktop', totalClsBudget: 0.071479, width: 1366 },
  { height: 844, label: 'mobile-web', totalClsBudget: null, width: 390 },
] as const

const useLiveTravelData = process.env.TASK_1604_USE_LIVE_DATA === '1'
const liveTravelSlug = process.env.TASK_1604_TRAVEL_SLUG?.trim() || FALLBACK_TRAVEL_SLUG
const travelSlug = useLiveTravelData ? liveTravelSlug : FALLBACK_TRAVEL_SLUG
const candidateBaseUrl = process.env.BASE_URL || 'http://127.0.0.1:4716'
const FOOTER_GEOMETRY_TRAVEL_NAME = 'Заброшенные усадьбы и замки Беларуси: 38 мест'

async function proxyLiveApiThroughCandidate(page: Page) {
  const candidateOrigin = new URL(candidateBaseUrl).origin

  await page.route('https://metravel.by/api/**', async (route) => {
    const request = route.request()
    const method = request.method()
    const corsHeaders = {
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers':
        (await request.headerValue('access-control-request-headers')) || '*',
      'access-control-allow-methods': 'GET, HEAD, OPTIONS',
      'access-control-allow-origin': candidateOrigin,
    }

    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders })
      return
    }
    if (method !== 'GET' && method !== 'HEAD') {
      await route.fulfill({
        status: 405,
        headers: corsHeaders,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Live-data browser probe is read-only' }),
      })
      return
    }

    const sourceUrl = new URL(request.url())
    const candidateUrl = new URL(`${sourceUrl.pathname}${sourceUrl.search}`, candidateOrigin)
    const response = await page.request.fetch(candidateUrl.toString(), {
      method,
      failOnStatusCode: false,
    })
    try {
      await route.fulfill({
        response,
        headers: { ...response.headers(), ...corsHeaders },
      })
    } catch (error) {
      // A component may cancel a background query after the proxy response was
      // fetched but before it is fulfilled. Playwright then owns the cancelled
      // route already; requestfailed remains the fail-closed network signal.
      if (!String(error).includes('Route is already handled')) throw error
    }
  })
}

const isRelevantNetworkRequest = (url: string, resourceType: string) => {
  const pathname = new URL(url).pathname
  return (
    ['document', 'fetch', 'script', 'stylesheet', 'xhr'].includes(resourceType) ||
    pathname === '/api' ||
    pathname.startsWith('/api/')
  )
}

test.describe('@perf Travel details deferred footer transition CLS', () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.label}: bottom-scroll does not expose footer nodes as layout-shift sources`, async ({
      page,
    }) => {
      const browserErrors: string[] = []
      const networkFailures: string[] = []
      page.on('pageerror', (error) => browserErrors.push(String(error.message || error)))
      page.on('console', (message) => {
        if (message.type() === 'error') browserErrors.push(message.text())
      })
      page.on('requestfailed', (request) => {
        if (!isRelevantNetworkRequest(request.url(), request.resourceType())) return
        networkFailures.push(
          `${request.resourceType()} ${request.url()} ${request.failure()?.errorText ?? 'failed'}`,
        )
      })
      page.on('response', (response) => {
        const request = response.request()
        if (
          response.status() >= 400 &&
          isRelevantNetworkRequest(response.url(), request.resourceType())
        ) {
          networkFailures.push(`${response.status()} ${request.resourceType()} ${response.url()}`)
        }
      })

      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await installTravelFooterLayoutShiftGuard(page)
      await preacceptCookies(page)
      if (useLiveTravelData) await proxyLiveApiThroughCandidate(page)
      else await mockFallbackTravelDetails(page, { name: FOOTER_GEOMETRY_TRAVEL_NAME })

      await page.goto(`/travels/${travelSlug}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      })

      await expect(page.getByTestId('travel-details-page')).toBeVisible({ timeout: 30_000 })
      const transition = page.getByTestId('travel-details-footer-transition')
      await expect(transition).toBeAttached({ timeout: 30_000 })
      const scrollContainer = page.getByTestId('travel-details-scroll')
      await expect(scrollContainer).toBeVisible()
      await expect(page.getByTestId('travel-details-footer-resolved-frame')).toBeAttached({
        timeout: 30_000,
      })
      await expect(page.getByTestId('travel-details-footer-transition-placeholder')).toHaveCount(0)

      const initialGeometry = await scrollContainer.evaluate((node: HTMLElement) => {
        const transition = node.querySelector<HTMLElement>(
          '[data-testid="travel-details-footer-transition"]',
        )
        const runtime = node.querySelector<HTMLElement>(
          '[data-testid="travel-details-footer-resolved-frame"]',
        )
        return {
          clientHeight: node.clientHeight,
          runtimeHeight: runtime?.getBoundingClientRect().height ?? null,
          transitionHeight: transition?.getBoundingClientRect().height ?? null,
        }
      })
      await resetTravelFooterLayoutShiftGuard(page)
      const initialScroll = await scrollContainer.evaluate(async (node: HTMLElement) => {
        for (let attempt = 0; attempt < 8; attempt += 1) {
          node.scrollTop = node.scrollHeight
          node.dispatchEvent(new Event('scroll', { bubbles: true }))
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        }
        node.scrollTop = node.scrollHeight
        return {
          clientHeight: node.clientHeight,
          maxScrollTop: Math.max(0, node.scrollHeight - node.clientHeight),
          scrollHeight: node.scrollHeight,
          scrollTop: node.scrollTop,
        }
      })
      expect(
        initialScroll.maxScrollTop,
        'travel details must use a scrollable viewport',
      ).toBeGreaterThan(0)
      expect(
        initialScroll.maxScrollTop - initialScroll.scrollTop,
        `bottom-scroll did not reach the inner travel viewport: ${JSON.stringify(initialScroll)}`,
      ).toBeLessThanOrEqual(2)

      await expect(page.getByTestId('travel-details-footer-resolved-frame')).toBeVisible({
        timeout: 30_000,
      })
      await expect(page.getByTestId('travel-details-footer-transition-placeholder')).toHaveCount(0)
      const runtimeLayer = page.getByTestId('travel-details-footer-transition-runtime')
      await expect(runtimeLayer).not.toHaveAttribute('aria-hidden', 'true')
      await expect(runtimeLayer).not.toHaveAttribute('inert', '')
      const finalGeometry = await scrollContainer.evaluate(async (node: HTMLElement) => {
        node.scrollTop = node.scrollHeight
        node.dispatchEvent(new Event('scroll', { bubbles: true }))
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        )
        node.scrollTop = node.scrollHeight
        const transition = node.querySelector<HTMLElement>(
          '[data-testid="travel-details-footer-transition"]',
        )
        const runtime = node.querySelector<HTMLElement>(
          '[data-testid="travel-details-footer-resolved-frame"]',
        )
        const transitionRect = transition?.getBoundingClientRect()
        const runtimeRect = runtime?.getBoundingClientRect()
        return {
          documentHorizontalOverflow: Math.max(
            document.documentElement.scrollWidth - document.documentElement.clientWidth,
            document.body.scrollWidth - document.body.clientWidth,
          ),
          horizontalOverflow: node.scrollWidth - node.clientWidth,
          maxScrollTop: Math.max(0, node.scrollHeight - node.clientHeight),
          runtimeHeight: runtimeRect?.height ?? null,
          scrollTop: node.scrollTop,
          transitionHeight: transitionRect?.height ?? null,
          trailingReserve:
            transitionRect && runtimeRect
              ? Math.max(0, transitionRect.height - runtimeRect.height)
              : null,
        }
      })
      expect(finalGeometry.maxScrollTop - finalGeometry.scrollTop).toBeLessThanOrEqual(2)
      expect(finalGeometry.documentHorizontalOverflow).toBeLessThanOrEqual(1)
      expect(finalGeometry.horizontalOverflow).toBeLessThanOrEqual(1)
      expect(finalGeometry.trailingReserve).not.toBeNull()
      expect(
        finalGeometry.trailingReserve,
        `resolved footer left a persistent blank reserve: ${JSON.stringify(finalGeometry)}`,
      ).toBeLessThanOrEqual(1)

      const report = await readTravelFooterLayoutShiftReport(page)
      const unexpectedBrowserErrors = useLiveTravelData
        ? browserErrors
        : browserErrors.filter((message) => !isRecoverableReactHydrationError(message))
      await page.screenshot({
        path: `.codex-temp/task-1604/${viewport.label}-${useLiveTravelData ? 'live' : 'fixture'}.png`,
      })
      test.info().annotations.push({
        type: `travel-footer-cls-${viewport.label}`,
        description: JSON.stringify({ finalGeometry, initialGeometry, report }),
      })
      console.log(
        `[task-1604][${viewport.label}][${useLiveTravelData ? 'live' : 'fixture'}] ${JSON.stringify({ finalGeometry, initialGeometry, report })}`,
      )

      expect(
        report.footerEntries,
        `footer nodes reappeared in layout-shift sources; footerValue=${report.footerValue}; report=${JSON.stringify(report)}`,
      ).toEqual([])
      expect(report.footerValue).toBe(0)
      if (viewport.totalClsBudget != null) {
        expect(
          report.totalValue,
          `total candidate CLS exceeded ${viewport.totalClsBudget}; report=${JSON.stringify(report)}`,
        ).toBeLessThanOrEqual(viewport.totalClsBudget)
      }
      expect(
        unexpectedBrowserErrors,
        `browser console/page errors: ${browserErrors.join('\n---\n')}`,
      ).toEqual([])
      expect(
        networkFailures,
        `relevant network failures: ${networkFailures.join('\n---\n')}`,
      ).toEqual([])
      if (useLiveTravelData) await page.unrouteAll({ behavior: 'ignoreErrors' })
    })
  }
})
