import { StrictMode } from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query'

import ProfileLanguageSyncRuntime, { commitProfileLanguage } from '@/components/profile/ProfileLanguageSyncRuntime'
import { queryKeys } from '@/api/queryKeys'
import { updateUserProfile, type UserProfileDto } from '@/api/user'
import { useLocale } from '@/i18n/LocaleProvider'
import {
  readPersistedLocalePreference,
  subscribeLocalePreference,
  type LocalePreference,
} from '@/i18n/localeStorage'
import { showProfileLanguageSyncError } from '@/i18n/languageSelectionFeedback'
import { useAuthStore } from '@/stores/authStore'

jest.mock('expo-localization', () => ({ getLocales: jest.fn(() => [{ languageTag: 'ru-RU', languageCode: 'ru' }]) }))
jest.mock('@/api/user', () => ({ updateUserProfile: jest.fn() }))
jest.mock('@/i18n/LocaleProvider', () => ({ useLocale: jest.fn() }))
jest.mock('@/i18n/languageSelectionFeedback', () => ({ showProfileLanguageSyncError: jest.fn() }))
jest.mock('@/i18n/localeStorage', () => ({
  ...jest.requireActual('@/i18n/localeStorage'),
  readPersistedLocalePreference: jest.fn(),
  subscribeLocalePreference: jest.fn(),
}))
jest.mock('@/stores/authStore', () => ({
  useAuthStore: require('zustand').create(() => ({ authReady: false, isAuthenticated: false, userId: null })),
}))

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((yes) => { resolve = yes })
  return { promise, resolve }
}
const explicit = (locale: 'ru' | 'pl' | 'en'): LocalePreference => ({ version: 1, mode: 'explicit', locale })
const profile = (language: 'ru' | 'pl' | 'en', first_name = 'Current'): UserProfileDto => ({
  id: 7, user: 42, first_name, last_name: '', youtube: '', instagram: '', twitter: '', vk: '',
  avatar: null, email_notify_comments: true, email_notify_messages: false, language,
})

