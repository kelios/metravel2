import React, { type PropsWithChildren } from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { appStatsRange, type AppTelemetryStats, type AppTelemetryStatsQuery } from '@/api/appTelemetryStats'
import AppStatsScreen from '@/components/admin/appStats/AppStatsScreen'
import { useAuthStore } from '@/stores/authStore'

const mockFetchStats = jest.fn()
const mockReplace = jest.fn()

jest.mock('@/api/appTelemetryStats', () => {
  const actual = jest.requireActual<typeof import('@/api/appTelemetryStats')>('@/api/appTelemetryStats')
  return {
    ...actual,
    fetchAppTelemetryStats: (query: AppTelemetryStatsQuery) => mockFetchStats(query),
  }
})

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  useIsFocused: () => true,
}))

jest.mock('@/components/seo/LazyInstantSEO', () => () => null)

const stats: AppTelemetryStats = {
  days: [{ date: '2026-10-27', new_installs: 2, active_installs: 5, sessions: 8 }],
  retention: {
    d1: { cohort_size: 10, retained: 4, rate: 40 },
    d7: { cohort_size: 8, retained: 2, rate: 25 },
    d30: { cohort_size: 0, retained: 0, rate: 0 },
  },
  crash_free: [{
    app_version: '1.2.3',
    platform: 'ios',
    sessions: 8,
    crashed_sessions: 1,
    crash_free_percent: 87.5,
  }],
  top_crashes: [{
    signature: 'abc',
    count: 3,
    installs_affected: 2,
    first_seen: '2026-10-20T10:00:00Z',
    last_seen: '2026-10-27T12:00:00Z',
    app_versions: ['1.2.3'],
    message: 'Boom in map',
    stack: 'at renderMap (MapScreen.tsx:10:5)',
  }],
  funnel: [
    { name: 'app_first_open', count: 2 },
    { name: 'app_open', count: 0 },
  ],
}

const emptyStats: AppTelemetryStats = {
  ...stats,
  days: [],
  crash_free: [],
  top_crashes: [],
  funnel: [{ name: 'app_open', count: 0 }],
}

const authSnapshot = {
  authReady: useAuthStore.getState().authReady,
  isSuperuser: useAuthStore.getState().isSuperuser,
  isAuthenticated: useAuthStore.getState().isAuthenticated,
  userId: useAuthStore.getState().userId,
}

const wrapperFor = (client: QueryClient) =>
  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }

const renderScreen = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return await render(<AppStatsScreen />, { wrapper: wrapperFor(client) })
}

describe('экран статистики приложения (#2843)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchStats.mockResolvedValue(stats)
    useAuthStore.setState({ authReady: true, isSuperuser: true, isAuthenticated: true, userId: '1' })
  })

  afterEach(() => {
    useAuthStore.setState(authSnapshot)
  })

  it('гость и обычный пользователь не вызывают API и уходят на главную', async () => {
    useAuthStore.setState({ authReady: true, isSuperuser: false, isAuthenticated: false, userId: null })
    const guest = await renderScreen()
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'))
    expect(mockFetchStats).not.toHaveBeenCalled()
    await guest.unmount()

    mockReplace.mockClear()
    useAuthStore.setState({ authReady: true, isSuperuser: false, isAuthenticated: true, userId: '7' })
    const regular = await renderScreen()
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'))
    expect(mockFetchStats).not.toHaveBeenCalled()
    await regular.unmount()
  })

  it('до готовности сессии не ходит в API', async () => {
    useAuthStore.setState({ authReady: false, isSuperuser: false, isAuthenticated: false, userId: null })
    const view = await renderScreen()
    expect(view.getByTestId('app-stats-loading')).toBeTruthy()
    expect(mockFetchStats).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('суперпользователь видит пять блоков и раскрывает стек', async () => {
    const view = await renderScreen()
    expect(await view.findByTestId('app-stats-days')).toBeTruthy()
    expect(view.getByTestId('app-stats-retention')).toBeTruthy()
    expect(view.getByTestId('app-stats-crash-free')).toBeTruthy()
    expect(view.getByTestId('app-stats-crashes')).toBeTruthy()
    expect(view.getByTestId('app-stats-funnel')).toBeTruthy()
    expect(view.queryByText('app_open')).toBeNull()
    expect(view.getByText(/app_first_open/)).toBeTruthy()

    await fireEvent.press(view.getByTestId('app-stats-crash-0'))
    expect(view.getByTestId('app-stats-crash-stack-0')).toBeTruthy()
    expect(view.getByText('at renderMap (MapScreen.tsx:10:5)')).toBeTruthy()
  })

  it('смена периода, платформы и версии меняет запрос', async () => {
    const view = await renderScreen()
    await view.findByTestId('app-stats-days')
    const initial = appStatsRange(30)
    expect(mockFetchStats).toHaveBeenCalledWith(expect.objectContaining({
      ...initial,
      platform: '',
      appVersion: '',
    }))

    await fireEvent.press(view.getByTestId('app-stats-period-7'))
    await waitFor(() => expect(mockFetchStats).toHaveBeenCalledWith(expect.objectContaining({
      ...appStatsRange(7),
      platform: '',
      appVersion: '',
    })))

    await fireEvent.press(view.getByTestId('app-stats-platform-ios'))
    await waitFor(() => expect(mockFetchStats).toHaveBeenCalledWith(expect.objectContaining({
      platform: 'ios',
      appVersion: '',
    })))
    await view.findByTestId('app-stats-version-1.2.3')

    await fireEvent.press(view.getByTestId('app-stats-version-1.2.3'))
    await waitFor(() => expect(mockFetchStats).toHaveBeenCalledWith(expect.objectContaining({
      platform: 'ios',
      appVersion: '1.2.3',
    })))
  })

  it('пустой период показывает пустое состояние, ошибка — повтор', async () => {
    mockFetchStats.mockResolvedValue(emptyStats)
    const empty = await renderScreen()
    expect(await empty.findByTestId('app-stats-empty')).toBeTruthy()
    expect(empty.queryByTestId('app-stats-content')).toBeNull()
    await empty.unmount()

    mockFetchStats.mockRejectedValue(new Error('offline'))
    const failed = await renderScreen()
    expect(await failed.findByTestId('app-stats-error')).toBeTruthy()
    const callsBeforeRetry = mockFetchStats.mock.calls.length
    await fireEvent.press(failed.getByTestId('app-stats-retry'))
    await waitFor(() => expect(mockFetchStats.mock.calls.length).toBeGreaterThan(callsBeforeRetry))
  })
})
