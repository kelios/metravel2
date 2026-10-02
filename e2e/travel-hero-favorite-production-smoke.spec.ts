import { test, expect } from './fixtures'
import { gotoWithRetry, preacceptCookies } from './helpers/navigation'
import {
  HERO_FAVORITE_VIEWPORTS,
  expectHeroFavoriteOnTop,
  expectHeroSwipeAdvances,
  expectSsgHandoffActive,
  heroFavoriteButton,
} from './helpers/travelHeroFavorite'

/**
 * #2116: гостевая часть контракта `travel-hero-favorite.spec.ts` на реальной
 * SSG-статье без моков — в `PRODUCTION_SMOKE_SPECS`, гоняется против
 * `metravel.by`. Набор read-only (`scripts/e2e-target-safety.js`), поэтому
 * mark-as-favorite e2e-аккаунтом здесь не пишется: его покрывает детерминированная
 * спека, а на проде — приёмка в `testing`.
 */
const TRAVEL_SLUG =
  process.env.E2E_HERO_FAVORITE_TRAVEL_SLUG || 'zakshuvek-biriuzovyi-karer-dlia-kupaniia-v-krakove'
const TRAVEL_PATH = `/travels/${TRAVEL_SLUG}`

test.describe('Travel details hero favorite — production smoke (#2116)', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  for (const viewport of HERO_FAVORITE_VIEWPORTS) {
    test.describe(viewport.name, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await preacceptCookies(page)
      })

      test('guest: heart is on top of the SSG-handoff slider and leads to sign-in', async ({ page }) => {
        await gotoWithRetry(page, TRAVEL_PATH)
        await expectSsgHandoffActive(page)
        await expectHeroFavoriteOnTop(page)

        await heroFavoriteButton(page).click()
        await expect(page).toHaveURL(/\/login/, { timeout: 15_000 })
      })

      if (viewport.isMobile) {
        test('swipe on the hero pages the gallery, heart stays on top', async ({ page }) => {
          await gotoWithRetry(page, TRAVEL_PATH)
          await expectSsgHandoffActive(page)
          await expectHeroSwipeAdvances(page)
          await expectHeroFavoriteOnTop(page)
        })
      }
    })
  }
})
