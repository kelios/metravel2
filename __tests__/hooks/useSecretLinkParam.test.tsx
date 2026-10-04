/**
 * @jest-environment jsdom
 */

// #2145: секрет из ссылки письма на web уходит из адресной строки (replace через
// setParams) и живёт в sessionStorage вкладки — для «Назад», «Повторить» и F5.

import { renderHook } from '@testing-library/react-native'
import { Platform } from 'react-native'
import { useSecretLinkParam } from '@/hooks/useSecretLinkParam'

const mockSetParams = jest.fn()
// Как в expo-router: useRouter отдаёт один и тот же императивный router.
const mockRouter = { setParams: mockSetParams }
let mockParams: Record<string, string | string[] | undefined> = {}

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}))

const KEY = 'metravel:secret-link:/subscribe/confirm:token'

describe('useSecretLinkParam', () => {
  const originalOS = Platform.OS

  beforeEach(() => {
    Platform.OS = 'web'
    mockParams = {}
    mockSetParams.mockClear()
    window.sessionStorage.clear()
  })

  afterEach(() => {
    Platform.OS = originalOS
  })

  it('takes the secret from the query, stores it and removes it from the URL', () => {
    mockParams = { token: [' abc123 ', 'other'], utm_source: 'mail' }
    const { result, rerender } = renderHook(() => useSecretLinkParam('/subscribe/confirm', 'token'))

    expect(result.current).toBe('abc123')
    expect(mockSetParams).toHaveBeenCalledTimes(1)
    expect(mockSetParams).toHaveBeenCalledWith({ token: undefined })
    expect(window.sessionStorage.getItem(KEY)).toBe('abc123')

    // Роутер снял параметр — экран продолжает видеть тот же секрет.
    mockParams = { utm_source: 'mail' }
    rerender({})
    expect(result.current).toBe('abc123')
    expect(mockSetParams).toHaveBeenCalledTimes(1)
  })

  it('restores the secret from the tab session after reload or remount without the query', () => {
    window.sessionStorage.setItem(KEY, 'stored-token')
    const { result } = renderHook(() => useSecretLinkParam('/subscribe/confirm', 'token'))

    expect(result.current).toBe('stored-token')
    expect(mockSetParams).not.toHaveBeenCalled()
  })

  it('a fresh link wins over the stored secret; routes do not share storage', () => {
    window.sessionStorage.setItem(KEY, 'old-token')
    mockParams = { token: 'new-token' }
    const { result } = renderHook(() => useSecretLinkParam('/subscribe/confirm', 'token'))

    expect(result.current).toBe('new-token')
    expect(window.sessionStorage.getItem(KEY)).toBe('new-token')

    mockParams = {}
    const other = renderHook(() => useSecretLinkParam('/subscribe/unsubscribe', 'token'))
    expect(other.result.current).toBe('')
  })

  it('native: reads the query as is, no address bar to clean and no storage', () => {
    Platform.OS = 'ios'
    mockParams = { hash: 'native-hash' }
    const { result } = renderHook(() => useSecretLinkParam('/accountconfirmation', 'hash'))

    expect(result.current).toBe('native-hash')
    expect(mockSetParams).not.toHaveBeenCalled()
    expect(window.sessionStorage.length).toBe(0)
  })
})
