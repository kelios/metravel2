import { expect, type Page } from '@playwright/test'

import { gotoWithRetry, preacceptCookies } from './navigation'

/**
 * #2217 — the desktop-branch `/map` panel header (width ≥ 768) is one row of
 * three tabs: «Места», «Маршрут», «Фильтры». Contract checked on every tab in
 * every state: the union of its children's boxes lies inside the tab box (0 px
 * out — `scrollWidth` of the tab cannot see it: centred content sticks out on
 * both sides and scrollWidth only sees the right one), nothing is cut by an
 * ellipsis, the tab is at least 44 high, the content leaves the 8 px reserve,
 * exactly one tab is `aria-selected`. Norms:
 * docs/design/map-panel-header-tablet.md («Бюджет ширины после решения»).
 *
 * Shared by `map-page.spec.ts` (default suite, 820 × 1180) and
 * `map-panel-tabs-production-smoke.spec.ts` (all sizes and languages against
 * the production build).
 */

export type MapPanelTabsViewport = {
  name: string
  width: number
  height: number
  /** Persisted panel width (`metravel_map_panel_width`); CSS min-width 320 wins. */
  storedPanelWidth?: number
}

export const MAP_PANEL_TABS_VIEWPORTS: readonly MapPanelTabsViewport[] = [
  { name: '768x1024', width: 768, height: 1024 },
  { name: '820x1180', width: 820, height: 1180 },
  { name: '1180x820', width: 1180, height: 820 },
  { name: '1440x900', width: 1440, height: 900 },
  // The narrowest panel the branch renders: stored 300 → clamped to min-width 320.
  { name: '1440x900-panel320', width: 1440, height: 900, storedPanelWidth: 300 },
]

export const MAP_PANEL_TABS_LOCALES = ['ru', 'be', 'uk', 'pl', 'en'] as const
export type MapPanelTabsLocale = (typeof MAP_PANEL_TABS_LOCALES)[number]

// `map:components.MapPage.MapPanelHeader.mesta_3ad2b948` per locale: the
// visible «Места» proves the app booted in the target language, not in the
// prerendered RU.
const PLACES_LABEL: Record<MapPanelTabsLocale, string> = {
  ru: 'Места',
  be: 'Месцы',
  uk: 'Місця',
  pl: 'Miejsca',
  en: 'Places',
}

// Above the cap: the badge shows «999+», the widest it gets. A guest near Minsk
// gets a real count below 1000, so the count comes from the mocked search.
const MOCK_TOTAL = 1234
const MOCK_PAGE_SIZE = 30

const TAB_IDS = ['map-panel-tab-travels', 'map-panel-tab-route', 'map-panel-tab-filters']
const FORMER_HEADER_ACTIONS = ['map-filters-button', 'map-help-button', 'map-reset-filters-button']

// Answered inside the browser: the backend never sees the request. Fresh ids
// per page, so loading more never duplicates list keys.
async function installMapCountMock(page: Page): Promise<void> {
  let served = 0
  await page.route('**/api/travels/search_travels_for_map/**', async (route) => {
    const results = Array.from({ length: MOCK_PAGE_SIZE }, (_, index) => {
      const n = served + index
      const angle = (n / MOCK_PAGE_SIZE) * Math.PI * 2
      const radius = 0.02 * (0.2 + (n % 5) / 6)
      return {
        id: 20_000 + n,
        coord: `${(53.9 + Math.cos(angle) * radius).toFixed(6)},${(27.56 + Math.sin(angle) * radius).toFixed(6)}`,
        address: `Mock point ${n + 1}`,
        travelImageThumbUrl: '',
        categoryName: 'Mock',
        articleUrl: '',
        urlTravel: '/travels/mock',
      }
    })
    served += MOCK_PAGE_SIZE
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results, total: MOCK_TOTAL }),
    })
  })
}

export async function openMapForPanelTabs(
  page: Page,
  { viewport, locale }: { viewport: MapPanelTabsViewport; locale: MapPanelTabsLocale },
): Promise<void> {
  await page.setViewportSize({ width: viewport.width, height: viewport.height })
  await preacceptCookies(page)
  await page.addInitScript(
    ({ locale: targetLocale, storedPanelWidth }) => {
      try {
        window.localStorage.setItem(
          '@metravel/locale-preference:v1',
          JSON.stringify({ version: 1, mode: 'explicit', locale: targetLocale }),
        )
        window.localStorage.setItem('metravel_map_onboarding_completed', 'true')
        window.localStorage.removeItem('metravel_map_panel_collapsed')
        if (storedPanelWidth == null) window.localStorage.removeItem('metravel_map_panel_width')
        else window.localStorage.setItem('metravel_map_panel_width', String(storedPanelWidth))
      } catch {
        // storage unavailable: the checks below fail on the language instead
      }
    },
    { locale, storedPanelWidth: viewport.storedPanelWidth ?? null },
  )
  await installMapCountMock(page)
  await gotoWithRetry(page, '/map')

  const places = page.getByTestId('map-panel-tab-travels')
  await expect(places, `«${PLACES_LABEL[locale]}» in ${locale}`).toContainText(PLACES_LABEL[locale], {
    timeout: 60_000,
  })
  await expect(places, 'the mocked count above the cap').toContainText('999+', { timeout: 60_000 })
}

export type MapPanelTabMetrics = {
  testId: string
  selected: boolean
  width: number
  height: number
  /** How far the union of the children's boxes sticks out of the tab box. */
  overflowPx: number
  /** The widest ellipsis cut (scrollWidth − clientWidth of a clipping child). */
  clippedPx: number
  /** Tab width − own side paddings − the widest child at its intrinsic width. */
  reservePx: number
}

