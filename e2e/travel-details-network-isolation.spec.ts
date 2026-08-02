import { expect, test, type Page, type Request, type Route } from '@playwright/test'

import {
  FALLBACK_TRAVEL_SLUG,
  gotoWithRetry,
  mockFallbackTravelDetails,
  preacceptCookies,
} from './helpers/navigation'

const MOBILE_VIEWPORT = { width: 390, height: 844 }
const FALLBACK_TRAVEL_NAME = 'E2E stable travel details'
const IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC0lEQVR42mP8/x8AAwMCAO8ZKfkAAAAASUVORK5CYII='

const catalogTravel = {
  id: 990081,
  slug: FALLBACK_TRAVEL_SLUG,
  url: `/travels/${FALLBACK_TRAVEL_SLUG}`,
  name: FALLBACK_TRAVEL_NAME,
  countryName: 'Беларусь',
  cityName: 'Гомель',
  travel_image_thumb_url: IMAGE,
  travel_image_thumb_small_url: IMAGE,
  publish: true,
  moderation: true,
}

function isCatalogRequest(request: Request): boolean {
  if (request.method() !== 'GET') return false
  const url = new URL(request.url())
  return url.pathname === '/api/travels/' || url.pathname === '/travels/'
}

async function mockTravelCatalog(page: Page) {
  const fulfillCatalog = async (route: Route) => {
    if (!isCatalogRequest(route.request())) {
      await route.fallback()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [catalogTravel], total: 1 }),
    })
  }

  await page.route('**/api/travels/**', fulfillCatalog)
  await page.route('**/travels/**', fulfillCatalog)
}

function isForbiddenBackgroundRequest(request: Request): boolean {
  if (request.method() !== 'GET') return false
  const url = new URL(request.url())
  const path = url.pathname

  // `/getFiltersTravel/` is intentionally allowed: the root QueryClient
  // prefetches that static dictionary at browser idle, independently of routes.
  return (
    path === '/api/travels/' ||
    path === '/travels/' ||
    path === '/api/quests/' ||
    path === '/quests/' ||
    path.includes('/travels/popular/') ||
    path.includes('/travels/of-month/') ||
    path.includes('/user-points/') ||
    path.includes(`/travels/resolve-slug/${FALLBACK_TRAVEL_SLUG}/`) ||
    path.includes(`/travels/by-slug/${FALLBACK_TRAVEL_SLUG}/`) ||
    /\/api\/travels\/990081\/?$/.test(path)
  )
}

test.describe('Travel details network isolation #1105', () => {
  test.use({ viewport: MOBILE_VIEWPORT, hasTouch: true, isMobile: true })

  test('a small article scroll does not wake catalogs from the previous screen', async ({ page }) => {
    await preacceptCookies(page)
    const longDescription = Array.from(
      { length: 40 },
      (_, index) => `<p>Абзац ${index + 1}. Длинное описание маршрута для проверки сетевой изоляции экрана.</p>`,
    ).join('')
    await mockFallbackTravelDetails(page, { description: longDescription })
    await mockTravelCatalog(page)

    await gotoWithRetry(page, '/search')
    const card = page.locator('[data-testid="travel-card-link"], [testID="travel-card-link"]').first()
    await expect(card).toBeVisible({ timeout: 30_000 })
    await card.click()

    await expect(page).toHaveURL(new RegExp(`/travels/${FALLBACK_TRAVEL_SLUG}`), {
      timeout: 30_000,
    })
    const details = page.getByTestId('travel-details-page')
    await expect(details).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('travel-details-description')).toBeVisible({ timeout: 30_000 })

    const forbiddenRequests: string[] = []
    const observeRequest = (request: Request) => {
      if (isForbiddenBackgroundRequest(request)) forbiddenRequests.push(request.url())
    }
    page.on('request', observeRequest)

    const scroll = page.getByTestId('travel-details-scroll')
    await scroll.evaluate((node: HTMLElement) => {
      node.scrollTop = 300
      node.dispatchEvent(new Event('scroll', { bubbles: true }))
    })
    await page.waitForTimeout(1_500)
    page.off('request', observeRequest)

    expect(forbiddenRequests).toEqual([])
  })
})