describe('ProfileLanguageSyncRuntime', () => {
  let client: QueryClient
  let preferenceListener: (preference: LocalePreference) => void
  const hydration = (ready: boolean, locale = 'ru') => jest.mocked(useLocale).mockReturnValue({
    isHydrated: ready, locale,
  } as ReturnType<typeof useLocale>)
  const login = (userId = '42') => act(() => useAuthStore.setState({ authReady: true, isAuthenticated: true, userId }))
  const view = (strict = false) => render(
    <QueryClientProvider client={client}>
      {strict ? <StrictMode><ProfileLanguageSyncRuntime /></StrictMode> : <ProfileLanguageSyncRuntime />}
    </QueryClientProvider>,
  )

  beforeEach(() => {
    jest.clearAllMocks()
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
    useAuthStore.setState({ authReady: false, isAuthenticated: false, userId: null })
    hydration(true)
    jest.mocked(readPersistedLocalePreference).mockResolvedValue(null)
    jest.mocked(updateUserProfile).mockImplementation(async (_owner, payload) => profile(payload.language as 'pl'))
    jest.mocked(subscribeLocalePreference).mockImplementation((listener) => {
      preferenceListener = listener
      return () => {}
    })
  })
  afterEach(() => { client.clear() })

  it('keeps guest choices local and syncs the saved choice after login', async () => {
    view()
    act(() => preferenceListener(explicit('pl')))
    expect(updateUserProfile).not.toHaveBeenCalled()
    jest.mocked(readPersistedLocalePreference).mockResolvedValue(explicit('pl'))
    login()
    await waitFor(() => expect(updateUserProfile).toHaveBeenCalledWith('42', { language: 'pl' }))
  })

  it('waits for locale hydration when already authenticated', async () => {
    hydration(false)
    jest.mocked(readPersistedLocalePreference).mockResolvedValue(explicit('pl'))
    login()
    const mounted = view()
    expect(updateUserProfile).not.toHaveBeenCalled()
    hydration(true)
    mounted.rerender(<QueryClientProvider client={client}><ProfileLanguageSyncRuntime /></QueryClientProvider>)
    await waitFor(() => expect(updateUserProfile).toHaveBeenCalledWith('42', { language: 'pl' }))
  })

  it('does not infer a preference from RU startup, quest locale or catalog rerenders', async () => {
    login()
    const mounted = view()
    await act(async () => {})
    hydration(true, 'pl')
    mounted.rerender(<QueryClientProvider client={client}><ProfileLanguageSyncRuntime /></QueryClientProvider>)
    await act(async () => {})
    expect(readPersistedLocalePreference).toHaveBeenCalledTimes(1)
    expect(updateUserProfile).not.toHaveBeenCalled()
  })

  it('a deliberate choice supersedes a slow initial persisted-preference read', async () => {
    const read = deferred<LocalePreference | null>()
    jest.mocked(readPersistedLocalePreference).mockReturnValue(read.promise)
    login()
    view()
    act(() => preferenceListener(explicit('en')))
    await waitFor(() => expect(updateUserProfile).toHaveBeenCalledWith('42', { language: 'en' }))
    await act(async () => read.resolve(explicit('pl')))
    expect(updateUserProfile).toHaveBeenCalledTimes(1)
  })

  it('does not resave an existing preference when a quest temporarily changes the UI language', async () => {
    jest.mocked(readPersistedLocalePreference).mockResolvedValue(explicit('en'))
    login()
    const mounted = view()
    await waitFor(() => expect(updateUserProfile).toHaveBeenCalledWith('42', { language: 'en' }))
    hydration(true, 'pl')
    mounted.rerender(<QueryClientProvider client={client}><ProfileLanguageSyncRuntime /></QueryClientProvider>)
    await act(async () => {})
    expect(updateUserProfile).toHaveBeenCalledTimes(1)
    expect(readPersistedLocalePreference).toHaveBeenCalledTimes(1)
  })

  it('persists the supported effective device language for system mode', async () => {
    const localization = jest.requireMock('expo-localization') as { getLocales: jest.Mock }
    const previous = localization.getLocales.getMockImplementation()
    localization.getLocales.mockReturnValue([{ languageTag: 'en-US', languageCode: 'en' }])
    try {
      login()
      view()
      act(() => preferenceListener({ version: 1, mode: 'system' }))
      await waitFor(() => expect(updateUserProfile).toHaveBeenCalledWith('42', { language: 'en' }))
    } finally { localization.getLocales.mockImplementation(previous ?? (() => [])) }
  })

  it('observes batched same-owner logout/login and retains the outstanding request lock', async () => {
    const first = deferred<UserProfileDto>()
    jest.mocked(readPersistedLocalePreference).mockResolvedValue(explicit('pl'))
    jest.mocked(updateUserProfile).mockReturnValueOnce(first.promise)
    login()
    view()
    await waitFor(() => expect(updateUserProfile).toHaveBeenCalledTimes(1))
    jest.mocked(readPersistedLocalePreference).mockResolvedValue(explicit('en'))
    act(() => {
      useAuthStore.setState({ isAuthenticated: false, userId: null })
      useAuthStore.setState({ isAuthenticated: true, userId: '42' })
    })
    await act(async () => {})
    expect(updateUserProfile).toHaveBeenCalledTimes(1)
    await act(async () => first.resolve(profile('pl')))
    await waitFor(() => expect(updateUserProfile).toHaveBeenLastCalledWith('42', { language: 'en' }))
    expect(showProfileLanguageSyncError).not.toHaveBeenCalled()
  })

  it('does not send a request when logout wins the lazy API-module load', async () => {
    login()
    view()
    act(() => {
      preferenceListener(explicit('en'))
      useAuthStore.setState({ isAuthenticated: false, userId: null })
    })
    await act(async () => {})
    expect(updateUserProfile).not.toHaveBeenCalled()
  })

  it('does not duplicate a saved preference under StrictMode effect replay', async () => {
    jest.mocked(readPersistedLocalePreference).mockResolvedValue(explicit('pl'))
    login()
    view(true)
    await waitFor(() => expect(updateUserProfile).toHaveBeenCalledTimes(1))
    await act(async () => {})
    expect(updateUserProfile).toHaveBeenCalledTimes(1)
  })

  it('preserves local preference on a current API failure and shows the existing notification', async () => {
    login()
    view()
    jest.mocked(updateUserProfile).mockRejectedValueOnce(new Error('offline'))
    act(() => preferenceListener(explicit('pl')))
    await waitFor(() => expect(showProfileLanguageSyncError).toHaveBeenCalledTimes(1))
    await act(async () => {})
    expect(updateUserProfile).toHaveBeenCalledTimes(1)
    expect(readPersistedLocalePreference).toHaveBeenCalledTimes(1)
  })
})

