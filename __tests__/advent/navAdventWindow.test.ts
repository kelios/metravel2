import { isNavRouteAvailable } from '@/constants/platformNavRoutes'
import { SUPPLEMENTARY_NAV_ITEMS } from '@/constants/headerNavigation'
import { listStaticRoutes, resolveStaticRouteSeo } from '@/utils/seoRoutes/staticRoutes'
import { APP_ROUTE_ROOTS } from '@/utils/siteLinks'
import { i18n } from '@/i18n'

describe('advent entry points outside the screen (#2866)', () => {
  it('shows the /advent menu item only inside the campaign window, on every platform', () => {
    expect(isNavRouteAvailable('/advent', 'web', new Date(2026, 10, 30, 12))).toBe(false)
    expect(isNavRouteAvailable('/advent', 'ios', new Date(2026, 10, 30, 12))).toBe(false)
    expect(isNavRouteAvailable('/advent', 'web', new Date(2026, 11, 1, 12))).toBe(true)
    expect(isNavRouteAvailable('/advent', 'android', new Date(2027, 0, 7, 12))).toBe(true)
    expect(isNavRouteAvailable('/advent', 'web', new Date(2027, 0, 8, 12))).toBe(false)
    // other routes keep the previous policy
    expect(isNavRouteAvailable('/roulette', 'ios', new Date(2026, 10, 30, 12))).toBe(true)
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
