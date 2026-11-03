import { test } from './fixtures'
import { gotoWithRetry, preacceptCookies } from './helpers/navigation'
import {
  HERO_FAVORITE_VIEWPORTS,
  expectGuestFavoriteSignIn,
  expectTravelFavoriteAction,
  expectHeroSwipeAdvances,
  expectSsgHandoffActive,
} from './helpers/travelHeroFavorite'

/**
 * #3022: гостевая часть контракта `travel-hero-favorite.spec.ts` на реальной
 * SSG-статье без моков — в `PRODUCTION_SMOKE_SPECS`, гоняется против
 * `metravel.by`. Набор read-only (`scripts/e2e-target-safety.js`), поэтому
 * mark-as-favorite e2e-аккаунтом здесь не пишется: его покрывает детерминированная
 * спека, а на проде — приёмка в `testing`.
 */
const TRAVEL_SLUG =
  process.env.E2E_HERO_FAVORITE_TRAVEL_SLUG || 'zakshuvek-biriuzovyi-karer-dlia-kupaniia-v-krakove'
const TRAVEL_PATH = `/travels/${TRAVEL_SLUG}`

test.describe('Travel details hero favorite — production smoke (#3022)', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  for (const viewport of HERO_FAVORITE_VIEWPORTS) {
    test.describe(viewport.name, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await preacceptCookies(page)
      })

      test('guest: labeled favorite action leads to auth with the travel intent', async ({ page }) => {
        await gotoWithRetry(page, TRAVEL_PATH)
        await expectSsgHandoffActive(page)
        await expectTravelFavoriteAction(page, { initialViewport: viewport.isMobile })

        await expectGuestFavoriteSignIn(page, TRAVEL_PATH)
      })

      if (viewport.isMobile) {
        test('swipe pages the gallery and favorite remains accessible', async ({ page }) => {
          await gotoWithRetry(page, TRAVEL_PATH)
          await expectSsgHandoffActive(page)
          await expectHeroSwipeAdvances(page)
          await expectTravelFavoriteAction(page)
        })
      }
    })
  }
})
