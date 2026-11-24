import { isNavRouteAvailable } from '@/constants/platformNavRoutes'
import { SUPPLEMENTARY_NAV_ITEMS } from '@/constants/headerNavigation'
import { listStaticRoutes, resolveStaticRouteSeo } from '@/utils/seoRoutes/staticRoutes'
import { APP_ROUTE_ROOTS } from '@/utils/siteLinks'
import { i18n } from '@/i18n'
import { isAdventAnnounceWindow, isAdventCampaignWindow, isAdventEntryVisible } from '@/constants/advent'

describe('advent entry points outside the screen (#2866)', () => {
  it('shows the /advent menu item from the announce day through the campaign window, on every platform (#3481)', () => {
    expect(isNavRouteAvailable('/advent', 'web', new Date(2026, 10, 23, 12))).toBe(false)
    expect(isNavRouteAvailable('/advent', 'ios', new Date(2026, 10, 23, 12))).toBe(false)
    expect(isNavRouteAvailable('/advent', 'web', new Date(2026, 10, 24, 0, 5))).toBe(true)
    expect(isNavRouteAvailable('/advent', 'ios', new Date(2026, 10, 30, 12))).toBe(true)
    expect(isNavRouteAvailable('/advent', 'web', new Date(2026, 11, 1, 12))).toBe(true)
    expect(isNavRouteAvailable('/advent', 'android', new Date(2027, 0, 7, 12))).toBe(true)
    expect(isNavRouteAvailable('/advent', 'web', new Date(2027, 0, 8, 12))).toBe(false)
    // other routes keep the previous policy
    expect(isNavRouteAvailable('/roulette', 'ios', new Date(2026, 10, 30, 12))).toBe(true)
  })

  it('separates the announce days from the campaign days (#3481)', () => {
    const at = (m: number, d: number, y = 2026) => new Date(y, m, d, 12)
    expect([at(10, 23), at(10, 24), at(10, 30), at(11, 1), at(0, 7, 2027), at(0, 8, 2027)].map((date) => [
      isAdventAnnounceWindow(date),
      isAdventCampaignWindow(date),
      isAdventEntryVisible(date),
    ])).toEqual([
      [false, false, false],
      [true, false, true],
      [true, false, true],
      [false, true, true],
      [false, true, true],
      [false, false, false],
    ])
  })

  it('has a supplementary nav item with a localized label', async () => {
    const item = SUPPLEMENTARY_NAV_ITEMS.find((entry) => entry.path === '/advent')
    expect(item).toBeDefined()
    expect(item?.icon).toBe('gift')
    await i18n.changeLanguage('ru')
    expect(item?.label).toBe('Адвент-календарь')
    await i18n.changeLanguage('en')
    expect(item?.label).toBe('Advent Calendar')
    await i18n.changeLanguage('ru')
  })

  it('registers /advent as an indexable static SEO route and an app route root', () => {
    expect(listStaticRoutes()).toContain('/advent')
    const seo = resolveStaticRouteSeo('/advent', (key) => `[${key}]`)
    expect(seo?.title).toBe('[seoStatic:root.advent.title]')
    expect(seo?.robots).toBeUndefined()
    expect(APP_ROUTE_ROOTS.has('advent')).toBe(true)
  })
})
