/**
 * @jest-environment jsdom
 */

// #1462: экран подтверждения почты обязан положить в стор id вошедшего, а не
// только флаг авторизации. Иначе `useAuth()` отдаёт `isAuthenticated: true` при
// `userId: null`, и ключ локального прогресса квеста (#1456) вырождается в общий
// `__u:pending` — на общем устройстве два свежеподтверждённых аккаунта делят
// одну запись.

import React from 'react'
import { render, waitFor } from '@testing-library/react-native'

const mockReplace = jest.fn()
const mockConfirmAccount = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => ({ hash: 'confirm-hash' }),
  useIsFocused: () => false,
}))

jest.mock('@/api/auth', () => ({
  confirmAccount: (...args: unknown[]) => mockConfirmAccount(...args),
}))

jest.mock('@/components/seo/LazyInstantSEO', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/utils/seo', () => ({
  buildCanonicalUrl: (p: string) => `https://metravel.by${p}`,
}))

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    background: '#fff',
    surface: '#fff',
    primary: '#f60',
    primaryDark: '#c50',
    dangerDark: '#c00',
    success: '#0a0',
    shadows: { medium: {} },
  }),
}))

// Фасад `useAuth` — тонкий проброс стора; берём реальный стор, чтобы тест
// проверял именно связку «экран → состояние», а не мок сеттера.
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => require('@/stores/authStore').useAuthStore.getState(),
}))

jest.mock('@/utils/storageBatch', () => ({
  getStorageBatch: jest.fn().mockResolvedValue({}),
  setStorageBatch: jest.fn().mockResolvedValue(undefined),
  removeStorageBatch: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/utils/secureStorage', () => ({
  setSecureItem: jest.fn().mockResolvedValue(undefined),
  getSecureItem: jest.fn().mockResolvedValue(null),
  removeSecureItems: jest.fn().mockResolvedValue(undefined),
}))

import AccountConfirmation from '@/app/(tabs)/accountconfirmation'
import { useAuthStore } from '@/stores/authStore'
import { INITIAL_AUTH_STATE } from '@/stores/authState'
import { buildQuestProgressStorageKey } from '@/utils/questProgressStorage'

beforeEach(() => {
  jest.clearAllMocks()
  useAuthStore.setState({ ...INITIAL_AUTH_STATE })
})

describe('accountconfirmation → auth state', () => {
  it('кладёт id и имя подтверждённого аккаунта в стор', async () => {
    mockConfirmAccount.mockResolvedValue({
      userToken: 'tok',
      userId: 77,
      userName: 'Ирина',
    })

    render(<AccountConfirmation />)

    await waitFor(() => expect(useAuthStore.getState().isAuthenticated).toBe(true))
    const state = useAuthStore.getState()
    expect(state.userId).toBe('77')
    expect(state.username).toBe('Ирина')
    expect(mockReplace).toHaveBeenCalledWith('/')
  })

  it('ключ прогресса квеста сразу после подтверждения содержит id, а не pending', async () => {
    mockConfirmAccount.mockResolvedValue({ userToken: 'tok', userId: 77, userName: '' })

    render(<AccountConfirmation />)

    await waitFor(() => expect(useAuthStore.getState().isAuthenticated).toBe(true))
    const { isAuthenticated, userId } = useAuthStore.getState()
    expect(buildQuestProgressStorageKey('minsk-cmok', { isAuthenticated, userId })).toBe(
      'minsk-cmok__u77',
    )
  })

  it('не объявляет сессию, если сервер не вернул id', async () => {
    mockConfirmAccount.mockResolvedValue({ userToken: 'tok', userName: 'Ирина' })

    render(<AccountConfirmation />)

    await waitFor(() => expect(mockConfirmAccount).toHaveBeenCalled())
    await waitFor(() => expect(useAuthStore.getState().authReady).toBe(false))
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
