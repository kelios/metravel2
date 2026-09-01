import React from 'react'
import { render } from '@testing-library/react-native'
import { usePathname, useRouter } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Platform, StyleSheet } from 'react-native'

import CustomHeader from '@/components/layout/CustomHeader'

/**
 * #1298: шапка присутствует в статическом HTML, поэтому её до-гидрационный кадр
 * рисует браузер. Раньше SSR-снимок (`width = 0`) давал мобильную строку, и
 * после гидратации она перекладывалась в desktop — логотип 44x44 -> 115x44,
 * переключатель языка 624 -> 1167 (замер прода 2026-08-06).
 *
 * Контракт теперь такой: на web до гидратации строка ВСЕГДА несёт
 * desktop-геометрию (словесная часть логотипа, бокс навигации, полный
 * переключатель, зарезервированный слот аккаунта), а к мобильному виду её
 * приводит media-query критического CSS. Эти тесты держат именно первую
 * половину контракта; вторую держит `__tests__/utils/criticalCSSBuilder.test.ts`.
 */

const mockAuthContext = {
  isAuthenticated: false,
  username: '',
  logout: jest.fn(),
  userAvatar: null,
  profileRefreshToken: 0,
  userId: null,
}

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => mockAuthContext,
}))

jest.mock('@/context/FavoritesContext', () => ({
  useFavorites: () => ({
    favorites: [],
    viewHistory: [],
    addFavorite: jest.fn(),
    removeFavorite: jest.fn(),
    isFavorite: jest.fn(),
    getRecommendations: jest.fn(() => []),
  }),
}))

jest.mock('@/context/FiltersProvider', () => ({
  useFilters: () => ({ updateFilters: jest.fn() }),
}))

jest.mock('@/i18n/LocaleProvider', () => ({
  useLocale: () => ({
    locale: 'ru',
    preference: { version: 1, mode: 'explicit', locale: 'ru' },
    supportedLocales: ['ru', 'be', 'uk', 'pl', 'en'],
    isHydrated: true,
    setLocale: jest.fn(),
    useSystemLocale: jest.fn(),
  }),
}))

jest.mock('../../components/layout/AccountMenu', () => () => null)
let mockContextBarShouldSuspend = false

jest.mock('../../components/layout/HeaderContextBar', () => {
  const React = require('react')
  const { View } = require('react-native')
  return () => {
    if (mockContextBarShouldSuspend) throw new Promise(() => {})
    return React.createElement(View, { testID: 'mock-header-context-bar' })
  }
})

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => (global as any).__mockResponsive,
  useResponsiveWidth: () => (global as any).__mockResponsive?.width ?? 0,
}))

jest.mock('expo-router', () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
}))

const setResponsive = (width: number, isHydrated: boolean) => {
  ;(global as any).__mockResponsive = {
    width,
    height: 900,
    isPhone: width < 480,
    isLargePhone: false,
    isTablet: false,
    isLargeTablet: false,
    isDesktop: width >= 1280,
    isMobile: width < 1280,
    isHydrated,
  }
}

const renderHeader = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <CustomHeader />
    </QueryClientProvider>,
  )

// Только host-узлы: `findAll` обходит и композитные элементы, поэтому один
// `<Text dataSet=…>` иначе считается дважды.
const findByDataSet = (utils: ReturnType<typeof renderHeader>, key: string, value: string) =>
  utils.UNSAFE_root.findAll(
    (node) => typeof node.type === 'string' && (node.props as any)?.dataSet?.[key] === value,
  )

