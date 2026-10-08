import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { Linking, Platform } from 'react-native'
import { router } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// #2135 / App Review 5.1.2(i): в native-приложении нет cookie-UI. Сцена
// `no-cookie-ui` — широкий iPad в ландшафте (ширина ≥1280 pt), где шапка показывает
// меню аккаунта вместо мобильного меню.

const mockAuth = {
  isAuthenticated: false,
  isSuperuser: false,
  username: '',
  logout: jest.fn(),
  userId: null as string | null,
  userAvatar: null,
  profileRefreshToken: 0,
}

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => mockAuth,
}))

jest.mock('@/context/FavoritesContext', () => ({
  useFavorites: () => ({ favorites: [] }),
}))

jest.mock('@/hooks/useDeferredUnreadCount', () => ({
  useDeferredUnreadCount: () => ({ count: 0 }),
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

jest.mock('react-native-paper', () => {
  const { Text, View } = require('react-native')
  const Menu: any = ({ anchor, children }: any) => (
    <View>
      {anchor}
      <View testID="account-menu-items">{children}</View>
    </View>
  )
  Menu.Item = () => null
  const Paragraph = ({ children, ...props }: any) => <Text {...props}>{children}</Text>
  return { Menu, Paragraph }
})

import AccountMenu from '@/components/layout/AccountMenu'
import CustomHeaderMobileMenu from '@/components/layout/CustomHeaderMobileMenu'
import { AboutIntroCard } from '@/components/about/AboutIntroCard'
import { getIsHeaderMobile } from '@/components/layout/customHeaderModel'
import { isNavRouteAvailable, WEB_ONLY_NAV_ROUTES } from '@/constants/platformNavRoutes'

const COOKIE_ITEM = 'Настройки cookies'
const PRIVACY_ITEM = 'Политика конфиденциальности'
const BLOGGERS_ITEM = 'Travel-блогеры Беларуси'
const BLOGGERS_URL = 'https://metravel.by/travels/akkaunty-v-instagram-o-puteshestviyah-po-belarusi'

const originalPlatform = Platform.OS
const setPlatform = (os: typeof Platform.OS) => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os })
}

const renderWithClient = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {ui}
    </QueryClientProvider>,
  )

const renderMobileMenu = () =>
  render(
    <CustomHeaderMobileMenu
      visible
      onRequestClose={jest.fn()}
      onOverlayPress={jest.fn()}
      onNavPress={jest.fn()}
      onUserAction={jest.fn()}
      onLogout={jest.fn()}
      colors={{} as any}
      styles={{}}
      activePath="/"
      isAuthenticated={false}
      favoritesCount={0}
    />,
  )

const renderAboutCard = () =>
  render(
    <AboutIntroCard
      email="info@metravel.by"
      onSendMail={jest.fn()}
      onOpenUrl={jest.fn()}
      onOpenPrivacy={jest.fn()}
      onOpenCookies={jest.fn()}
      socialLinks={{ facebook: 'f', instagram: 'i', tiktok: 't', youtube: 'y' }}
    />,
  )

describe('native app has no cookie UI (#2135)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.isAuthenticated = false
    mockAuth.username = ''
    mockAuth.userId = null
  })

  afterEach(() => {
    setPlatform(originalPlatform)
    jest.restoreAllMocks()
  })

  describe('route policy', () => {
    it.each(['ios', 'android'] as const)('%s hides web-only routes in any spelling', (os) => {
      for (const route of ['/cookies', '/cookies/', '/cookies?from=menu', { pathname: '/cookies' }]) {
        expect(isNavRouteAvailable(route, os)).toBe(false)
      }
      expect(isNavRouteAvailable('/privacy', os)).toBe(true)
      expect(isNavRouteAvailable('/terms', os)).toBe(true)
    })

    it('web keeps every route', () => {
      for (const route of WEB_ONLY_NAV_ROUTES) {
        expect(isNavRouteAvailable(route, 'web')).toBe(true)
      }
    })
  })

  describe('account menu on iPad landscape', () => {
    it('uses the shared compact header boundary on native', () => {
      setPlatform('ios')
      expect(getIsHeaderMobile(1024, 1024)).toBe(true)
      expect(getIsHeaderMobile(1180, 1180)).toBe(true)
      expect(getIsHeaderMobile(1279, 1279)).toBe(true)
      expect(getIsHeaderMobile(1280, 1280)).toBe(false)
    })

    it('guest menu lists the privacy policy but no cookie settings', () => {
      setPlatform('ios')
      const { getByText, queryByText } = renderWithClient(<AccountMenu initialOpenKey={1} />)

      expect(getByText(PRIVACY_ITEM)).toBeTruthy()
      expect(queryByText(COOKIE_ITEM)).toBeNull()
    })

    it('authenticated documents section has no cookie settings', () => {
      setPlatform('ios')
      mockAuth.isAuthenticated = true
      mockAuth.username = 'reviewer'
      mockAuth.userId = '1'
      const { getByText, queryByText } = renderWithClient(<AccountMenu initialOpenKey={1} />)

      fireEvent.press(getByText('Документы'))

      expect(getByText(PRIVACY_ITEM)).toBeTruthy()
      expect(queryByText(COOKIE_ITEM)).toBeNull()
    })

    it('web keeps the cookie settings entry and opens it in the current tab', () => {
      setPlatform('web')
      const { getByText } = renderWithClient(<AccountMenu initialOpenKey={1} />)

      fireEvent.press(getByText(COOKIE_ITEM))

      expect(router.push).toHaveBeenCalledWith('/cookies')
    })

    it('opens the metravel.by bloggers article inside the app, not in Safari', () => {
      setPlatform('ios')
      const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue()
      const { getByText } = renderWithClient(<AccountMenu initialOpenKey={1} />)

      fireEvent.press(getByText(BLOGGERS_ITEM))

      expect(router.push).toHaveBeenCalledWith('/travels/akkaunty-v-instagram-o-puteshestviyah-po-belarusi')
      expect(router.push).not.toHaveBeenCalledWith(BLOGGERS_URL)
      expect(openSpy).not.toHaveBeenCalled()
    })
  })

  describe('phone header menu', () => {
    it('native documents list has no cookie settings', () => {
      setPlatform('ios')
      const { getByText, queryByText } = renderMobileMenu()

      expect(getByText(PRIVACY_ITEM)).toBeTruthy()
      expect(queryByText(COOKIE_ITEM)).toBeNull()
    })

    it('web documents list keeps cookie settings', () => {
      setPlatform('web')
      const { getByText } = renderMobileMenu()

      expect(getByText(COOKIE_ITEM)).toBeTruthy()
    })
  })

  describe('about / contact intro card', () => {
    it('native shows the privacy link only', () => {
      setPlatform('android')
      const { getByLabelText, queryByLabelText } = renderAboutCard()

      expect(getByLabelText(PRIVACY_ITEM)).toBeTruthy()
      expect(queryByLabelText(COOKIE_ITEM)).toBeNull()
    })

    it('web keeps the cookie settings link', () => {
      setPlatform('web')
      const { getByLabelText } = renderAboutCard()

      expect(getByLabelText(COOKIE_ITEM)).toBeTruthy()
    })
  })
})
