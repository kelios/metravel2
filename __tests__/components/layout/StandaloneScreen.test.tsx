import React from 'react'
import { Text } from 'react-native'
import { render, screen } from '@testing-library/react-native'

// Общий jest-мок `react-native-safe-area-context` отдаёт `SafeAreaView` как
// прозрачную обёртку и теряет `edges`. Здесь края — предмет проверки, поэтому мок
// локальный: `SafeAreaView` — View, который хранит полученные пропы.
jest.mock('react-native-safe-area-context', () => {
  const ReactActual = jest.requireActual('react')
  const { View } = jest.requireActual('react-native')
  const insets = { top: 0, right: 0, bottom: 0, left: 0 }
  return {
    __esModule: true,
    SafeAreaProvider: ({ children }: any) => children,
    SafeAreaView: ({ children, edges, style, testID }: any) =>
      ReactActual.createElement(View, { testID: testID ?? 'safe-area', style, edges }, children),
    SafeAreaInsetsContext: ReactActual.createContext(insets),
    useSafeAreaInsets: () => insets,
  }
})

jest.mock('@/context/AuthContext', () => ({ useAuth: jest.fn() }))
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useIsFocused: () => true,
  useLocalSearchParams: () => ({}),
  Stack: { Screen: () => null },
  router: { replace: jest.fn(), back: jest.fn() },
}))
jest.mock('@/hooks/useAndroidBackHandler', () => ({ useAndroidBackHandler: jest.fn() }))
jest.mock('@/components/seo/LazyInstantSEO', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/settings/SecurityJournalList', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/settings/BlockedUsersList', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/settings/PrivacySettingsMatrix', () => ({ __esModule: true, default: () => null }))

import StandaloneScreen from '@/components/layout/StandaloneScreen'
import SecurityJournalScreen from '@/app/security-journal'
import PrivacySettingsScreen from '@/app/privacy-settings'
import BlockedUsersScreen from '@/app/blocked-users'
import ErrorScreen from '@/app/error'

const { useAuth } = require('@/context/AuthContext') as { useAuth: jest.Mock }

const safeAreaEdges = () => screen.getAllByTestId('safe-area').map((node) => node.props.edges)

// #2272 / MOBILE-INSETS-001: экран вне оболочки шапки начинается ниже статус-бара.
describe('StandaloneScreen — верхний край экранов вне оболочки шапки', () => {
  it('всегда держит верхний край безопасной зоны', () => {
    render(
      <StandaloneScreen testID="standalone">
        <Text>тело</Text>
      </StandaloneScreen>,
    )
    expect(screen.getByTestId('standalone').props.edges).toEqual(['top', 'left', 'right', 'bottom'])
    expect(screen.getByText('тело')).toBeTruthy()
  })

  it.each([
    ['Журнал безопасности', SecurityJournalScreen],
    ['Приватность', PrivacySettingsScreen],
    ['Чёрный список', BlockedUsersScreen],
  ])('«%s»: гостевая и основная ветки лежат в контейнере с верхним краем', (_name, Screen) => {
    useAuth.mockReturnValue({ isAuthenticated: false, authReady: true, userId: null })
    const guest = render(<Screen />)
    expect(safeAreaEdges()).toEqual([['top', 'left', 'right', 'bottom']])
    guest.unmount()

    useAuth.mockReturnValue({ isAuthenticated: true, authReady: true, userId: '1' })
    render(<Screen />)
    expect(safeAreaEdges()).toEqual([['top', 'left', 'right', 'bottom']])
  })

  it('экран ошибки без шапки тоже лежит в контейнере', () => {
    render(<ErrorScreen error={new Error('boom')} retry={jest.fn()} />)
    expect(safeAreaEdges()).toEqual([['top', 'left', 'right', 'bottom']])
  })
})
