import React from 'react'
import { render } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Модуль меню импортируется ДО смены языка — ровно как на native, где
// сохранённый язык восстанавливается из AsyncStorage после загрузки модулей.
// Подпись, прочитанная при загрузке модуля, осталась бы русской (#2156).
import AccountMenu from '@/components/layout/AccountMenu'
import { HEADER_NAV_ITEMS, SUPPLEMENTARY_NAV_ITEMS } from '@/constants/headerNavigation'
import { isNavRouteAvailable } from '@/constants/platformNavRoutes'
import { i18n, type SupportedLocale } from '@/i18n'

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    isSuperuser: false,
    username: '',
    logout: jest.fn(),
    userId: null,
    userAvatar: null,
    profileRefreshToken: 0,
  }),
}))

jest.mock('@/context/FavoritesContext', () => ({
  useFavorites: () => ({ favorites: [] }),
}))

jest.mock('@/hooks/useDeferredUnreadCount', () => ({
  useDeferredUnreadCount: () => ({ count: 0 }),
}))

jest.mock('@/i18n/LocaleProvider', () => ({
  ...jest.requireActual('@/i18n/LocaleProvider'),
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

// Все подписи «Навигации» на активном языке: список шапки + общий с листом «Ещё»
// список дополнительных пунктов (#2779).
const navigationTitles = () => [
  ...HEADER_NAV_ITEMS.filter((item) => isNavRouteAvailable(item.path)).map((item) => item.label),
  ...SUPPLEMENTARY_NAV_ITEMS.map((item) => item.label),
]

const renderMenu = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AccountMenu initialOpenKey={1} />
    </QueryClientProvider>,
  )

describe('AccountMenu: «Навигация» на языке приложения (#2156)', () => {
  let ruTitles: string[] = []

  beforeAll(async () => {
    await i18n.changeLanguage('ru')
    ruTitles = navigationTitles()
  })

  afterAll(async () => {
    await i18n.changeLanguage('ru')
  })

  it.each<SupportedLocale>(['en', 'pl', 'be', 'uk', 'ru'])(
    'после смены языка на %s все пункты «Навигации» переведены',
    async (locale) => {
      await i18n.changeLanguage(locale)
      const expected = navigationTitles()
      const { getByText, queryByText } = renderMenu()

      for (const title of expected) expect(getByText(title)).toBeTruthy()
      if (locale !== 'ru') {
        const russianOnly = ruTitles.filter((title) => !expected.includes(title))
        expect(russianOnly.length).toBeGreaterThan(0)
        for (const title of russianOnly) expect(queryByText(title)).toBeNull()
      }
    },
  )
})
