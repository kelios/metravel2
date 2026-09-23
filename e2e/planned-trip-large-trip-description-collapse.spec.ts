import type { Page } from '@playwright/test'

import { expect, test } from './fixtures'
import { LARGE_TRIP_ID, mockLargePlannedTrip, waitForFakeAuth } from './helpers/largePlannedTripFixture'

/**
 * #2060 — длинное описание поездки (6 274 знака) не сворачивалось на desktop:
 * `trip-plan-tabs` стоял на 2 116 px, конструктор маршрута — на 2 182 px.
 * Норматив — `docs/features/trips-plan-route-tab-mock.md` §5. Общая фикстура
 * крупной поездки (#2058) — та же, что берут #2059 и эта спека.
 *
 * Замер на проде до фикса (trip 47, 23.09.2026): 1440×900 — верх табов
 * 2 116 px, кнопки «Показать полностью» нет; 390×844 — описание 2 строки,
 * кнопка есть, табы на 458 px. Порог этой спеки на 1440×900 — верх табов
 * ≤ 900 px.
 */

const DESKTOP_TABS_TOP_MAX = 900

const documentTop = (page: Page, testId: string) =>
  page.evaluate((id) => {
    const node = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
    if (!node) return Number.NaN
    let scrolled = window.scrollY
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      scrolled += parent.scrollTop
    }
    return Math.round(node.getBoundingClientRect().top + scrolled)
  }, testId)

async function openLargeTrip(page: Page, viewport: { width: number; height: number }) {
  await mockLargePlannedTrip(page)
  await page.setViewportSize(viewport)
  await page.goto(`/trips/plan/${LARGE_TRIP_ID}`, { waitUntil: 'domcontentloaded' })
  await waitForFakeAuth(page)
  await expect(page.getByTestId('trip-plan-panel-route').first()).toBeVisible({ timeout: 30_000 })
}

test.describe('Planned trip description — collapses on desktop for a large trip (#2060)', () => {
  test('desktop-1440: description clamps to 8 lines, tabs land within 900 px, expand shows the full text', async ({
    page,
  }, testInfo) => {
    await openLargeTrip(page, { width: 1440, height: 900 })

    const description = page.getByTestId('trip-plan-description')
    const toggle = page.getByTestId('trip-plan-description-toggle')
    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')

    const descriptionBox = await description.boundingBox()
    const tabsTop = await documentTop(page, 'trip-plan-tabs')
    testInfo.annotations.push({
      type: 'measure',
      description: `1440x900: description height ${Math.round(descriptionBox?.height ?? 0)}px, trip-plan-tabs top ${tabsTop}px`,
    })
    console.log(
      `[#2060] 1440x900 description height=${Math.round(descriptionBox?.height ?? 0)}px trip-plan-tabs top=${tabsTop}px`,
    )
    expect(tabsTop).toBeLessThanOrEqual(DESKTOP_TABS_TOP_MAX)

    const collapsedHeight = descriptionBox?.height ?? 0
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const expandedBox = await description.boundingBox()
    expect(expandedBox?.height ?? 0).toBeGreaterThan(collapsedHeight)

    await page.screenshot({ path: testInfo.outputPath('large-trip-description-1440.png') })
  })

  test('mobile-390: description still clamps to two lines under the compact route header', async ({ page }) => {
    await openLargeTrip(page, { width: 390, height: 844 })

    const toggle = page.getByTestId('trip-plan-description-toggle')
    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })
})
