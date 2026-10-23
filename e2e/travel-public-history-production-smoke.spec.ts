import { test, expect, type BrowserContext, type CDPSession, type Locator, type Page, type TestInfo } from '@playwright/test'
import { gotoWithRetry, preacceptCookies } from './helpers/navigation'

test.use({ screenshot: 'only-on-failure' })

// #2703: real guest navigation only. No router calls, injected links, history
// writes, API mocks or fabricated preceding article may repair the history.
const ARTICLE_A = '/travels/rodniki-yuckovskie'
const ARTICLE_B = '/travels/marshruty-vykhodnogo-dnia-iz-minska-13-poezdok'
const PROFILES = [
  { name: 'desktop 1440x900', options: { viewport: { width: 1440, height: 900 } }, mobile: false },
  {
    name: 'mobile 390x844',
    options: {
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1',
    },
    mobile: true,
  },
]

type HistorySnapshot = {
  currentIndex: number
  entries: { id: number; url: string }[]
  stateId: string | number | null
  timeOrigin: number
}
type ArticleSnapshot = Awaited<ReturnType<typeof readMetadata>>
type NearCard = { id: number; name: string; slug: string }
type NearResponses = Map<number, Promise<NearCard[] | Error>>
type Traversals = { programmatic: number; popstate: number }
type Observations = { errors: string[]; failedRequests: string[]; badResponses: string[]; apiWrites: string[] }
const observations = new WeakMap<BrowserContext, Observations>()

function safeUrl(url: string) {
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol) ? `${parsed.origin}${parsed.pathname}` : parsed.protocol
  } catch { return '[invalid-url]' }
}

