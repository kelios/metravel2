import type { Page, Request, TestInfo } from '@playwright/test'
import { test, expect } from './fixtures'
import { gotoWithRetry, preacceptCookies } from './helpers/navigation'
import { installReadOnlyTravelApi } from './helpers/readOnlyTravelApi'
import {
  HERO_FAVORITE_VIEWPORTS,
  expectGuestFavoriteSignIn,
  expectTravelFavoriteAction,
  expectHeroSwipeAdvances,
} from './helpers/travelHeroFavorite'

const { fetchLiveSha } = require('../scripts/lib/live-build-source') as {
  fetchLiveSha(origin: string): { sha: string; answered: boolean; reason?: string }
}
type SsrNode = { name?: string; attribs?: Record<string, string> }
const { assertSsrDocument } = require('../scripts/lib/ssrDocument') as {
  assertSsrDocument(response: { status: number; headers: Headers }, html: string,
    options: { sha: string; canonical: string }): { find(predicate: (node: SsrNode) => boolean): SsrNode[] }
}

/** Real SSR article and guest actions. Only the resolved article view metric is
 * simulated (204); content/auth reads stay real and other API writes are rejected.
 * The deterministic local spec separately keeps the strict legacy SSG handoff.
 */
const TRAVEL_SLUG =
  process.env.E2E_HERO_FAVORITE_TRAVEL_SLUG || 'zakshuvek-biriuzovyi-karer-dlia-kupaniia-v-krakove'
const TRAVEL_PATH = `/travels/${TRAVEL_SLUG}`
let webOrigin = ''
let sourceSha = ''

type RequestEntry = { id: number; method: string; url: string; resource: string;
  status: number | null; finished: boolean; failure: string | null }

