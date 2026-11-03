import { test, expect } from './fixtures'
import { ensureAuthedStorageFallback, mockFakeAuthApis } from './helpers/auth'
import {
  FALLBACK_TRAVEL_ID,
  FALLBACK_TRAVEL_SLUG,
  gotoWithRetry,
  mockFallbackTravelDetails,
  preacceptCookies,
} from './helpers/navigation'
import {
  HERO_FAVORITE_VIEWPORTS,
  expectGuestFavoriteSignIn,
  expectTravelFavoriteAction,
  expectHeroSwipeAdvances,
  expectSsgHandoffActive,
  heroFavoriteButton,
  injectSsgTravelHero,
} from './helpers/travelHeroFavorite'

/**
 * #3022: подписанное сохранение независимо от слоёв SSG-галереи.
 * Детерминированно: мок статьи и вставка SSG-hero в документ.
 */
const TRAVEL_PATH = `/travels/${FALLBACK_TRAVEL_SLUG}`
const ANON_STATE = { cookies: [], origins: [] }

test.describe('Travel details hero favorite (#3022)', () => {
  test.use({ storageState: ANON_STATE })

  for (const viewport of HERO_FAVORITE_VIEWPORTS) {
    test.describe(viewport.name, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await preacceptCookies(page)
        await mockFallbackTravelDetails(page)
        await injectSsgTravelHero(page, TRAVEL_PATH)
      })

      test('guest: labeled favorite action leads to auth with the travel intent', async ({ page }) => {
        await gotoWithRetry(page, TRAVEL_PATH)
        await expectSsgHandoffActive(page)
        await expectTravelFavoriteAction(page, { initialViewport: viewport.isMobile })

        await expectGuestFavoriteSignIn(page, TRAVEL_PATH)
      })

      test('signed in: action marks favorite, toast undo unmarks it', async ({ page }) => {
        const calls: string[] = []
        await ensureAuthedStorageFallback(page)
        await mockFakeAuthApis(page)
        await page.route('**/api/user/*/favorite-travels/**', (route) =>
          route.request().method() === 'GET'
            ? route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
            : route.fallback(),
        )
        await page.route(/\/api\/travels\/\d+\/(un)?mark-as-favorite\//, async (route) => {
          const { pathname } = new URL(route.request().url())
          calls.push(`${route.request().method()} ${pathname}`)
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ favorite: !pathname.includes('unmark') }),
          })
        })

        await gotoWithRetry(page, TRAVEL_PATH)
        await expectSsgHandoffActive(page)
        await expectTravelFavoriteAction(page)

        await heroFavoriteButton(page).click()
        await expect.poll(() => calls).toContain(`PATCH /api/travels/${FALLBACK_TRAVEL_ID}/mark-as-favorite/`)
        const undo = page.getByRole('button', { name: 'Отменить', exact: true })
        await expect(undo).toBeVisible({ timeout: 10_000 })

        await undo.click()
        await expect.poll(() => calls).toContain(`PATCH /api/travels/${FALLBACK_TRAVEL_ID}/unmark-as-favorite/`)
      })

      if (viewport.isMobile) {
        test('swipe still pages the gallery and favorite remains accessible', async ({ page }) => {
          await gotoWithRetry(page, TRAVEL_PATH)
          await expectSsgHandoffActive(page)
          await expectHeroSwipeAdvances(page)
          await expectTravelFavoriteAction(page)
        })
      }
    })
  }
})
