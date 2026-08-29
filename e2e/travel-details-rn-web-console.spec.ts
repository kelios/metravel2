import { expect, test, type ConsoleMessage, type Page, type Response } from '@playwright/test'

import { preacceptCookies, tid } from './helpers/navigation'

const RN_WEB_TEXT_NODE_ERROR =
  'Unexpected text node: . A text node cannot be a child of a <View>.'

const VIEWPORTS = [
  { width: 1440, height: 1100, label: 'desktop' },
  { width: 390, height: 844, label: 'mobile-web' },
] as const

const TRAVEL_PATH = '/travels/563/?returnTo=%2Fsearch'
const CONTROL_PATH = '/contact'

type RequiredEndpointKey = 'travel' | 'near' | 'popular'

const REQUIRED_ENDPOINTS: Array<{ key: RequiredEndpointKey; matches: (pathname: string) => boolean }> = [
  { key: 'travel', matches: (pathname) => /^\/api\/travels\/563\/?$/.test(pathname) },
  { key: 'near', matches: (pathname) => /^\/api\/travels\/563\/near\/?$/.test(pathname) },
  { key: 'popular', matches: (pathname) => /^\/api\/travels\/popular\/?$/.test(pathname) },
]

function attachConsoleCollector(page: Page) {
  const messages: string[] = []
  const pageErrors: string[] = []
  const onConsole = (message: ConsoleMessage) => {
    if (message.type() === 'error') messages.push(message.text())
  }
  const onPageError = (error: Error) => pageErrors.push(error.message)
  page.on('console', onConsole)
  page.on('pageerror', onPageError)
  return {
    messages,
    pageErrors,
    textNodeCount: () => messages.filter((text) => text.includes(RN_WEB_TEXT_NODE_ERROR)).length,
    dispose: () => {
      page.off('console', onConsole)
      page.off('pageerror', onPageError)
    },
  }
}

function attachApiResponseCollector(page: Page) {
  const statusByKey = new Map<RequiredEndpointKey, number>()
  const onResponse = (response: Response) => {
    let pathname = ''
    try {
      pathname = new URL(response.url()).pathname
    } catch {
      return
    }
    for (const endpoint of REQUIRED_ENDPOINTS) {
      if (endpoint.matches(pathname)) statusByKey.set(endpoint.key, response.status())
    }
  }
  page.on('response', onResponse)
  return {
    statusFor: (key: RequiredEndpointKey) => statusByKey.get(key),
    dispose: () => page.off('response', onResponse),
  }
}

async function waitForTravelDetails(page: Page) {
  await expect(page.getByTestId('travel-details-page')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByTestId('travel-details-description')).toBeVisible({ timeout: 30_000 })
}

/**
 * Fail-closed wait for the real PopularTravelList render path.
 *
 * `PopularTravelList` sits behind a scroll-gated IntersectionObserver
 * (`useTravelDeferredSectionsModel`, web: `rootMargin: '200px'`), so a single
 * scroll can race the observer attaching. Retry scrolling until real card
 * links render inside `travel-details-popular-loaded`, or exhaust the budget.
 *
 * The 2026-08-28 testing review sent this ticket back to `todo` specifically
 * because the previous version swallowed this wait behind `.catch(() => null)`
 * — the section never mounted (`popularLoaded=0`) and the test still passed.
 * This helper never swallows a timeout: callers must assert on the returned
 * count so an unmounted section fails the test instead of passing silently.
 */
async function waitForPopularCardCount(page: Page): Promise<number> {
  // #1608 code-review-gate finding: `tid(id)` returns a COMMA-separated
  // selector LIST (`[data-testid="X"], [testID="X"]`). String-interpolating
  // it into a compound descendant selector expands into a union whose FIRST
  // branch is `[data-testid="travel-details-popular-loaded"]` on its own —
  // matching the wrapper `<View testID="...">` itself (which renders around
  // an EMPTY Suspense fallback, independent of whether any cards loaded) —
  // not a descendant requirement. Chaining `.locator()` calls instead scopes
  // the card search to actual descendants of the resolved container.
  const popularCards = page
    .locator(tid('travel-details-popular-loaded'))
    .locator('a[data-testid="travel-card-link"]')

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const count = await popularCards.count()
    if (count > 0) return count
    await page.evaluate(() => {
      const scroller = document.querySelector('[data-testid="travel-details-scroll"]') as HTMLElement | null
      if (scroller) {
        scroller.scrollTop = scroller.scrollHeight
        scroller.dispatchEvent(new Event('scroll', { bubbles: true }))
      }
      window.scrollTo(0, document.body.scrollHeight)
    })
    await page.waitForTimeout(300)
  }

  return popularCards.count()
}

test.describe('Travel details RN-Web empty text node console', () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.label}: 0 Unexpected text node errors before and after PopularTravelList`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      const consoleCollector = attachConsoleCollector(page)
      const apiCollector = attachApiResponseCollector(page)
      await preacceptCookies(page)

      await page.goto(TRAVEL_PATH, { waitUntil: 'domcontentloaded', timeout: 90_000 })
      await waitForTravelDetails(page)
      await page.waitForTimeout(1500)

      const beforePopular = consoleCollector.textNodeCount()
      expect(
        beforePopular,
        `${viewport.label} before PopularTravelList: ${consoleCollector.messages.join('\n')}`,
      ).toBe(0)

      // Fail-closed: a never-mounted section means "after PopularTravelList"
      // was never actually exercised. This must fail, not pass silently.
      const popularCardCount = await waitForPopularCardCount(page)
      expect(
        popularCardCount,
        `${viewport.label}: PopularTravelList never rendered real card links within the retry budget`,
      ).toBeGreaterThan(0)

      const afterPopular = consoleCollector.textNodeCount()
      const logged = consoleCollector.messages.join('\n')

      expect(afterPopular, `${viewport.label} after PopularTravelList: ${logged}`).toBe(0)
      expect(
        consoleCollector.pageErrors,
        `${viewport.label} pageerror: ${consoleCollector.pageErrors.join('\n')}`,
      ).toEqual([])

      expect(apiCollector.statusFor('travel'), `${viewport.label}: GET /api/travels/563/`).toBe(200)
      expect(apiCollector.statusFor('near'), `${viewport.label}: GET /api/travels/563/near/`).toBe(200)
      expect(apiCollector.statusFor('popular'), `${viewport.label}: GET /api/travels/popular/`).toBe(200)

      consoleCollector.dispose()
      apiCollector.dispose()
    })
  }

  test('control route stays at 0 Unexpected text node errors', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1100 })
    const consoleCollector = attachConsoleCollector(page)
    await preacceptCookies(page)
    await page.goto(CONTROL_PATH, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await page.waitForTimeout(2000)
    expect(consoleCollector.textNodeCount()).toBe(0)
    consoleCollector.dispose()
  })
})