async function withProductionTravel(page: Page, testInfo: TestInfo, exercise: () => Promise<void>) {
  const consoleErrors: string[] = [], pageErrors: string[] = []
  const requests = new Map<Request, RequestEntry>()
  let initialHtml = '', phase = 'resolve-public-identity'
  let initialDocument: Record<string, unknown> | null = null
  let resolvedIdentity: Record<string, unknown> | null = null
  let metrics: Awaited<ReturnType<typeof installReadOnlyTravelApi>> | undefined
  const onConsole = (message: import('@playwright/test').ConsoleMessage) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  }
  const onPageError = (error: Error) => pageErrors.push(error.stack ?? error.message)
  const onRequest = (request: Request) => {
    const url = new URL(request.url())
    if (!['http:', 'https:'].includes(url.protocol)) return
    requests.set(request, { id: requests.size + 1, method: request.method(),
      url: `${url.origin}${url.pathname}`, resource: request.resourceType(),
      status: null, finished: false, failure: null })
  }
  const onResponse = (response: import('@playwright/test').Response) => {
    const entry = requests.get(response.request()); if (entry) entry.status = response.status()
  }
  const onFinished = (request: Request) => { const entry = requests.get(request); if (entry) entry.finished = true }
  const onFailed = (request: Request) => { const entry = requests.get(request); if (entry) entry.failure = request.failure()?.errorText ?? 'unknown' }
  page.on('console', onConsole); page.on('pageerror', onPageError); page.on('request', onRequest)
  page.on('response', onResponse); page.on('requestfinished', onFinished); page.on('requestfailed', onFailed)
  try {
    const resolveURL = new URL(`/api/travels/resolve-slug/${encodeURIComponent(TRAVEL_SLUG)}/`, webOrigin).href
    const resolved = await page.request.get(resolveURL)
    resolvedIdentity = { status: resolved.status(), url: resolved.url() }
    expect(resolved.status(), 'real public resolver must identify the exact article').toBe(200)
    const identity = await resolved.json()
    resolvedIdentity = { ...resolvedIdentity, id: identity.id, slug: identity.slug, match: identity.status }
    expect(identity.status).toBe('exact')
    expect(identity.slug).toBe(TRAVEL_SLUG)
    expect(Number.isSafeInteger(identity.id) && identity.id > 0).toBe(true)
    expect(new URL(resolved.url()).origin).toBe(webOrigin)
    metrics = await installReadOnlyTravelApi(page.context(), { baseURL: webOrigin, travelId: identity.id })
    phase = 'initial-ssr-document'
    const [response] = await Promise.all([
      page.waitForResponse(response => {
        const request = response.request(), url = new URL(response.url())
        return request.isNavigationRequest() && request.frame() === page.mainFrame() &&
          url.origin === webOrigin && url.pathname === TRAVEL_PATH
      }),
      gotoWithRetry(page, TRAVEL_PATH),
    ])
    const headers = response.headers()
    initialDocument = { url: response.url(), status: response.status(), source: headers['x-metravel-ssr-source'],
      contentType: headers['content-type'], cache: headers['x-cache-status'] }
    initialHtml = await response.text()
    const { find } = assertSsrDocument({ status: response.status(), headers: new Headers(headers) }, initialHtml,
      { sha: sourceSha, canonical: new URL(TRAVEL_PATH, webOrigin).href })
    expect(find(node => node.attribs?.['data-testid'] === 'travel-details-page' &&
      node.attribs?.['data-router-ssr'] === 'travel'), 'initial response contains the actual SSR article').toHaveLength(1)
    expect(find(node => node.attribs?.['data-testid'] === 'travel-details-hero-slider-container')).toHaveLength(1)
    expect(find(node => node.name === 'img' && Object.prototype.hasOwnProperty.call(node.attribs ?? {}, 'data-lcp'))).toHaveLength(1)
    expect(find(node => node.attribs?.id === 'ssg-skeleton'), 'SSR article does not use the retired static shell').toHaveLength(0)
    phase = 'hydrated-interactive-hero'
    await expect(page.locator('html')).toHaveClass(/(?:^|\s)app-hydrated(?:\s|$)/, { timeout: 30_000 })
    await expect(page.locator('#root')).toHaveAttribute('data-travel-details-ready', 'true', { timeout: 30_000 })
    await expect(page.getByTestId('travel-details-page')).toHaveAttribute('data-router-ssr', 'travel')
    await expect(page.getByTestId('travel-details-hero-slider-container').getByTestId('slider-scroll')).toBeVisible({ timeout: 30_000 })
    phase = 'business-actions'
    await exercise()
    expect(metrics.unexpectedWrites, 'guest article actions must not mutate production').toEqual([])
    expect(pageErrors, 'real guest actions must not emit JavaScript errors').toEqual([])
    expect(consoleErrors, 'real guest actions must not emit console errors').toEqual([])
    phase = 'complete'
  } finally {
    try {
      await testInfo.attach('hero-initial-server-html', { body: initialHtml, contentType: 'text/html' })
      await testInfo.attach('hero-production-raw', { body: JSON.stringify({ phase, sourceSha,
        resolvedIdentity, initialDocument, requests: [...requests.values()], consoleErrors, pageErrors,
        handledViews: metrics?.handledViews ?? [], unexpectedWrites: metrics?.unexpectedWrites ?? [] }, null, 2),
        contentType: 'application/json' })
    } finally {
      page.off('console', onConsole); page.off('pageerror', onPageError); page.off('request', onRequest)
      page.off('response', onResponse); page.off('requestfinished', onFinished); page.off('requestfailed', onFailed)
    }
  }
}

test.describe('Travel details hero favorite — production smoke (#3022)', () => {
  test.use({ storageState: { cookies: [], origins: [] } })
  test.beforeAll(async ({ baseURL }) => {
    if (!baseURL) throw new Error('Production hero acceptance requires an explicit baseURL')
    webOrigin = new URL(baseURL).origin
    const source = fetchLiveSha(webOrigin)
    expect(source.sha, `Independent live source marker: ${source.reason ?? 'read'}`).toMatch(/^[a-f0-9]{40}$/)
    sourceSha = source.sha
  })
  for (const viewport of HERO_FAVORITE_VIEWPORTS) {
    test.describe(viewport.name, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await preacceptCookies(page)
      })
      test('guest: labeled favorite action leads to auth with the travel intent', async ({ page }, testInfo) => {
        await withProductionTravel(page, testInfo, async () => {
          await expectTravelFavoriteAction(page, { initialViewport: viewport.isMobile })
          await expectGuestFavoriteSignIn(page, TRAVEL_PATH)
        })
      })
      if (viewport.isMobile) {
        test('swipe pages the gallery and favorite remains accessible', async ({ page }, testInfo) => {
          await withProductionTravel(page, testInfo, async () => {
            await expectHeroSwipeAdvances(page)
            await expectTravelFavoriteAction(page)
          })
        })
      }
    })
  }
})
