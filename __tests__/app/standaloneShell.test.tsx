import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { fireEvent, render } from '@testing-library/react-native'
import { View } from 'react-native'

const mockRouter = { back: jest.fn(), canGoBack: jest.fn(), replace: jest.fn(), push: jest.fn() }
let mockAuth = { authReady: true, isAuthenticated: true }
const mockBlockedList = jest.fn(() => <View testID="protected-blocked-list" />)
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, get router() { return mockRouter }, useIsFocused: () => false, useLocalSearchParams: () => ({}), Stack: { Screen: () => null } }))
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }))
jest.mock('@/hooks/useAndroidBackHandler', () => ({ useAndroidBackHandler: jest.fn() }))
jest.mock('@/hooks/useTheme', () => ({ ThemeContext: require('react').createContext(null), useThemedColors: () => require('@/constants/designSystem').getThemedColors(false) }))
jest.mock('@/components/layout/StandaloneScreen', () => {
  const { View: MockView } = require('react-native')
  return ({ children }: { children: React.ReactNode }) => <MockView>{children}</MockView>
})
jest.mock('@/components/settings/SecurityJournalList', () => () => null)
jest.mock('@/components/settings/PrivacySettingsMatrix', () => () => null)
jest.mock('@/components/settings/BlockedUsersList', () => () => mockBlockedList())
jest.mock('@/components/seo/LazyInstantSEO', () => () => null)

import SecurityJournal from '@/app/security-journal'
import PrivacySettings from '@/app/privacy-settings'
import BlockedUsers from '@/app/blocked-users'
import Missing from '@/app/[...missing]'

beforeEach(() => {
  jest.clearAllMocks()
  mockAuth = { authReady: true, isAuthenticated: true }
})

it.each([
  ['security journal', SecurityJournal, '/profile'],
  ['privacy settings', PrivacySettings, '/profile'],
  ['blocked users', BlockedUsers, '/settings'],
  ['missing route', Missing, '/'],
] as const)('%s uses history when available and a safe fallback on direct entry', (_name, Screen, fallback) => {
  for (const hasHistory of [false, true]) {
    jest.clearAllMocks()
    mockRouter.canGoBack.mockReturnValue(hasHistory)
    const screen = render(<Screen />)
    fireEvent.press(screen.getByRole('button', { name: 'Назад' }))
    if (hasHistory) {
      expect(mockRouter.back).toHaveBeenCalledTimes(1)
      expect(mockRouter.replace).not.toHaveBeenCalled()
    } else {
      expect(mockRouter.back).not.toHaveBeenCalled()
      expect(mockRouter.replace).toHaveBeenCalledWith(fallback)
    }
    screen.unmount()
  }
})

it('never mounts a protected blocked-users query while auth loads or for a guest', () => {
  mockAuth = { authReady: false, isAuthenticated: false }
  const screen = render(<BlockedUsers />)
  expect(screen.getByTestId('blocked-users-auth-loading')).toBeTruthy()
  expect(mockBlockedList).not.toHaveBeenCalled()
  mockAuth = { authReady: true, isAuthenticated: false }
  screen.rerender(<BlockedUsers />)
  expect(mockBlockedList).not.toHaveBeenCalled()
  mockAuth = { authReady: true, isAuthenticated: true }
  screen.rerender(<BlockedUsers />)
  expect(screen.getByTestId('protected-blocked-list')).toBeTruthy()
})

it('guards the complete StandaloneScreen family against raw back actions', () => {
  const routes = fs.readdirSync(path.join(process.cwd(), 'app')).filter((file) => file.endsWith('.tsx'))
  const sources = routes.map((file) => [file, fs.readFileSync(path.join(process.cwd(), 'app', file), 'utf8')] as const).filter(([, source]) => source.includes('StandaloneScreen'))
  expect(sources.length).toBeGreaterThanOrEqual(5)
  for (const [file, source] of sources) {
    expect({ file, rawBack: /\brouter\.back\(/.test(source) }).toEqual({ file, rawBack: false })
  }
})
