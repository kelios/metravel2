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
  expectHeroFavoriteOnTop,
  expectHeroSwipeAdvances,
  expectSsgHandoffActive,
  heroFavoriteButton,
  injectSsgTravelHero,
} from './helpers/travelHeroFavorite'

/**
 * #2116: hero-сердечко детали путешествия кликабельно поверх слайдера в
 * SSG-handoff. Детерминированно: мок статьи + вставка SSG-hero в документ.
 * Реальная статья и реальный аккаунт — `travel-hero-favorite-production-smoke.spec.ts`.
 */
const TRAVEL_PATH = `/travels/${FALLBACK_TRAVEL_SLUG}`
const ANON_STATE = { cookies: [], origins: [] }

test.describe('Travel details hero favorite (#2116)', () => {
  test.use({ storageState: ANON_STATE })

  for (const viewport of HERO_FAVORITE_VIEWPORTS) {
    test.describe(viewport.name, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await preacceptCookies(page)
        await mockFallbackTravelDetails(page)
        await injectSsgTravelHero(page, TRAVEL_PATH)
      })

      test('guest: heart is on top of the SSG-handoff slider and leads to sign-in', async ({ page }) => {
        await gotoWithRetry(page, TRAVEL_PATH)
        await expectSsgHandoffActive(page)
        await expectHeroFavoriteOnTop(page)

        await heroFavoriteButton(page).click()
        await expect(page).toHaveURL(/\/login/, { timeout: 15_000 })
      })

      test('signed in: heart marks favorite, toast undo unmarks it', async ({ page }) => {
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
        await expectHeroFavoriteOnTop(page)

        await heroFavoriteButton(page).click()
        await expect.poll(() => calls).toContain(`PATCH /api/travels/${FALLBACK_TRAVEL_ID}/mark-as-favorite/`)
        const undo = page.getByRole('button', { name: 'Отменить', exact: true })
        await expect(undo).toBeVisible({ timeout: 10_000 })

        await undo.click()
        await expect.poll(() => calls).toContain(`PATCH /api/travels/${FALLBACK_TRAVEL_ID}/unmark-as-favorite/`)
      })

      if (viewport.isMobile) {
        test('swipe on the hero still pages the gallery, heart stays on top', async ({ page }) => {
          await gotoWithRetry(page, TRAVEL_PATH)
          await expectSsgHandoffActive(page)
          await expectHeroSwipeAdvances(page)
          await expectHeroFavoriteOnTop(page)
        })
      }
    })
  }
})
