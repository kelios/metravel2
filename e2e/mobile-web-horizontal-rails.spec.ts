import { test, expect } from './fixtures'
import { gotoWithRetry, preacceptCookies, tid } from './helpers/navigation'

type RailState = {
  cardCount: number
  railClientWidth: number
  railScrollWidth: number
  railScrollLeft: number
  railTouchAction: string
  cardComputedTouchAction: string
  cardDeclaredTouchAction: string
}

const travelsOfMonthFixture = Array.from({ length: 5 }, (_, index) => ({
  id: 910000 + index,
  slug: `e2e-mobile-rail-${index + 1}`,
  url: `/travels/e2e-mobile-rail-${index + 1}`,
  name: `E2E mobile rail ${index + 1}`,
  countryName: 'Беларусь',
  travel_image_thumb_url: `https://images.unsplash.com/photo-${1500000000000 + index}?auto=format&fit=crop&w=900&q=80`,
}))

async function installTravelsOfMonthMock(page: import('@playwright/test').Page) {
  const fulfillFixture = async (route: import('@playwright/test').Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(travelsOfMonthFixture),
    })
  }

  await page.route('**/api/travels/of-month/**', fulfillFixture)
  await page.route('**/travels/of-month/**', fulfillFixture)
}

async function getWeeklyHighlightsRailState(
  page: import('@playwright/test').Page,
): Promise<RailState | null> {
  return page.locator(tid('weekly-highlights-rail')).evaluate((root) => {
    const rail = root as HTMLElement | null
    if (!rail) return null

    const isVisible = (node: Element | null) => {
      if (!(node instanceof HTMLElement)) return false
      const style = getComputedStyle(node)
      const rect = node.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
    }

    const cards = Array.from(
      rail.querySelectorAll('[role="link"][aria-label^="Открыть маршрут"], [data-testid^="tab-travel-card-"]:not([data-testid$="-content"])'),
    ).filter(isVisible) as HTMLElement[]

    const firstCard = cards[0]
    if (!firstCard) return null

    return {
      cardCount: cards.length,
      railClientWidth: rail.clientWidth,
      railScrollWidth: rail.scrollWidth,
      railScrollLeft: rail.scrollLeft,
      railTouchAction: getComputedStyle(rail).touchAction,
      cardComputedTouchAction: getComputedStyle(firstCard).touchAction,
      cardDeclaredTouchAction: firstCard.style.touchAction,
    }
  })
}

async function scrollWeeklyHighlightsRail(page: import('@playwright/test').Page) {
  return page.locator(tid('weekly-highlights-rail')).evaluate((root) => {
    const rail = root as HTMLElement | null
    if (!rail) return null

    const before = rail.scrollLeft
    const maxDelta = rail.scrollWidth - rail.clientWidth - before
    const delta = Math.max(0, Math.min(160, maxDelta))
    rail.scrollLeft = before + delta

    return {
      before,
      after: rail.scrollLeft,
      delta,
    }
  })
}

test.describe('Mobile web horizontal card rails', () => {
  test('weekly highlights keeps a horizontally scrollable rail with pan-x touch action on cards', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      hasTouch: true,
      isMobile: true,
    })
    const page = await context.newPage()

    try {
      await preacceptCookies(page)
      await installTravelsOfMonthMock(page)
      await page.addInitScript(() => {
        try {
          sessionStorage.setItem('recommendations_visible', 'true')
          sessionStorage.removeItem('weekly_highlights_collapsed')
        } catch {
          // noop
        }
      })

      await gotoWithRetry(page, '/travelsby')
      await page.locator(tid('recommendations-list-header')).waitFor({ state: 'visible', timeout: 30_000 })
      await page.locator(tid('weekly-highlights-rail')).waitFor({ state: 'visible', timeout: 30_000 })

      await expect
        .poll(async () => {
          const state = await getWeeklyHighlightsRailState(page)
          return state?.cardCount ?? 0
        }, { timeout: 30_000 })
        .toBeGreaterThan(1)

      await expect
        .poll(async () => (await getWeeklyHighlightsRailState(page))?.cardDeclaredTouchAction ?? '', {
          timeout: 30_000,
        })
        .toBe('pan-x pan-y')

      const railState = await getWeeklyHighlightsRailState(page)
      expect(railState).not.toBeNull()
      expect(railState?.cardCount ?? 0).toBeGreaterThan(1)
      expect(railState?.railScrollWidth ?? 0).toBeGreaterThan(railState?.railClientWidth ?? 0)
      expect(railState?.cardDeclaredTouchAction).toContain('pan-x')
      expect(railState?.cardDeclaredTouchAction).toContain('pan-y')

      const scrollResult = await scrollWeeklyHighlightsRail(page)
      expect(scrollResult).not.toBeNull()
      expect((scrollResult?.after ?? 0) - (scrollResult?.before ?? 0)).toBeGreaterThan(0)
    } finally {
      await context.close()
    }
  })
})

