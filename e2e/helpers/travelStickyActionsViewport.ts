import { expect, type Page } from '@playwright/test'

/**
 * #2117: «Действия с путешествием» (TravelStickyActions) — плавающий бар
 * mobile web. Playwright кликал по нему, когда бар лежал в низу статьи
 * (top≈47 000px), поэтому видимость проверяется геометрией, а не `toBeVisible`.
 */

export const STICKY_ACTIONS_VIEWPORTS = [
  { name: 'mobile-390', width: 390, height: 844, isMobile: true },
  { name: 'mobile-320', width: 320, height: 640, isMobile: true },
  { name: 'desktop-1440', width: 1440, height: 900, isMobile: false },
] as const

const STICKY_TOOLBAR = '[role="toolbar"][aria-label="Действия с путешествием"]'

export const stickyActionsToolbar = (page: Page) => page.locator(STICKY_TOOLBAR)

/**
 * Бар появляется после скролла > 300px и движения вверх
 * (`TravelStickyActions.tsx`, THRESHOLD). Скролл двигает сам
 * `travel-details-scroll`: документ на web не прокручивается.
 */
export async function scrollTravelDetailsTo(page: Page, positions: number[]): Promise<void> {
  await page.getByTestId('travel-details-scroll').evaluate(async (el, ys) => {
    for (const y of ys) {
      el.scrollTop = y
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
  }, positions)
}

type BarGeometry = {
  top: number
  bottom: number
  innerHeight: number
  dockTop: number | null
}

async function readBarGeometry(page: Page): Promise<BarGeometry | null> {
  return page.evaluate((selector) => {
    const bar = document.querySelector(selector)
    if (!bar) return null
    const rect = bar.getBoundingClientRect()
    const dock = document.querySelector('[data-testid="footer-dock-wrapper"]')
    const dockRect = dock?.getBoundingClientRect()
    return {
      top: Math.round(rect.top),
      bottom: Math.round(rect.bottom),
      innerHeight: window.innerHeight,
      dockTop: dockRect && dockRect.height > 0 ? Math.round(dockRect.top) : null,
    }
  }, STICKY_TOOLBAR)
}

/**
 * Скролл на `depth` и назад: бар в окне — top >= 0, top + height <= innerHeight
 * и не заходит на нижний док. Бар живёт в отложенном рантайме детали (lazy-чанк
 * после LCP), а дозагрузка секций сдвигает scrollTop вниз и прячет бар — пока его
 * нет, жест «чуть вверх» повторяется; пока он есть, ждём, когда translateY-пружина
 * доедет до 0.
 */
export async function expectStickyActionsInViewport(page: Page, depth: number, label: string): Promise<void> {
  await scrollTravelDetailsTo(page, [depth / 4, depth / 2, depth])
  await expect
    .poll(
      async () => {
        const g = await readBarGeometry(page)
        if (!g) {
          await page.getByTestId('travel-details-scroll').evaluate((el) => {
            el.scrollTop = Math.max(400, el.scrollTop - 120)
          })
          return 'missing'
        }
        if (g.top < 0) return `top ${g.top} < 0`
        if (g.bottom > g.innerHeight) return `bottom ${g.bottom} > innerHeight ${g.innerHeight}`
        if (g.dockTop !== null && g.bottom > g.dockTop) return `bottom ${g.bottom} overlaps dock at ${g.dockTop}`
        return 'in-viewport'
      },
      {
        timeout: 30_000,
        intervals: [300, 500, 1_000],
        message: `${label}: sticky toolbar must sit inside the viewport above the dock`,
      },
    )
    .toBe('in-viewport')
}

/**
 * Полный сценарий: скролл вниз и вверх — бар в окне; дальше по статье и снова
 * вверх — бар всё ещё в окне (а не прибит к одной точке контента).
 * На desktop бар по контракту не рендерится (`shouldShowTravelStickyActions`).
 */
export async function assertStickyActionsViewportContract(
  page: Page,
  viewport: (typeof STICKY_ACTIONS_VIEWPORTS)[number],
): Promise<void> {
  if (!viewport.isMobile) {
    await scrollTravelDetailsTo(page, [400, 800, 1200, 1000])
    await expect(stickyActionsToolbar(page), 'desktop renders no sticky toolbar').toHaveCount(0)
    return
  }

  await expectStickyActionsInViewport(page, 1200, `${viewport.name} after first scroll`)
  await expectStickyActionsInViewport(page, 2400, `${viewport.name} after deeper scroll`)
}
