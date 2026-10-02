import { test, expect } from './fixtures'
import { gotoWithRetry, preacceptCookies } from './helpers/navigation'
import {
  STICKY_ACTIONS_VIEWPORTS,
  assertStickyActionsViewportContract,
} from './helpers/travelStickyActionsViewport'

/**
 * #2117: тот же контракт, что `travel-sticky-actions-viewport.spec.ts`, но на
 * реальной статье без моков — в `PRODUCTION_SMOKE_SPECS`
 * (`scripts/e2e-suite-classification.js`), гоняется против `metravel.by`.
 * Статья — длинная опубликованная (канонический slug статьи из
 * `prod-media-smoke.spec.ts`); для другого стенда задаётся
 * `E2E_STICKY_ACTIONS_TRAVEL_SLUG`.
 */
const TRAVEL_SLUG =
  process.env.E2E_STICKY_ACTIONS_TRAVEL_SLUG || 'zakshuvek-biriuzovyi-karer-dlia-kupaniia-v-krakove'

test.describe('Travel details sticky actions — production smoke (#2117)', () => {
  for (const viewport of STICKY_ACTIONS_VIEWPORTS) {
    test(viewport.name, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await preacceptCookies(page)
      await gotoWithRetry(page, `/travels/${TRAVEL_SLUG}`)
      await expect(page.getByTestId('travel-details-title')).toBeVisible({ timeout: 30_000 })

      const scroll = page.getByTestId('travel-details-scroll')
      await expect
        .poll(() => scroll.evaluate((el) => el.scrollHeight - el.clientHeight), {
          timeout: 20_000,
          message: `/travels/${TRAVEL_SLUG} must be long enough to scroll past the bar threshold`,
        })
        .toBeGreaterThan(3_000)

      await assertStickyActionsViewportContract(page, viewport)
    })
  }
})