function safeMessage(message: string) {
  return message.replace(/https?:\/\/[^\s"'<>]+/g, safeUrl)
    .replace(/\b(authorization|cookie|token)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
}

async function readTraversals(page: Page): Promise<Traversals> {
  return page.evaluate(() => (window as Window & { __travelHistoryTraversals?: Traversals }).__travelHistoryTraversals!)
}

async function readMetadata(page: Page) {
  return page.evaluate(() => {
    const content = (selector: string) => document.head.querySelector(selector)?.getAttribute('content') || ''
    const heading = Array.from(document.querySelectorAll('[data-testid="travel-details-title"]'))
      .find((node) => node.getClientRects().length > 0)?.textContent?.trim() || ''
    return {
      path: window.location.pathname,
      heading,
      title: document.title,
      canonical: document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') || '',
      description: content('meta[name="description"]'),
      ogDescription: content('meta[property="og:description"]'),
      twitterDescription: content('meta[name="twitter:description"]'),
    }
  })
}

async function articleSnapshot(page: Page, path: string, previous?: ArticleSnapshot, name?: string) {
  await expect(page).toHaveURL((url) => url.pathname === path)
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
  await expect.poll(async () => {
    const meta = await readMetadata(page)
    return meta.path === path && Boolean(meta.heading && meta.title && meta.description) &&
      new URL(meta.canonical || 'about:blank').pathname === path &&
      meta.description === meta.ogDescription && meta.description === meta.twitterDescription &&
      (!previous || (meta.heading !== previous.heading && meta.title !== previous.title)) &&
      (!name || meta.heading === name)
  }, { message: `${path}: hydrated article and its three descriptions`, timeout: 30_000 }).toBe(true)
  return readMetadata(page)
}

async function readHistory(page: Page, cdp: CDPSession): Promise<HistorySnapshot> {
  const history = await cdp.send('Page.getNavigationHistory')
  const documentState = await page.evaluate(() => ({
    stateId: (window.history.state?.id ?? null) as string | number | null,
    timeOrigin: performance.timeOrigin,
  }))
  return {
    currentIndex: history.currentIndex,
    entries: history.entries.map(({ id, url }) => ({ id, url: safeUrl(url) })),
    ...documentState,
  }
}

async function checkpoint(page: Page, cdp: CDPSession, info: TestInfo, label: string) {
  const history = await readHistory(page, cdp)
  expect(history.stateId, `${label}: Expo browser history entry identity`).not.toBeNull()
  await info.attach(label, {
    body: Buffer.from(JSON.stringify({ history, metadata: await readMetadata(page), traversals: await readTraversals(page) }, null, 2)),
    contentType: 'application/json',
  })
  return history
}

function expectPush(before: HistorySnapshot, after: HistorySnapshot, path: string) {
  expect(after.timeOrigin, 'navigation must keep the document alive').toBe(before.timeOrigin)
  expect(after.currentIndex, 'one click appends exactly one entry').toBe(before.currentIndex + 1)
  expect(after.entries).toHaveLength(before.currentIndex + 2)
  expect(after.entries.slice(0, -1)).toEqual(before.entries.slice(0, before.currentIndex + 1))
  expect(new URL(after.entries[after.currentIndex].url).pathname).toBe(path)
  expect(after.stateId, 'a different destination needs its own browser entry').not.toBe(before.stateId)
}

async function expectRestored(
  page: Page, cdp: CDPSession, info: TestInfo, label: string,
  metadata: ArticleSnapshot, entry: HistorySnapshot, entries: HistorySnapshot['entries'],
) {
  await expect.poll(() => readMetadata(page), { message: `${label}: restore article and all SEO fields` })
    .toEqual(metadata)
  await expect.poll(() => readHistory(page, cdp), { message: `${label}: one native traversal, no reload or new entry` })
    .toEqual({ ...entry, entries })
  await checkpoint(page, cdp, info, label)
}

async function traverse(
  page: Page, cdp: CDPSession, info: TestInfo, label: string,
  metadata: ArticleSnapshot, entry: HistorySnapshot, entries: HistorySnapshot['entries'],
  direction: 'back' | 'forward' | (() => Promise<unknown>),
) {
  const before = await readTraversals(page)
  if (direction === 'back') await page.goBack()
  else if (direction === 'forward') await page.goForward()
  else await direction()
  await expectRestored(page, cdp, info, label, metadata, entry, entries)
  // Let React's committed render/effects finish before checking for an extra
  // programmatic traversal; a transient correct route must not satisfy this.
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  expect(await readTraversals(page), `${label}: exactly one popstate and no hidden corrective traversal`).toEqual({
    popstate: before.popstate + 1,
    programmatic: before.programmatic + (typeof direction === 'function' ? 1 : 0),
  })
  await expectRestored(page, cdp, info, `${label}-settled`, metadata, entry, entries)
}

function observeNearResponses(page: Page): NearResponses {
  const responses: NearResponses = new Map()
  page.on('response', (response) => {
    const match = new URL(response.url()).pathname.match(/\/travels\/(\d+)\/near\/$/)
    if (match && response.request().method() === 'GET' && response.ok()) {
      responses.set(Number(match[1]), response.json().then((payload) => {
        if (!Array.isArray(payload?.results) || !payload.results.every((card: NearCard) =>
          typeof card?.id === 'number' && typeof card.name === 'string' && typeof card.slug === 'string')) {
          throw new Error(`Invalid nearby-card envelope for article ${match[1]}`)
        }
        return payload.results as NearCard[]
      }).catch((error: Error) => new Error(safeMessage(error.message))))
    }
  })
  return responses
}

async function nearCard(page: Page, responses: NearResponses, sourceId: number, targetId?: number) {
  const region = page.locator('[data-section-key="near"]:visible').first()
  await region.scrollIntoViewIfNeeded()
  await expect.poll(() => responses.has(sourceId), { message: `real /travels/${sourceId}/near/ response` }).toBe(true)
  const cards = await responses.get(sourceId)!
  if (cards instanceof Error) throw cards
  const card = targetId ? cards.find(({ id }) => id === targetId) :
    cards.find(({ id, slug }) => id !== 480 && id !== 672 && Boolean(slug))
  expect(card, `${sourceId}: an existing nearby card ${targetId || 'C distinct from A/B'}`).toBeTruthy()
  expect(card!.name).toBeTruthy()
  const path = `/travels/${card!.slug}`
  const slot = region.getByTestId('near-travel-rail-slot').filter({ hasText: card!.name }).first()
  await expect(slot).toBeVisible()
  return { card: card!, path, slot }
}

async function clickCard(slot: Locator) {
  // Desktop cards own a real anchor. Mobile round cards own the click on their
  // container; their role=link child is deliberately pointer-events:none.
  const anchor = slot.locator('a[href]').first()
  if (await anchor.count()) await anchor.click({ position: { x: 12, y: 12 } })
  else await slot.click()
}

async function sameCurrentControl(page: Page, cdp: CDPSession, info: TestInfo, baseline: HistorySnapshot) {
  const link = page.locator(`a[href="${ARTICLE_A}"]:visible`).first()
  if (await link.count()) {
    await link.click()
    await expect.poll(() => readHistory(page, cdp)).toEqual(baseline)
    await checkpoint(page, cdp, info, 'same-current-real-link')
  } else {
    await info.attach('same-current-link-availability', {
      body: Buffer.from('No existing enabled anchor to the current article. The current breadcrumb is disabled; the pinned TabRouter reducer regression covers same-current deduplication.'),
      contentType: 'text/plain',
    })
  }
}

test.describe('Public travel browser history — production smoke (#2703)', () => {
  test.use({ storageState: { cookies: [], origins: [] }, locale: 'ru-RU' })

  test.beforeEach(async ({ page, context }) => {
    await preacceptCookies(page)
    await context.addInitScript(() => {
      window.localStorage.setItem('@metravel/locale-preference:v1',
        JSON.stringify({ version: 1, mode: 'explicit', locale: 'ru' }))
      const counters = { programmatic: 0, popstate: 0 }
      ;(window as Window & { __travelHistoryTraversals?: Traversals }).__travelHistoryTraversals = counters
      const { go, back, forward } = window.history
      window.history.go = function (delta?: number) { counters.programmatic += 1; return go.call(this, delta) }
      window.history.back = function () { counters.programmatic += 1; return back.call(this) }
      window.history.forward = function () { counters.programmatic += 1; return forward.call(this) }
      window.addEventListener('popstate', () => { counters.popstate += 1 })
    })
    const log: Observations = { errors: [], failedRequests: [], badResponses: [], apiWrites: [] }
    observations.set(context, log)
    const observePage = (target: Page) => {
      target.on('console', (message) => {
        if (message.type() === 'error') log.errors.push(safeMessage(message.text()))
      })
      target.on('pageerror', (error) => log.errors.push(`pageerror: ${safeMessage(error.message)}`))
    }
    observePage(page)
    context.on('page', observePage)
    context.on('requestfailed', (request) => {
      log.failedRequests.push(`${request.method()} ${safeUrl(request.url())}: ${safeMessage(request.failure()?.errorText || '')}`)
    })
    context.on('response', (response) => {
      if (response.status() >= 400) log.badResponses.push(`${response.status()} ${safeUrl(response.url())}`)
    })
    context.on('request', (request) => {
      if (/\/api(?:\/|$)/.test(new URL(request.url()).pathname) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
        log.apiWrites.push(`${request.method()} ${safeUrl(request.url())}`)
      }
    })
  })

  test.afterEach(async ({ context }, info) => {
    const log = observations.get(context)!
    await info.attach('read-only-browser-observations', {
      body: Buffer.from(JSON.stringify(log, null, 2)),
      contentType: 'application/json',
    })
    for (const [kind, events] of Object.entries(log)) expect.soft(events, kind).toEqual([])
  })

  for (const profile of PROFILES) {
    test.describe(profile.name, () => {
      test.use(profile.options)

      test('A → B → Back → Forward and A/B/C traversal preserve every entry and SEO field', async ({ page, context }, info) => {
        const near = observeNearResponses(page)
        const cdp = await context.newCDPSession(page)
        await gotoWithRetry(page, ARTICLE_A, { maxAttempts: 1 })
        const a = await articleSnapshot(page, ARTICLE_A)
        const aHistory = await checkpoint(page, cdp, info, 'direct-A')
        const startTraversals = await readTraversals(page)
        expect(aHistory.entries.slice(0, aHistory.currentIndex)
          .filter(({ url }) => url.startsWith('http') && new URL(url).pathname.startsWith('/travels/')),
        'direct entry must not fabricate a preceding article').toEqual([])
        await sameCurrentControl(page, cdp, info, aHistory)

        const bCard = await nearCard(page, near, 480, 672)
        expect(bCard.path).toBe(ARTICLE_B)
        await clickCard(bCard.slot)
        const b = await articleSnapshot(page, ARTICLE_B, a, bCard.card.name)
        const bHistory = await checkpoint(page, cdp, info, 'A-to-B')
        expectPush(aHistory, bHistory, ARTICLE_B)

        await traverse(page, cdp, info, 'single-Back-A', a, aHistory, bHistory.entries, 'back')
        await page.screenshot({ path: info.outputPath('single-Back-A.png') })
        await traverse(page, cdp, info, 'single-Forward-B', b, bHistory, bHistory.entries, 'forward')

        const cCard = await nearCard(page, near, 672)
        await clickCard(cCard.slot)
        const c = await articleSnapshot(page, cCard.path, b, cCard.card.name)
        const cHistory = await checkpoint(page, cdp, info, 'B-to-C')
        expectPush(bHistory, cHistory, cCard.path)
        for (const [label, metadata, history, direction] of [
          ['C-Back-B', b, bHistory, 'back'], ['B-Back-A', a, aHistory, 'back'],
          ['A-Forward-B', b, bHistory, 'forward'], ['B-Forward-C', c, cHistory, 'forward'],
        ] as const) {
          await traverse(page, cdp, info, label, metadata, history, cHistory.entries, direction)
        }
        await page.screenshot({ path: info.outputPath('final-Forward-C.png') })

        if (profile.mobile) {
          await traverse(page, cdp, info, 'mobile-header-Back-B', b, bHistory, cHistory.entries,
            () => page.getByTestId('header-context-bar').getByRole('button', { name: 'Назад', exact: true }).click())
          await traverse(page, cdp, info, 'after-header-Forward-C', c, cHistory, cHistory.entries, 'forward')
        }
        expect(await readTraversals(page), 'the complete flow must not hide extra traversals between checkpoints').toEqual({
          popstate: startTraversals.popstate + (profile.mobile ? 8 : 6),
          programmatic: startTraversals.programmatic + (profile.mobile ? 1 : 0),
        })
      })

      test('cross-tab A → search and a real catalog card keep Back/Forward destinations', async ({ page, context }, info) => {
        const cdp = await context.newCDPSession(page)
        await gotoWithRetry(page, ARTICLE_A, { maxAttempts: 1 })
        const a = await articleSnapshot(page, ARTICLE_A)
        const aHistory = await checkpoint(page, cdp, info, 'cross-tab-direct-A')
        const startTraversals = await readTraversals(page)
        const searchLink = profile.mobile ? page.getByTestId('footer-item-home') :
          page.getByTestId('main-header').getByRole('link', { name: 'Маршруты', exact: true }).first()
        await searchLink.click()
        await expect(page).toHaveURL((url) => url.pathname === '/search')
        await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', /\/search$/)
        const search = await readMetadata(page)
        const searchHistory = await checkpoint(page, cdp, info, 'A-to-search')
        expectPush(aHistory, searchHistory, '/search')
        await traverse(page, cdp, info, 'search-Back-A', a, aHistory, searchHistory.entries, 'back')
        await traverse(page, cdp, info, 'A-Forward-search', search, searchHistory, searchHistory.entries, 'forward')

        const catalogCard = page.locator('a[data-testid="travel-card-link"][href^="/travels/"]:visible').first()
        await expect(catalogCard, 'real public catalog must contain an existing article card').toBeVisible({ timeout: 30_000 })
        const path = new URL((await catalogCard.getAttribute('href'))!, page.url()).pathname
        await catalogCard.click({ position: { x: 12, y: 12 } })
        const article = await articleSnapshot(page, path)
        const articleHistory = await checkpoint(page, cdp, info, 'catalog-to-detail')
        expectPush(searchHistory, articleHistory, path)
        await traverse(page, cdp, info, 'detail-Back-catalog', search, searchHistory, articleHistory.entries, 'back')
        await traverse(page, cdp, info, 'catalog-Forward-detail', article, articleHistory, articleHistory.entries, 'forward')
        expect(await readTraversals(page)).toEqual({ popstate: startTraversals.popstate + 4, programmatic: startTraversals.programmatic })
      })
    })
  }

  test('desktop modifier and middle click open real B in a new tab without changing A history', async ({ page, context }, info) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const near = observeNearResponses(page)
    const cdp = await context.newCDPSession(page)
    await gotoWithRetry(page, ARTICLE_A, { maxAttempts: 1 })
    const a = await articleSnapshot(page, ARTICLE_A)
    const sourceHistory = await checkpoint(page, cdp, info, 'new-tab-source-A')
    const startTraversals = await readTraversals(page)
    const bCard = await nearCard(page, near, 480, 672)
    const link = bCard.slot.locator(`a[href="${ARTICLE_B}"]`).first()
    await expect(link).toBeVisible()
    for (const method of ['modifier', 'middle'] as const) {
      const [target] = await Promise.all([
        context.waitForEvent('page'),
        method === 'modifier' ? link.click({ modifiers: ['ControlOrMeta'], position: { x: 12, y: 12 } }) :
          link.click({ button: 'middle', position: { x: 12, y: 12 } }),
      ])
      try {
        await articleSnapshot(target, ARTICLE_B, a, bCard.card.name)
        await expectRestored(page, cdp, info, `${method}-source-unchanged`, a, sourceHistory, sourceHistory.entries)
        expect(await readTraversals(page)).toEqual(startTraversals)
      } finally {
        await target.close()
      }
    }
  })
})
