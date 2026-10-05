// #2119: политика навигации для каталога PDF-книги.
import {
  BOOK_EXPORT_ROUTE,
  isBookExportEntryVisible,
  isNavRouteAvailable,
  PRINT_NAV_ROUTES,
  WEB_ONLY_NAV_ROUTES,
} from '@/constants/platformNavRoutes'

let mockPrintAvailable = true
jest.mock('@/utils/printAvailability', () => ({
  isPrintAvailable: () => mockPrintAvailable,
}))

describe('platformNavRoutes: каталог PDF-книги (#2119)', () => {
  beforeEach(() => {
    mockPrintAvailable = true
  })

  it('/export больше не веб-только маршрут, а маршрут печати', () => {
    expect(WEB_ONLY_NAV_ROUTES).not.toContain(BOOK_EXPORT_ROUTE)
    expect(PRINT_NAV_ROUTES).toEqual([BOOK_EXPORT_ROUTE])
  })

  it.each(['ios', 'android'])('%s: /export доступен, когда в сборке есть модуль печати', (os) => {
    for (const route of ['/export', '/export/', '/export?from=menu', { pathname: '/export' }]) {
      expect(isNavRouteAvailable(route, os)).toBe(true)
    }
  })

  it.each(['ios', 'android'])('%s: в сборке без модуля печати /export не показывается', (os) => {
    mockPrintAvailable = false
    expect(isNavRouteAvailable('/export', os)).toBe(false)
    // Остальных маршрутов модуль печати не касается.
    expect(isNavRouteAvailable('/profile', os)).toBe(true)
  })

  it('web: /export доступен независимо от модуля печати', () => {
    mockPrintAvailable = false
    expect(isNavRouteAvailable('/export', 'web')).toBe(true)
  })

  describe('isBookExportEntryVisible', () => {
    it('сайт: вход только на десктопной поверхности — мобильная без книги (решение 01.07.2026)', () => {
      expect(isBookExportEntryVisible({ isDesktopSurface: true }, 'web')).toBe(true)
      expect(isBookExportEntryVisible({ isDesktopSurface: false }, 'web')).toBe(false)
    })

    it.each(['ios', 'android'])('%s: вход на любой поверхности, когда есть модуль печати', (os) => {
      expect(isBookExportEntryVisible({ isDesktopSurface: true }, os)).toBe(true)
      expect(isBookExportEntryVisible({ isDesktopSurface: false }, os)).toBe(true)
    })

    it.each(['ios', 'android'])('%s: без модуля печати входа нет', (os) => {
      mockPrintAvailable = false
      expect(isBookExportEntryVisible({ isDesktopSurface: true }, os)).toBe(false)
      expect(isBookExportEntryVisible({ isDesktopSurface: false }, os)).toBe(false)
    })
  })
})
