import { expect, test, type Page } from '@playwright/test'

import {
  FALLBACK_TRAVEL_ID,
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

/**
 * Task #1642. The footer transition guard (#1604) proves the footer no longer
 * owns the residual bottom-scroll CLS. The remaining shifts came from the two
 * upstream deferred surfaces — the populated `Рядом/Популярные` sidebar and the
 * comments tree — which used to grow after their wrapper had already reached a
 * visible part of the page.
 *
 * This guard reproduces the causal sequence deterministically: non-empty near
 * results, non-empty popular map and a non-empty comments tree, each answered
 * after a delay so the placeholder → runtime transition really happens while
 * the user scrolls. Empty lists would hide the defect, so the fixtures below
 * must stay populated.
 */

const VIEWPORTS = [
  { height: 640, label: 'desktop-narrow', width: 1024 },
  { height: 768, label: 'desktop', width: 1366 },
  { height: 844, label: 'mobile-web', width: 390 },
] as const

// Own-transition budget for the two upstream surfaces. The causal trace that
// created the task measured 0.002646732 (near) plus 0.028837204 and
// 0.091664031 (comments) at 1024x640.
const UPSTREAM_CLS_BUDGET = 0.01
// A reserved wrapper is at least one viewport tall, so while its own box still
// covers the fold, everything after it stays off screen and its growth moves
// nothing the user can see. The height only becomes load-bearing once the
// wrapper's bottom edge reaches the viewport — from then on every pixel it
// gains or loses pushes the comments/footer under the reader's eyes.
const SETTLED_GEOMETRY_TOLERANCE_PX = 1
// The reserve is a scroll-time budget, not a guarantee: it hides a section's
// growth only while the section is still resolving off screen. The committed
// 120 ms keeps the whole mount → fetch → render chain inside the lookahead. Set
// `TASK_1642_API_DELAY_MS` to probe the boundary — at 900 ms per endpoint plus
// a continuous ~1400 px/s scroll the desktop viewports still measure
// `upstreamValue` 0, mobile-web does not. Raising the committed value is not a
// fix; the honest levers are the lookahead in
// `TRAVEL_DEFERRED_RESERVED_SECTION_ROOT_MARGIN` and the data gate in
// `useTravelDetailsSidebarSectionModel`. Mobile-web is the hard case and stays
// out of reach of both: its sidebar settles ~5.7 viewports tall, so a reserve
// of one viewport cannot cover the growth once the payload is that late.
const API_FIXTURE_DELAY_MS = Number(process.env.TASK_1642_API_DELAY_MS || 120)
// Comfortably under the transition's 6s fail-open valve: a section that only
// resolves on the timeout has lost its layout signal (react-native-web observes
// a node only if its `onLayout` existed at mount) and stays inert meanwhile.
// Used twice on purpose — as the wait for the resolved frame, and as the budget
// between leaving `placeholder` and reaching `runtime` measured from the state
// samples below, which is what actually separates the latch from the valve.
const SETTLE_BUDGET_MS = 3_000

const useLiveTravelData = process.env.TASK_1642_USE_LIVE_DATA === '1'
const liveTravelSlug = process.env.TASK_1642_TRAVEL_SLUG?.trim() || FALLBACK_TRAVEL_SLUG
const travelSlug = useLiveTravelData ? liveTravelSlug : FALLBACK_TRAVEL_SLUG
const candidateBaseUrl = process.env.BASE_URL || 'http://127.0.0.1:4716'
// A production artifact talks to `https://metravel.by/api`; the local candidate
// answers the same paths, so the probe never leaves the machine. The live run
// may still need a non-empty comments tree when the local copy has none.
const overlayCommentsFixture = process.env.TASK_1642_COMMENTS_FIXTURE === '1'
const liveTravelId = Number(process.env.TASK_1642_TRAVEL_ID || FALLBACK_TRAVEL_ID)

const UPSTREAM_TRANSITIONS = [
  { key: 'sidebar', testId: 'travel-details-sidebar-transition' },
  { key: 'comments', testId: 'travel-details-comments-transition' },
] as const

const nearCardFixture = (index: number) => ({
  id: 900_100 + index,
  name: `Рядом можно посмотреть #${index + 1}`,
  slug: `e2e-near-travel-${index + 1}`,
  url: `/travels/e2e-near-travel-${index + 1}`,
  countryName: 'Беларусь',
  cityName: 'Минск',
  year: 2024,
  rating: 4.5,
  lat: 53.9 + index / 100,
  lng: 27.56 + index / 100,
  coord: `53.9${index},27.56${index}`,
})

const NEAR_ENVELOPE = {
  count: 6,
  next: null,
  previous: null,
  results: Array.from({ length: 6 }, (_, index) => nearCardFixture(index)),
}

const POPULAR_MAP = Object.fromEntries(
  Array.from({ length: 6 }, (_, index) => [
    String(900_200 + index),
    {
      id: 900_200 + index,
      name: `Популярный маршрут #${index + 1}`,
      slug: `e2e-popular-travel-${index + 1}`,
      url: `/travels/e2e-popular-travel-${index + 1}`,
      countryName: 'Беларусь',
      cityName: 'Брест',
      countUnicIpView: 1200 + index,
    },
  ]),
)

const commentFixture = (index: number) => ({
  id: 900_300 + index,
  thread: 900_400,
  sub_thread: null,
  user: 700 + index,
  text: `Детерминированный комментарий #${index + 1} для проверки резерва высоты секции комментариев.`,
  created_at: '2026-08-01T10:00:00Z',
  updated_at: '2026-08-01T10:00:00Z',
  likes_count: index,
  user_name: `Тестовый автор ${index + 1}`,
  is_liked: false,
  is_author: false,
})

const COMMENTS_TREE = {
  travel_id: useLiveTravelData ? liveTravelId : FALLBACK_TRAVEL_ID,
  total_count: 5,
  top_level: Array.from({ length: 5 }, (_, index) => ({
    ...commentFixture(index),
    depth: 0,
    replies_count: 0,
    replies: [],
  })),
  flat: Array.from({ length: 5 }, (_, index) => commentFixture(index)),
}

const fulfilJson = async (route: any, body: unknown) => {
  await new Promise((resolve) => setTimeout(resolve, API_FIXTURE_DELAY_MS))
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

async function mockPopulatedCommentsTree(page: Page) {
  await page.route('**/travel-comments/tree/**', async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    await fulfilJson(route, COMMENTS_TREE)
  })
}

/**
 * Registered after `mockFallbackTravelDetails` on purpose: Playwright matches
 * routes in reverse registration order, so these populated payloads win over
 * the empty defaults of the shared navigation helper.
 */
async function mockPopulatedUpstreamSections(page: Page) {
  await page.route('**/travels/*/near/**', async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    await fulfilJson(route, NEAR_ENVELOPE)
  })
  await page.route('**/travels/popular/**', async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    await fulfilJson(route, POPULAR_MAP)
  })
  await mockPopulatedCommentsTree(page)
  // The deterministic travel id does not exist on the candidate backend, so its
  // route-file listing would 404 while the map section mounts on the way down.
  await page.route('**/travels/*/routes/**', async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }),
    })
  })
  await page.route('**/quests/near-location/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [], count: 0 }),
    })
  })
  await page.route(
    (url) => url.pathname === `/api/achievements/travel/${FALLBACK_TRAVEL_ID}/`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ peer_received: [] }),
      })
    },
  )
}

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
      await route.fulfill({ response, headers: { ...response.headers(), ...corsHeaders } })
    } catch (error) {
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

type UpstreamGeometrySample = {
  /** Page clock at sample time; the settle latency is derived from it. */
  at: number
  height: number
  key: string
  placeholderCount: number
  scrollTop: number
  state: string | null
  /** Wrapper top relative to the top of the scroll viewport; < 0 == scrolled past. */
  topOffset: number
  /** Wrapper bottom relative to the bottom of the viewport; <= 0 == what follows is visible. */
  bottomOffset: number
  /** Height of the real-content layer, used to spot a leftover blank reserve. */
  runtimeHeight: number
}

async function sampleUpstreamGeometry(page: Page, scrollTop: number) {
  return page.evaluate(
    ({ scrollTop, transitions }) => {
      const container = document.querySelector<HTMLElement>(
        '[data-testid="travel-details-scroll"]',
      )
      const containerRect = container?.getBoundingClientRect()
      const at = performance.now()
      return transitions.map(({ key, testId }) => {
        const node = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)
        const rect = node?.getBoundingClientRect()
        const runtimeLayer = document.querySelector<HTMLElement>(
          `[data-testid="${testId}-runtime"]`,
        )
        return {
          at,
          height: rect ? rect.height : -1,
          key,
          placeholderCount: document.querySelectorAll(`[data-testid="${testId}-placeholder"]`)
            .length,
          runtimeHeight: runtimeLayer ? runtimeLayer.getBoundingClientRect().height : -1,
          scrollTop,
          // `data-deferred-transition-state` is the readable form of the same
          // fact; the authoritative signal is the layer pair, because a resolved
          // transition drops its placeholder and un-hides the runtime layer.
          state:
            node?.getAttribute('data-deferred-transition-state') ??
            (runtimeLayer == null
              ? 'placeholder'
              : runtimeLayer.getAttribute('aria-hidden') === 'true'
                ? 'measuring-runtime'
                : 'runtime'),
          topOffset:
            rect && containerRect ? rect.top - containerRect.top : Number.POSITIVE_INFINITY,
          bottomOffset:
            rect && containerRect ? rect.bottom - containerRect.bottom : Number.POSITIVE_INFINITY,
        }
      })
    },
    { scrollTop, transitions: UPSTREAM_TRANSITIONS.map(({ key, testId }) => ({ key, testId })) },
  ) as Promise<UpstreamGeometrySample[]>
}

