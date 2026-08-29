/**
 * #1608 code-review-gate finding: the old `waitForPopularCardCount` selector
 * in `e2e/travel-details-rn-web-console.spec.ts` string-concatenated
 * `tid('travel-details-popular-loaded')` (which itself returns a
 * COMMA-separated selector LIST, `[data-testid="X"], [testID="X"]`) directly
 * into a compound descendant selector. That string-interpolation expands into
 * a 4-branch selector union whose first branch is the bare container
 * selector `[data-testid="travel-details-popular-loaded"]` — no descendant
 * requirement at all — so it matched the wrapper `<View testID="...">`
 * itself (which renders around an EMPTY Suspense fallback independent of
 * whether `PopularTravelList` ever loaded any cards,
 * `components/travel/details/sections/TravelDetailsSidebarSection.tsx:136`).
 *
 * This is a server-independent, DOM-level proof (jsdom, no Playwright, no
 * app server) of the exact selector bug and its fix: chaining `.locator()`
 * calls instead of string-concatenating `tid()`'s comma-list.
 */
// `e2e/helpers/navigation.ts` imports `@playwright/test` for types/expect;
// mock it so this pure-DOM proof does not need a browser (same pattern as
// `__tests__/e2e/e2eApi.test.ts`).
jest.mock('@playwright/test', () => ({
  expect: (value: unknown) => ({
    toBeTruthy: () => {
      if (!value) throw new Error('expected truthy value')
    },
  }),
}))

import { tid } from '../../e2e/helpers/navigation'

const POPULAR_TESTID = 'travel-details-popular-loaded'
const CARD_SELECTOR = 'a[data-testid="travel-card-link"]'

// Mirrors `components/travel/details/sections/TravelDetailsSidebarSection.tsx:136`:
// the wrapper always renders; its Suspense child is empty until
// `PopularTravelList` has real data.
function renderEmptyPopularSection(): void {
  document.body.innerHTML = `
    <div data-testid="${POPULAR_TESTID}">
      <div><!-- Suspense fallback: no cards loaded yet --></div>
    </div>
  `
}

function renderPopularSectionWithCards(cardCount: number): void {
  const cards = Array.from(
    { length: cardCount },
    (_, index) => `<a data-testid="travel-card-link" href="/travels/${index}">Card ${index}</a>`,
  ).join('')
  document.body.innerHTML = `
    <div data-testid="${POPULAR_TESTID}">
      <div>${cards}</div>
    </div>
  `
}

/** Exact string the OLD buggy `waitForPopularCardCount` built. */
function buildOldConcatenatedSelector(): string {
  return `${tid(POPULAR_TESTID)} ${CARD_SELECTOR}, ${tid(POPULAR_TESTID)} a[testID="travel-card-link"]`
}

/** Equivalent of the FIXED `page.locator(tid(...)).locator('a[...]')` chain. */
function queryWithChainedLocator(): NodeListOf<Element> {
  const container = document.querySelector(tid(POPULAR_TESTID))
  if (!container) return document.querySelectorAll('__no-match__')
  return container.querySelectorAll(CARD_SELECTOR)
}

describe('#1608 waitForPopularCardCount selector regression', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('tid() returns a comma-separated selector list (the root cause)', () => {
    expect(tid(POPULAR_TESTID)).toBe(
      `[data-testid="${POPULAR_TESTID}"], [testID="${POPULAR_TESTID}"]`,
    )
  })

  it('OLD string-concatenated selector false-positives on the empty container (0 cards)', () => {
    renderEmptyPopularSection()
    const matches = document.querySelectorAll(buildOldConcatenatedSelector())
    // BUG: matches the bare wrapper itself via the selector list's first
    // branch, even though it contains zero `travel-card-link` descendants.
    expect(matches.length).toBe(1)
    expect(matches[0].getAttribute('data-testid')).toBe(POPULAR_TESTID)
  })

  it('FIXED chained locator correctly reports 0 on the empty container', () => {
    renderEmptyPopularSection()
    const matches = queryWithChainedLocator()
    expect(matches.length).toBe(0)
  })

  it('FIXED chained locator correctly finds real cards once they render', () => {
    renderPopularSectionWithCards(6)
    const matches = queryWithChainedLocator()
    expect(matches.length).toBe(6)
  })

  it('OLD selector cannot distinguish 0 cards from N cards on the union match, FIXED one can', () => {
    renderEmptyPopularSection()
    const oldEmptyCount = document.querySelectorAll(buildOldConcatenatedSelector()).length
    const fixedEmptyCount = queryWithChainedLocator().length

    renderPopularSectionWithCards(3)
    const oldLoadedCount = document.querySelectorAll(buildOldConcatenatedSelector()).length
    const fixedLoadedCount = queryWithChainedLocator().length

    // OLD: 1 (container) in both states — the assertion `count > 0` in the
    // original spec passed identically whether cards existed or not.
    expect(oldEmptyCount).toBe(1)
    expect(oldLoadedCount).toBe(1)
    // FIXED: tracks the real card count, 0 -> N.
    expect(fixedEmptyCount).toBe(0)
    expect(fixedLoadedCount).toBe(3)
  })
})
