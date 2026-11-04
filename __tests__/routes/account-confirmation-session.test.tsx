/**
 * @jest-environment jsdom
 */

// #1462: экран подтверждения почты обязан положить в стор id вошедшего, а не
// только флаг авторизации. Иначе `useAuth()` отдаёт `isAuthenticated: true` при
// `userId: null`, и ключ локального прогресса квеста (#1456) вырождается в общий
// `__u:pending` — на общем устройстве два свежеподтверждённых аккаунта делят
// одну запись.

import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'

const mockReplace = jest.fn()
const mockConfirmAccount = jest.fn()
const mockQueueAnalyticsEvent = jest.fn()
let mockRouteHash = 'confirm-hash'
let mockIsFocused = true

jest.mock('@/utils/analytics', () => ({
  queueAnalyticsEvent: (...args: unknown[]) => mockQueueAnalyticsEvent(...args),
}))

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => ({ hash: mockRouteHash }),
  useIsFocused: () => mockIsFocused,
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
    text: '#111',
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

jest.mock('@/utils/secureStorage', () => {
  const getSecureItem = jest.fn().mockResolvedValue(null)
  return {
    setSecureItem: jest.fn().mockResolvedValue(undefined),
    getSecureItem,
    removeSecureItems: jest.fn().mockResolvedValue(undefined),
    readSecureItem: jest.fn(async (...args: unknown[]) => {
      try {
        return { value: await getSecureItem(...args), unavailable: false }
      } catch {
        return { value: null, unavailable: true }
      }
    }),
  }
})

import AccountConfirmation from '@/app/(tabs)/accountconfirmation'
import { useAuthStore } from '@/stores/authStore'
import { INITIAL_AUTH_STATE } from '@/stores/authState'
import { buildQuestProgressStorageKey } from '@/utils/questProgressStorage'
import { translate } from '@/i18n'

beforeEach(() => {
  jest.clearAllMocks()
  mockRouteHash = 'confirm-hash'
  mockIsFocused = true
  useAuthStore.setState({ ...INITIAL_AUTH_STATE })
})

async function renderAndApproveConfirmation() {
  const screen = await render(<AccountConfirmation />)
  await fireEvent.press(await screen.findByText(translate('authStatic:accountConfirmation.confirmAndSignIn')))
}

describe('accountconfirmation → auth state', () => {
  it.each([false, true])('does not activate or replace an existing session on link navigation (signed in: %s)', async (isAuthenticated) => {
    if (isAuthenticated) {
      useAuthStore.setState({ isAuthenticated: true, authReady: true, userId: '42' })
    }
    mockConfirmAccount.mockResolvedValue({ userToken: 'tok', userId: 77 })

    const screen = await render(<AccountConfirmation />)
    expect(await screen.findByText(translate('authStatic:accountConfirmation.signInNotice'))).toBeTruthy()
    expect(mockConfirmAccount).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
    expect(useAuthStore.getState().isAuthenticated).toBe(isAuthenticated)
    if (isAuthenticated) expect(useAuthStore.getState().userId).toBe('42')
  })

  it('кладёт id и имя подтверждённого аккаунта в стор', async () => {
    mockConfirmAccount.mockResolvedValue({
      userToken: 'tok',
      userId: 77,
      userName: 'Ирина',
    })

    await renderAndApproveConfirmation()

    await waitFor(() => expect(useAuthStore.getState().isAuthenticated).toBe(true))
    const state = useAuthStore.getState()
    expect(state.userId).toBe('77')
    expect(state.username).toBe('Ирина')
    expect(mockReplace).toHaveBeenCalledWith('/')
  })

  it('finishes the approved session without activating a new link that arrives in flight', async () => {
    let finish!: (response: { userToken: string; userId: number }) => void
    mockConfirmAccount.mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
    const screen = await render(<AccountConfirmation />)
    const buttonText = translate('authStatic:accountConfirmation.confirmAndSignIn')

    await fireEvent.press(await screen.findByText(buttonText))
    expect(mockConfirmAccount).toHaveBeenCalledWith('confirm-hash')
    mockRouteHash = 'other-hash'
    await screen.rerender(<AccountConfirmation />)
    expect(screen.queryByText(buttonText)).toBeNull()

    finish({ userToken: 'tok', userId: 77 })
    expect(await screen.findByText(buttonText)).toBeTruthy()
    expect(useAuthStore.getState().userId).toBe('77')
    expect(mockConfirmAccount).toHaveBeenCalledTimes(1)
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('does not navigate away from the current screen when confirmation finishes after blur', async () => {
    let finish!: (response: { userToken: string; userId: number }) => void
    mockConfirmAccount.mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
    const screen = await render(<AccountConfirmation />)

    await fireEvent.press(await screen.findByText(translate('authStatic:accountConfirmation.confirmAndSignIn')))
    mockIsFocused = false
    await screen.rerender(<AccountConfirmation />)
    finish({ userToken: 'tok', userId: 77 })

    await waitFor(() => expect(useAuthStore.getState().userId).toBe('77'))
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('ключ прогресса квеста сразу после подтверждения содержит id, а не pending', async () => {
    mockConfirmAccount.mockResolvedValue({ userToken: 'tok', userId: 77, userName: '' })

    await renderAndApproveConfirmation()

    await waitFor(() => expect(useAuthStore.getState().isAuthenticated).toBe(true))
    const { isAuthenticated, userId } = useAuthStore.getState()
    expect(buildQuestProgressStorageKey('minsk-cmok', { isAuthenticated, userId })).toBe(
      'minsk-cmok__u77',
    )
  })

  // #2739: письмо открылось в другом браузере, сервер перенёс гостевые ответы
  // квеста в аккаунт — игрок возвращается на маршрут, а не на главную.
  it('с перенесённым гостевым прогрессом ведёт в квест и пишет источник переноса', async () => {
    mockConfirmAccount.mockResolvedValue({
      userToken: 'tok',
      userId: 307,
      userName: '',
      quest_handoff: { quest_id: 'grodno-royal', redirect_path: '/quests/grodno/grodno-royal', answered: 2 },
    })

    await renderAndApproveConfirmation()

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/quests/grodno/grodno-royal'))
    expect(mockQueueAnalyticsEvent).toHaveBeenCalledWith('quest_guest_progress_migrated', {
      quest_id: 'grodno-royal',
      answered: 2,
      source: 'server_handoff',
    })
  })

  it('путь переноса вне /quests/<city>/<quest> не уводит со своего маршрута', async () => {
    mockConfirmAccount.mockResolvedValue({
      userToken: 'tok',
      userId: 307,
      userName: '',
      quest_handoff: { quest_id: 'x', redirect_path: '//evil.example/quests/a/b', answered: 2 },
    })

    await renderAndApproveConfirmation()

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'))
    expect(mockQueueAnalyticsEvent).not.toHaveBeenCalled()
  })

  it('не объявляет сессию, если сервер не вернул id', async () => {
    mockConfirmAccount.mockResolvedValue({ userToken: 'tok', userName: 'Ирина' })

    await renderAndApproveConfirmation()

    await waitFor(() => expect(mockConfirmAccount).toHaveBeenCalledTimes(1))
    expect(mockConfirmAccount).toHaveBeenCalledWith('confirm-hash')
    await waitFor(() => expect(useAuthStore.getState().authReady).toBe(false))
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