export async function measureMapPanelTabs(page: Page): Promise<MapPanelTabMetrics[]> {
  return page.evaluate(() => {
    const anchor = document.querySelector('[data-testid="map-panel-tab-travels"]')
    const tablist = anchor?.closest('[role="tablist"]')
    if (!tablist) return []

    return Array.from(tablist.querySelectorAll<HTMLElement>('[role="tab"]')).map((tab) => {
      const box = tab.getBoundingClientRect()
      let left = box.left
      let right = box.right
      let top = box.top
      let bottom = box.bottom
      let clippedPx = 0

      for (const node of Array.from(tab.querySelectorAll<HTMLElement>('*'))) {
        const rect = node.getBoundingClientRect()
        if (rect.width === 0 && rect.height === 0) continue
        left = Math.min(left, rect.left)
        right = Math.max(right, rect.right)
        top = Math.min(top, rect.top)
        bottom = Math.max(bottom, rect.bottom)
        const style = getComputedStyle(node)
        if (style.overflowX === 'hidden' || style.textOverflow === 'ellipsis') {
          clippedPx = Math.max(clippedPx, node.scrollWidth - node.clientWidth)
        }
      }

      // The icon row and the label: a clipped label still reports its full
      // width as scrollWidth, a row of icon + badge its full row width.
      const content = Math.max(
        0,
        ...Array.from(tab.children).map((child) => (child as HTMLElement).scrollWidth),
      )
      const tabStyle = getComputedStyle(tab)
      const paddings = parseFloat(tabStyle.paddingLeft) + parseFloat(tabStyle.paddingRight)

      return {
        testId: tab.getAttribute('data-testid') ?? '',
        selected: tab.getAttribute('aria-selected') === 'true',
        width: box.width,
        height: box.height,
        overflowPx: Math.max(0, box.left - left, right - box.right, box.top - top, bottom - box.bottom),
        clippedPx: Math.max(0, clippedPx),
        reservePx: box.width - paddings - content,
      }
    })
  })
}

/**
 * Checks the start state («Фильтры» selected), then selects «Места» and
 * «Маршрут» and checks again: the selected tab is bold, so each state is
 * measured on its own.
 */
export async function assertMapPanelTabsContract(page: Page, context: string): Promise<void> {
  for (const testId of FORMER_HEADER_ACTIONS) {
    await expect(page.getByTestId(testId), `${context}: ${testId} left the header (#2217)`).toHaveCount(0)
  }
  await expect(page.getByTestId('map-desktop-help-button'), `${context}: «Подсказки» on the map`).toBeVisible()

  const states = [
    { name: 'filters-start', testId: 'map-panel-tab-filters', select: false },
    { name: 'places', testId: 'map-panel-tab-travels', select: true },
    { name: 'route', testId: 'map-panel-tab-route', select: true },
  ]

  for (const state of states) {
    const tab = page.getByTestId(state.testId)
    if (state.select) await tab.click()
    await expect(tab, `${context} ${state.name}: selected`).toHaveAttribute('aria-selected', 'true')

    const tabs = await measureMapPanelTabs(page)
    console.log(`[map-panel-tabs] ${context} ${state.name}: ${JSON.stringify(tabs)}`)

    expect(tabs.map((item) => item.testId), `${context} ${state.name}: three tabs in strip order`).toEqual(TAB_IDS)
    expect(
      tabs.filter((item) => item.selected).map((item) => item.testId),
      `${context} ${state.name}: exactly one selected tab`,
    ).toEqual([state.testId])

    for (const item of tabs) {
      const where = `${context} ${state.name} ${item.testId}`
      expect(item.height, `${where}: tab height`).toBeGreaterThanOrEqual(44)
      // Sub-pixel layout only; any real overflow is several px.
      expect(item.overflowPx, `${where}: content outside the tab`).toBeLessThanOrEqual(0.5)
      // scrollWidth/clientWidth are rounded integers; a cut glyph is ≥ 4 px.
      expect(item.clippedPx, `${where}: label or badge cut by an ellipsis`).toBeLessThanOrEqual(1)
      expect(item.reservePx, `${where}: reserve to the tab edge`).toBeGreaterThanOrEqual(8)
    }
  }
}

/**
 * #2217 — «Подсказки» sits under «Слои», where the «Слои» card opens. While the
 * card is open the button must be gone: drawn over the card (zIndex 1001) it
 * covered the card's «×» and a click there started the tour instead of closing
 * the card. The point at the centre of «×» must belong to «×» itself.
 */
export async function assertMapLayersCardCloseReachable(page: Page, context: string): Promise<void> {
  await page.getByTestId('map-desktop-layers-button').click()
  const close = page.getByTestId('map-mobile-layers-popover-close')
  await expect(close, `${context}: «Слои» card open`).toBeVisible()
  await expect(page.getByTestId('map-desktop-help-button'), `${context}: «Подсказки» hidden under the open card`).toHaveCount(0)

  const box = await close.boundingBox()
  expect(box, `${context}: «×» has a box`).not.toBeNull()
  const hitsClose = await page.evaluate(
    ({ x, y }) => {
      const target = document.querySelector('[data-testid="map-mobile-layers-popover-close"]')
      const hit = document.elementFromPoint(x, y)
      return Boolean(target && hit && (target === hit || target.contains(hit)))
    },
    { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 },
  )
  expect(hitsClose, `${context}: the centre of «×» belongs to «×»`).toBe(true)

  await close.click()
  await expect(page.getByTestId('map-mobile-layers-popover'), `${context}: «×» closes the card`).toHaveCount(0)
  await expect(page.getByTestId('map-desktop-help-button'), `${context}: «Подсказки» back after close`).toBeVisible()
}
