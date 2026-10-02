import { test, expect } from './fixtures'
import {
  FALLBACK_TRAVEL_SLUG,
  gotoWithRetry,
  mockFallbackTravelDetails,
  preacceptCookies,
} from './helpers/navigation'
import {
  STICKY_ACTIONS_VIEWPORTS,
  assertStickyActionsViewportContract,
  expectStickyActionsInViewport,
  stickyActionsToolbar,
} from './helpers/travelStickyActionsViewport'

// #2117: длинная статья, чтобы низ контента был далеко за окном — именно там
// оказывался бар, смонтированный внутри ScrollView.
const LONG_DESCRIPTION = Array.from(
  { length: 60 },
  (_, i) => `<p>Абзац ${i + 1}: длинное описание маршрута для проверки плавающего бара действий при прокрутке.</p>`,
).join('')

test.describe('Travel details — sticky actions bar stays in the viewport (#2117)', () => {
  for (const viewport of STICKY_ACTIONS_VIEWPORTS) {
    test(viewport.name, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await preacceptCookies(page)
      await mockFallbackTravelDetails(page, { description: LONG_DESCRIPTION })
      await gotoWithRetry(page, `/travels/${FALLBACK_TRAVEL_SLUG}`)
      await expect(page.getByTestId('travel-details-title')).toBeVisible({ timeout: 30_000 })

      const scroll = page.getByTestId('travel-details-scroll')
      await expect
        .poll(() => scroll.evaluate((el) => el.scrollHeight - el.clientHeight), {
          timeout: 20_000,
          message: 'fixture article must be long enough to scroll past the bar threshold',
        })
        .toBeGreaterThan(3_000)

      await assertStickyActionsViewportContract(page, viewport)
    })
  }

  test('bar leaves with the screen on SPA navigation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await preacceptCookies(page)
    await mockFallbackTravelDetails(page, { description: LONG_DESCRIPTION })
    await gotoWithRetry(page, `/travels/${FALLBACK_TRAVEL_SLUG}`)
    await expect(page.getByTestId('travel-details-title')).toBeVisible({ timeout: 30_000 })

    await expectStickyActionsInViewport(page, 1200, 'before navigation')

    // Бар порталится в body: экран стека, ушедший из фокуса, не должен оставлять его поверх.
    await page.getByTestId('footer-item-quests').click()
    await expect(page).not.toHaveURL(new RegExp(`/travels/${FALLBACK_TRAVEL_SLUG}`))
    await expect(stickyActionsToolbar(page)).toHaveCount(0)
  })
})