describe('accepted profile language cache patch', () => {
  it('patches only language in existing string/numeric owner variants, preserving foreign/null/missing profiles', async () => {
    const client = new QueryClient()
    client.setQueryData(queryKeys.userProfile('42'), profile('ru', 'New name'))
    client.setQueryData(queryKeys.userProfile(42, 'public'), profile('ru'))
    client.setQueryData(queryKeys.userProfile('73'), profile('pl'))
    client.setQueryData(queryKeys.userProfile('42', 'empty'), null)
    await commitProfileLanguage(client, '42', 'en', () => true)
    expect(client.getQueryData(queryKeys.userProfile('42'))).toEqual(profile('en', 'New name'))
    expect(client.getQueryData(queryKeys.userProfile(42, 'public'))).toEqual(profile('en'))
    expect(client.getQueryData(queryKeys.userProfile('73'))).toEqual(profile('pl'))
    expect(client.getQueryData(queryKeys.userProfile('42', 'empty'))).toBeNull()
    await commitProfileLanguage(client, '99', 'en', () => true)
    expect(client.getQueryData(queryKeys.userProfile('99'))).toBeUndefined()
    client.clear()
  })

  it('cancels an older GET so it cannot restore the previous language', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const request = deferred<UserProfileDto>()
    const key = queryKeys.userProfile('42')
    client.setQueryData(key, profile('ru'))
    const fetch = client.fetchQuery({ queryKey: key, queryFn: () => request.promise }).catch(() => {})
    await commitProfileLanguage(client, '42', 'en', () => true)
    request.resolve(profile('ru', 'Old name'))
    await fetch
    expect(client.getQueryData(key)).toEqual(profile('en'))
    client.clear()
  })

  it.each([false, true])('restarts an active first profile GET after cancellation (superseded commit: %s)', async (superseded) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const request = deferred<UserProfileDto>()
    const key = queryKeys.userProfile('42')
    const queryFn = jest.fn()
      .mockReturnValueOnce(request.promise)
      .mockResolvedValueOnce(profile('en', 'Fresh full profile'))
    const observer = new QueryObserver(client, { queryKey: key, queryFn })
    const unsubscribe = observer.subscribe(() => {})
    try {
      expect(queryFn).toHaveBeenCalledTimes(1)
      expect(client.getQueryData(key)).toBeUndefined()
      let current = true
      const commit = commitProfileLanguage(client, '42', 'en', () => current)
      if (superseded) current = false
      await commit
      await waitFor(() => expect(client.getQueryData(key)).toEqual(profile('en', 'Fresh full profile')))
      expect(queryFn).toHaveBeenCalledTimes(2)

      request.resolve(profile('ru', 'Obsolete profile'))
      await act(async () => {})
      expect(client.getQueryData(key)).toEqual(profile('en', 'Fresh full profile'))
    } finally {
      unsubscribe()
      client.clear()
    }
  })

  it('rechecks session after cancellation yields before modifying cache', async () => {
    const client = new QueryClient()
    const cancellation = deferred<void>()
    jest.spyOn(client, 'cancelQueries').mockReturnValue(cancellation.promise)
    const key = queryKeys.userProfile('42')
    client.setQueryData(key, profile('ru'))
    let current = true
    const commit = commitProfileLanguage(client, '42', 'en', () => current)
    current = false
    cancellation.resolve()
    await commit
    expect(client.getQueryData(key)).toEqual(profile('ru'))
    client.clear()
  })
})