test.describe('@perf Travel details deferred upstream (near/comments) CLS', () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.label}: gradual bottom-scroll keeps near/comments geometry stable`, async ({
      page,
    }) => {
      const browserErrors: string[] = []
      const networkFailures: string[] = []
      page.on('pageerror', (error) => browserErrors.push(String(error.message || error)))
      page.on('console', (message) => {
        if (message.type() !== 'error') return
        const location = message.location()
        browserErrors.push(
          location?.url ? `${message.text()} @ ${location.url}` : message.text(),
        )
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
      // Route priority is reverse registration order: the candidate proxy is the
      // floor, deterministic fixtures win over it.
      await proxyLiveApiThroughCandidate(page)
      if (useLiveTravelData) {
        if (overlayCommentsFixture) await mockPopulatedCommentsTree(page)
      } else {
        await mockFallbackTravelDetails(page)
        await mockPopulatedUpstreamSections(page)
      }

      await page.goto(`/travels/${travelSlug}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      })

      await expect(page.getByTestId('travel-details-page')).toBeVisible({ timeout: 30_000 })
      const scrollContainer = page.getByTestId('travel-details-scroll')
      await expect(scrollContainer).toBeVisible()
      await expect(page.getByTestId('travel-details-sidebar-transition')).toBeAttached({
        timeout: 30_000,
      })
      await expect(page.getByTestId('travel-details-comments-transition')).toBeAttached({
        timeout: 30_000,
      })

      // Everything before this point is initial load; the task measures the
      // incremental damage a gradual scroll still causes.
      await page.waitForTimeout(1_000)
      await resetTravelFooterLayoutShiftGuard(page)

      const samples: UpstreamGeometrySample[] = []
      samples.push(...(await sampleUpstreamGeometry(page, 0)))

      // Gradual, human-like scroll: roughly a third of a viewport per frame
      // batch, which is what the causal trace behind this task used.
      const scrollStep = Math.round(viewport.height * 0.3)
      // Long real articles are tens of thousands of pixels tall; the causal
      // window ends once both reserved sections have scrolled fully past the
      // fold, so the walk stops there instead of grinding to the very bottom.
      for (let step = 0; step < 400; step += 1) {
        const scrollState = await scrollContainer.evaluate(
          async (node: HTMLElement, delta: number) => {
            node.scrollTop = Math.min(node.scrollTop + delta, node.scrollHeight)
            node.dispatchEvent(new Event('scroll', { bubbles: true }))
            await new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
            )
            return {
              atBottom: node.scrollHeight - node.clientHeight - node.scrollTop <= 2,
              scrollTop: node.scrollTop,
            }
          },
          scrollStep,
        )
        await page.waitForTimeout(180)
        const stepSamples = await sampleUpstreamGeometry(page, scrollState.scrollTop)
        samples.push(...stepSamples)
        const walkedPastBothSections = stepSamples.every(
          (sample) => sample.height > 0 && sample.topOffset < -viewport.height,
        )
        if (scrollState.atBottom || walkedPastBothSections) break
      }

      // Let every in-flight deferred query settle at the bottom of the page.
      for (const { key, testId } of UPSTREAM_TRANSITIONS) {
        await expect(
          page.locator(`[data-testid="${testId}"][data-deferred-transition-state="runtime"]`),
          `${key} did not resolve its real frame within ${SETTLE_BUDGET_MS}ms`,
        ).toHaveCount(1, { timeout: SETTLE_BUDGET_MS })
      }
      await scrollContainer.evaluate(async (node: HTMLElement) => {
        node.scrollTop = node.scrollHeight
        node.dispatchEvent(new Event('scroll', { bubbles: true }))
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        )
      })
      const settledSamples = await sampleUpstreamGeometry(page, -1)
      samples.push(...settledSamples)

      const finalGeometry = await scrollContainer.evaluate((node: HTMLElement) => ({
        documentHorizontalOverflow: Math.max(
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
          document.body.scrollWidth - document.body.clientWidth,
        ),
        horizontalOverflow: node.scrollWidth - node.clientWidth,
      }))

      // Geometry stability is worthless if the sections are stable *and* inert:
      // while the reserve is held the runtime layer is aria-hidden and
      // pointer-events:none, so a section that never resolves would look calm.
      for (const { key, testId } of UPSTREAM_TRANSITIONS) {
        const runtimeLayer = page.getByTestId(`${testId}-runtime`)
        await expect(runtimeLayer, `${key} runtime layer stayed hidden`).not.toHaveAttribute(
          'aria-hidden',
          'true',
        )
        await expect(runtimeLayer, `${key} runtime layer stayed inert`).not.toHaveAttribute(
          'inert',
          '',
        )
      }
      // Desktop cards are anchors, the mobile card renders a pressable, so the
      // check counts either rather than one implementation's markup.
      const cardSelector = 'a, [role="button"], [role="link"]'
      await expect(
        page.locator('[data-testid="travel-details-near-loaded"]').locator(cardSelector),
        'near section rendered no cards',
      ).not.toHaveCount(0)
      await expect(
        page.locator('[data-testid="travel-details-popular-loaded"]').locator(cardSelector),
        'popular section rendered no cards',
      ).not.toHaveCount(0)
      await expect(
        page.locator('[data-testid="travel-details-comments-transition-runtime"] #comments'),
        'comments runtime frame is missing its real body',
      ).toHaveCount(1)

      const report = await readTravelFooterLayoutShiftReport(page)
      const unexpectedBrowserErrors = useLiveTravelData
        ? browserErrors
        : browserErrors.filter((message) => !isRecoverableReactHydrationError(message))

      const committedGeometry = UPSTREAM_TRANSITIONS.map(({ key }) => {
        // The load-bearing window is narrow on both sides. While the wrapper's
        // own box still covers the fold, growth pushes nothing the reader can
        // see; once the wrapper has scrolled entirely above the viewport,
        // browser scroll anchoring absorbs the growth instead (measured: a
        // 1337 px jump there produced no layout-shift entry at all). Only a
        // trailing edge inside the viewport puts the next section under the
        // reader's eyes, and only consecutive samples prove the move happened
        // inside that window.
        const isLoadBearing = (sample: UpstreamGeometrySample) =>
          sample.height > 0 && sample.bottomOffset <= 0 && sample.bottomOffset >= -viewport.height
        const ownTimeline = samples.filter((sample) => sample.key === key)
        const committed = ownTimeline.filter(isLoadBearing)
        let visibleJumpPx = 0
        for (let index = 1; index < ownTimeline.length; index += 1) {
          const previous = ownTimeline[index - 1]
          const current = ownTimeline[index]
          if (!isLoadBearing(previous) || !isLoadBearing(current)) continue
          visibleJumpPx = Math.max(visibleJumpPx, Math.abs(current.height - previous.height))
        }
        const heights = committed.map((sample) => sample.height)
        // The reserve latch and the fail-open valve produce the same end state,
        // so the end state alone proves nothing about the layout signal. These
        // two stamps separate them: the valve starts when the section leaves
        // `placeholder`, and it only fires 6s later.
        const ownSamples = samples.filter((sample) => sample.key === key)
        const activatedAt =
          ownSamples.find((sample) => sample.state != null && sample.state !== 'placeholder')?.at ??
          null
        const runtimeAt = ownSamples.find((sample) => sample.state === 'runtime')?.at ?? null
        return {
          key,
          maxHeight: heights.length ? Math.max(...heights) : null,
          minHeight: heights.length ? Math.min(...heights) : null,
          // Recorded, not asserted: the walk stops once both sections are a
          // viewport past the fold, so a fast pass can step straight over this
          // narrow window without that being a defect.
          samples: committed.length,
          visibleJumpPx,
          settleLatencyMs:
            activatedAt != null && runtimeAt != null ? Math.max(0, runtimeAt - activatedAt) : null,
          settledHeight: settledSamples.find((sample) => sample.key === key)?.height ?? null,
          settledPlaceholders:
            settledSamples.find((sample) => sample.key === key)?.placeholderCount ?? null,
          settledRuntimeHeight:
            settledSamples.find((sample) => sample.key === key)?.runtimeHeight ?? null,
          settledState: settledSamples.find((sample) => sample.key === key)?.state ?? null,
        }
      })

      const evidence = { committedGeometry, finalGeometry, report, viewport: viewport.label }
      test.info().annotations.push({
        type: `travel-upstream-cls-${viewport.label}`,
        description: JSON.stringify(evidence),
      })
      console.log(
        `[task-1642][${viewport.label}][${useLiveTravelData ? 'live' : 'fixture'}] ${JSON.stringify(evidence)}`,
      )
      await page.screenshot({
        path: `.codex-temp/task-1642/${viewport.label}-${useLiveTravelData ? 'live' : 'fixture'}.png`,
      })

      for (const geometry of committedGeometry) {
        expect(
          geometry.settledState,
          `${geometry.key} never reached its runtime frame: ${JSON.stringify(evidence)}`,
        ).toBe('runtime')
        expect(
          geometry.settledPlaceholders,
          `${geometry.key} kept a placeholder layer after settle: ${JSON.stringify(evidence)}`,
        ).toBe(0)
        expect(
          geometry.settleLatencyMs,
          `${geometry.key} released its reserve on the fail-open valve, not on its own layout signal: ${JSON.stringify(evidence)}`,
        ).not.toBeNull()
        expect(
          geometry.settleLatencyMs ?? Number.POSITIVE_INFINITY,
          `${geometry.key} took too long to settle its real frame: ${JSON.stringify(evidence)}`,
        ).toBeLessThanOrEqual(SETTLE_BUDGET_MS)
        // `visibleJumpPx` is recorded, not asserted: measured on this stand, a
        // 1337 px jump with the trailing edge on screen produced no layout-shift
        // entry at all, because browser scroll anchoring compensates growth that
        // happens outside the anchor. The user-visible contract is therefore the
        // layout-shift assertion below, plus the settled geometry here.
        expect(
          Math.abs((geometry.settledHeight ?? 0) - (geometry.settledRuntimeHeight ?? -1)),
          `${geometry.key} kept a trailing blank reserve after settle: ${JSON.stringify(evidence)}`,
        ).toBeLessThanOrEqual(SETTLED_GEOMETRY_TOLERANCE_PX)
      }

      expect(
        report.upstreamEntries,
        `near/comments nodes appeared in layout-shift sources; upstreamValue=${report.upstreamValue}; ${JSON.stringify(evidence)}`,
      ).toEqual([])
      expect(report.upstreamValue).toBeLessThanOrEqual(UPSTREAM_CLS_BUDGET)
      expect(
        report.footerEntries,
        `footer transition regressed (#1604); ${JSON.stringify(evidence)}`,
      ).toEqual([])
      expect(report.footerValue).toBe(0)
      expect(finalGeometry.documentHorizontalOverflow).toBeLessThanOrEqual(1)
      expect(finalGeometry.horizontalOverflow).toBeLessThanOrEqual(1)
      expect(
        unexpectedBrowserErrors,
        `browser console/page errors: ${browserErrors.join('\n---\n')}`,
      ).toEqual([])
      expect(
        networkFailures,
        `relevant network failures: ${networkFailures.join('\n---\n')}`,
      ).toEqual([])
      await page.unrouteAll({ behavior: 'ignoreErrors' })
    })
  }
})
