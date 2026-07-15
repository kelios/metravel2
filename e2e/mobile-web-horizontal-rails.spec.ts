import { test, expect } from './fixtures'
import { gotoWithRetry, tid } from './helpers/navigation'
import { seedNecessaryConsent } from './helpers/storage'

type StackState = {
  cardCount: number
  stackClientWidth: number
  stackScrollWidth: number
  firstCardTop: number
  secondCardTop: number
  firstCardWidth: number
  secondCardWidth: number
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

async function installPublicTravelListMock(page: import('@playwright/test').Page) {
  const fulfillList = async (route: import('@playwright/test').Route) => {
    const pathname = new URL(route.request().url()).pathname
    if (!pathname.endsWith('/api/travels/') && !pathname.endsWith('/travels/')) {
      await route.fallback()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: travelsOfMonthFixture,
        total: travelsOfMonthFixture.length,
      }),
    })
  }

  await page.route('**/api/travels/**', fulfillList)
  await page.route('**/travels/**', fulfillList)
}

async function getWeeklyHighlightsStackState(
  page: import('@playwright/test').Page,
): Promise<StackState | null> {
  return page.locator(tid('weekly-highlights-stack')).evaluate((root) => {
    const stack = root as HTMLElement | null
    if (!stack) return null

    const isVisible = (node: Element | null) => {
      if (!(node instanceof HTMLElement)) return false
      const style = getComputedStyle(node)
      const rect = node.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
    }

    const cards = Array.from(
      stack.querySelectorAll('[role="link"][aria-label^="Открыть маршрут"], [data-testid^="tab-travel-card-"]:not([data-testid$="-content"])'),
    ).filter(isVisible) as HTMLElement[]

    const firstCard = cards[0]
    const secondCard = cards[1]
    if (!firstCard || !secondCard) return null

    const firstRect = firstCard.getBoundingClientRect()
    const secondRect = secondCard.getBoundingClientRect()

    return {
      cardCount: cards.length,
      stackClientWidth: stack.clientWidth,
      stackScrollWidth: stack.scrollWidth,
      firstCardTop: firstRect.top,
      secondCardTop: secondRect.top,
      firstCardWidth: firstRect.width,
      secondCardWidth: secondRect.width,
    }
  })
}

test.describe('Mobile web recommendation card stacks', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    hasTouch: true,
    isMobile: true,
  })

  test('weekly highlights renders cards vertically without a horizontal rail', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent)
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem('recommendations_visible', 'true')
        sessionStorage.removeItem('weekly_highlights_collapsed')
      } catch {
        // noop
      }
    })
    await installPublicTravelListMock(page)
    await installTravelsOfMonthMock(page)

    await gotoWithRetry(page, '/travelsby')
    await expect(page.locator(tid('recommendations-list-header'))).toBeVisible({ timeout: 30_000 })
    await expect(page.locator(tid('weekly-highlights-stack'))).toBeVisible({ timeout: 30_000 })
    await expect(page.locator(tid('weekly-highlights-rail'))).toHaveCount(0)

    await expect
      .poll(async () => {
        const state = await getWeeklyHighlightsStackState(page)
        return state?.cardCount ?? 0
      }, { timeout: 30_000 })
      .toBeGreaterThan(1)

    const stackState = await getWeeklyHighlightsStackState(page)
    expect(stackState).not.toBeNull()
    expect(stackState?.cardCount ?? 0).toBeGreaterThan(1)
    expect(stackState?.stackScrollWidth ?? 0).toBeLessThanOrEqual((stackState?.stackClientWidth ?? 0) + 1)
    expect(stackState?.secondCardTop ?? 0).toBeGreaterThan(stackState?.firstCardTop ?? 0)
    expect(stackState?.firstCardWidth ?? 0).toBeGreaterThan((stackState?.stackClientWidth ?? 0) * 0.9)
    expect(stackState?.secondCardWidth ?? 0).toBeGreaterThan((stackState?.stackClientWidth ?? 0) * 0.9)
  })
})
