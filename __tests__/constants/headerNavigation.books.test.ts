import { translate } from '@/i18n'

type HeaderNavigationModule = typeof import('@/constants/headerNavigation')

// `isolateModules` gives a fresh `react-native`, so the platform is set on that instance.
const loadHeaderNavigation = (os: string): HeaderNavigationModule => {
  let loaded: HeaderNavigationModule | undefined
  jest.isolateModules(() => {
    Object.defineProperty(require('react-native').Platform, 'OS', { configurable: true, value: os })
    loaded = require('@/constants/headerNavigation')
  })
  return loaded!
}

describe('header navigation: «Книги» in the desktop bar (#2953)', () => {
  it('shows the short books label in the web desktop bar', () => {
    const item = loadHeaderNavigation('web').DESKTOP_BAR_NAV_ITEMS.find((entry) => entry.path === '/books')
    expect(item).toBeDefined()
    expect(item?.label).toBe(translate('books:navLabel'))
    expect(item?.label).not.toBe(translate('books:title'))
  })

  it('keeps the web-only books route out of the native tablet bar', () => {
    for (const os of ['ios', 'android'] as const) {
      const { DESKTOP_BAR_NAV_ITEMS, HEADER_NAV_ITEMS } = loadHeaderNavigation(os)
      expect(HEADER_NAV_ITEMS.some((entry) => entry.path === '/books')).toBe(true)
      expect(DESKTOP_BAR_NAV_ITEMS.some((entry) => entry.path === '/books')).toBe(false)
      expect(DESKTOP_BAR_NAV_ITEMS.some((entry) => entry.path === '/quests')).toBe(true)
    }
  })
})

it('keeps «Книги» highlighted on an edition page (#2953)', () => {
  const {getHeaderActivePath} = jest.requireActual('@/components/layout/customHeaderModel')
  expect(getHeaderActivePath('/books/belarus')).toBe('/books')
})