describe('CustomHeader: до-гидрационная геометрия строки на web', () => {
  const originalPlatformOS = Platform.OS

  beforeEach(() => {
    jest.clearAllMocks()
    mockContextBarShouldSuspend = false
    ;(useRouter as jest.Mock).mockReturnValue({ push: jest.fn() })
    ;(usePathname as jest.Mock).mockReturnValue('/')
    Object.defineProperty(Platform, 'OS', { value: 'web' })
  })

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalPlatformOS })
    ;(global as any).__mockResponsive = undefined
  })

  it('на узком экране до гидратации всё равно рисует desktop-бокс строки', () => {
    setResponsive(0, false)
    const utils = renderHeader()

    // Словесная часть логотипа — тот самый узел, который расширял бокс 44 -> 115.
    expect(findByDataSet(utils, 'headerLogoWordmark', 'true')).toHaveLength(1)
    // Бокс навигации (flex:1) держит ширину строки, но ленивый чанк не грузит.
    expect(findByDataSet(utils, 'headerSlot', 'nav')).toHaveLength(1)
    // Слот аккаунта резервируется, иначе его монтирование уводит переключатель.
    expect(findByDataSet(utils, 'headerSlot', 'account')).toHaveLength(1)
    // Переключатель до гидратации полный: шеврон на месте, бокс desktop-ширины.
    expect(findByDataSet(utils, 'headerLangChevron', 'true')).toHaveLength(1)
    expect(findByDataSet(utils, 'headerInner', 'true')).toHaveLength(1)
  })

  it('после гидратации на узком экране отдаёт мобильную строку', () => {
    setResponsive(390, true)
    const utils = renderHeader()

    expect(findByDataSet(utils, 'headerLogoWordmark', 'true')).toHaveLength(0)
    expect(findByDataSet(utils, 'headerSlot', 'nav')).toHaveLength(0)
    expect(findByDataSet(utils, 'headerLangChevron', 'true')).toHaveLength(0)
    // Реальная секция аккаунта уже смонтирована — плейсхолдера больше нет.
    expect(findByDataSet(utils, 'headerSlot', 'account')).toHaveLength(0)
  })

  it('после гидратации на desktop оставляет полную строку с навигацией', () => {
    setResponsive(1440, true)
    const utils = renderHeader()

    expect(findByDataSet(utils, 'headerLogoWordmark', 'true')).toHaveLength(1)
    expect(findByDataSet(utils, 'headerSlot', 'nav')).toHaveLength(0)
    expect(utils.getByLabelText('Карта')).toBeTruthy()
    expect(findByDataSet(utils, 'headerLangChevron', 'true')).toHaveLength(1)
  })

  it('маркирует travel context fallback без конкурирующей inline-высоты', () => {
    ;(usePathname as jest.Mock).mockReturnValue('/travels/e2e-stable-travel-details')
    setResponsive(0, false)

    const utils = renderHeader()
    const fallbacks = findByDataSet(utils, 'headerContextFallback', 'travel')

    expect(fallbacks).toHaveLength(1)
    expect(StyleSheet.flatten(fallbacks[0].props.style)).toMatchObject({ width: '100%' })
    expect(StyleSheet.flatten(fallbacks[0].props.style)?.minHeight).toBeUndefined()
  })

  it('сохраняет тот же travel marker на Suspense fallback после гидратации', () => {
    ;(usePathname as jest.Mock).mockReturnValue('/travels/e2e-stable-travel-details')
    mockContextBarShouldSuspend = true
    setResponsive(390, true)

    const utils = renderHeader()
    const fallbacks = findByDataSet(utils, 'headerContextFallback', 'travel')

    expect(fallbacks).toHaveLength(1)
    expect(StyleSheet.flatten(fallbacks[0].props.style)?.minHeight).toBeUndefined()
    expect(utils.queryByTestId('mock-header-context-bar')).toBeNull()
  })

  it.each(['/settings', '/quests/minsk/e2e-quest'])(
    'передаёт обычную web context-заглушку critical CSS для %s без inline-высоты',
    (pathname) => {
      ;(usePathname as jest.Mock).mockReturnValue(pathname)
      setResponsive(0, false)

      const utils = renderHeader()
      const fallbacks = findByDataSet(utils, 'headerContextFallback', 'default')

      expect(fallbacks).toHaveLength(1)
      expect(StyleSheet.flatten(fallbacks[0].props.style)).toMatchObject({ width: '100%' })
      expect(StyleSheet.flatten(fallbacks[0].props.style)?.minHeight).toBeUndefined()
    },
  )

  it.each(['/', '/settings', '/quests/minsk/e2e-quest'])(
    'не ставит travel marker на контрольном маршруте %s',
    (pathname) => {
      ;(usePathname as jest.Mock).mockReturnValue(pathname)
      setResponsive(0, false)

      const utils = renderHeader()

      expect(findByDataSet(utils, 'headerContextFallback', 'travel')).toHaveLength(0)
    },
  )
})
