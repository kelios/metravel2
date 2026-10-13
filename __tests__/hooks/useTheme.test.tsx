import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { AppState, Appearance, Platform, type AppStateStatus } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Match the real package's ESM default so native lazy require().default exercises storage.
// The shared setup fixture is CommonJS-only and otherwise takes the unavailable-storage path.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { multiGet: jest.fn(), setItem: jest.fn() },
}))

jest.unmock('@/hooks/useTheme')

const { ThemeProvider, useTheme, useThemedColors } = jest.requireActual('@/hooks/useTheme') as typeof import('@/hooks/useTheme')

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
)

const installMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: jest.fn().mockImplementation(() => ({
      matches,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })
}

describe('useTheme web contract', () => {
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
    localStorage.clear()
    installMatchMedia(false)
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('data-season')
    document.documentElement.style.colorScheme = ''
  })

  it('restores a persisted dark theme and synchronizes the document', async () => {
    localStorage.setItem('theme', 'dark')

    const { result } = renderHook(() => useTheme(), { wrapper })

    await waitFor(() => expect(result.current.theme).toBe('dark'))
    expect(result.current.isDark).toBe(true)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })

  it('persists explicit changes and toggles back to light', async () => {
    const { result } = renderHook(() => useTheme(), { wrapper })

    act(() => result.current.setTheme('dark'))
    await waitFor(() => expect(result.current.isDark).toBe(true))
    expect(localStorage.getItem('theme')).toBe('dark')

    act(() => result.current.toggleTheme())
    await waitFor(() => expect(result.current.theme).toBe('light'))
    expect(result.current.isDark).toBe(false)
    expect(localStorage.getItem('theme')).toBe('light')
  })

  it('follows the system color scheme in auto mode', async () => {
    installMatchMedia(true)

    const { result } = renderHook(() => useTheme(), { wrapper })

    await waitFor(() => expect(result.current.isDark).toBe(true))
    expect(result.current.theme).toBe('auto')
  })

  it('restores a persisted seasonal theme and marks the document with data-season', async () => {
    localStorage.setItem('seasonal-theme', 'christmas')

    const { result } = renderHook(() => useTheme(), { wrapper })

    await waitFor(() => expect(result.current.seasonalTheme).toBe('christmas'))
    expect(result.current.activeSeasonalTheme).toBe('christmas')
    expect(document.documentElement.getAttribute('data-season')).toBe('christmas')
  })

  it('persists the seasonal preference and removes data-season when switched off', async () => {
    const { result } = renderHook(() => useTheme(), { wrapper })

    act(() => result.current.setSeasonalTheme('halloween'))
    await waitFor(() => expect(result.current.activeSeasonalTheme).toBe('halloween'))
    expect(localStorage.getItem('seasonal-theme')).toBe('halloween')
    expect(document.documentElement.getAttribute('data-season')).toBe('halloween')

    act(() => result.current.setSeasonalTheme('off'))
    await waitFor(() => expect(result.current.activeSeasonalTheme).toBeNull())
    expect(localStorage.getItem('seasonal-theme')).toBe('off')
    expect(document.documentElement.hasAttribute('data-season')).toBe(false)
  })

  it('keeps the boot-script data-season until the stored preference is read (no hydration flash)', async () => {
    // Стартовый скрипт уже поставил сохранённую тему; SSR-дефолт `auto` не должен
    // её снять или подменить календарной до чтения хранилища.
    const { getSeasonalThemeByCalendar } = jest.requireActual('@/constants/seasonalThemes') as typeof import('@/constants/seasonalThemes')
    const stored = getSeasonalThemeByCalendar() === 'halloween' ? 'christmas' : 'halloween'
    localStorage.setItem('seasonal-theme', stored)
    document.documentElement.setAttribute('data-season', stored)

    const oldValues: Array<string | null> = []
    const observer = new MutationObserver((records) => records.forEach((r) => oldValues.push(r.oldValue)))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-season'], attributeOldValue: true })

    const { result } = renderHook(() => useTheme(), { wrapper })
    await waitFor(() => expect(result.current.seasonalTheme).toBe(stored))
    observer.takeRecords().forEach((r) => oldValues.push(r.oldValue))
    observer.disconnect()

    expect(oldValues.every((value) => value === stored)).toBe(true)
    expect(document.documentElement.getAttribute('data-season')).toBe(stored)
  })

  it('keeps the boot-script data-theme="dark" until the stored theme is read (no hydration flash, #2381)', async () => {
    localStorage.setItem('theme', 'dark')
    document.documentElement.setAttribute('data-theme', 'dark')

    const oldValues: Array<string | null> = []
    const observer = new MutationObserver((records) => records.forEach((r) => oldValues.push(r.oldValue)))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'], attributeOldValue: true })

    const { result } = renderHook(() => useTheme(), { wrapper })
    await waitFor(() => expect(result.current.isDark).toBe(true))
    observer.takeRecords().forEach((r) => oldValues.push(r.oldValue))
    observer.disconnect()

    expect(oldValues.every((value) => value === 'dark')).toBe(true)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('writes data-theme from the system scheme on the first sync in auto mode (dark system, no stored theme)', async () => {
    installMatchMedia(true)
    document.documentElement.setAttribute('data-theme', 'dark')

    const oldValues: Array<string | null> = []
    const observer = new MutationObserver((records) => records.forEach((r) => oldValues.push(r.oldValue)))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'], attributeOldValue: true })

    const { result } = renderHook(() => useTheme(), { wrapper })
    await waitFor(() => expect(result.current.isDark).toBe(true))
    observer.takeRecords().forEach((r) => oldValues.push(r.oldValue))
    observer.disconnect()

    expect(oldValues.every((value) => value === 'dark')).toBe(true)
  })

  it('ignores an unknown persisted seasonal value and stays on auto', async () => {
    localStorage.setItem('seasonal-theme', 'unknown-theme')

    const { result } = renderHook(() => useTheme(), { wrapper })

    await waitFor(() => expect(result.current.theme).toBe('auto'))
    expect(result.current.seasonalTheme).toBe('auto')
  })
})

describe('seasonal calendar lifecycle', () => {
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
    localStorage.clear()
    installMatchMedia(false)
    document.documentElement.removeAttribute('data-season')
    jest.useFakeTimers()
    jest.setSystemTime(new Date(2026, 9, 14, 23, 59, 59))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it.each([
    [new Date(2026, 9, 14, 23, 59, 59), 'autumn', 'halloween'],
    [new Date(2026, 10, 1, 23, 59, 59), 'halloween', null],
    [new Date(2026, 0, 14, 23, 59, 59), 'christmas', null],
    [new Date(2026, 1, 28, 23, 59, 59), null, 'spring'],
  ])('switches at visible midnight on %s', (date, before, after) => {
    jest.setSystemTime(date)
    const { result, unmount } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.activeSeasonalTheme).toBe(before)
    act(() => jest.advanceTimersByTime(1000))
    expect(result.current.activeSeasonalTheme).toBe(after)
    expect(document.documentElement.getAttribute('data-season')).toBe(after)
    unmount()
    expect(jest.getTimerCount()).toBe(0)
  })

  it.each(['focus', 'pageshow', 'visibilitychange'])('catches up on %s without reload', event => {
    const { result, unmount } = renderHook(() => useTheme(), { wrapper })
    jest.setSystemTime(new Date(2026, 11, 25, 12))
    act(() => {
      if (event === 'visibilitychange') {
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
        document.dispatchEvent(new Event(event))
      } else window.dispatchEvent(new Event(event))
    })
    expect(result.current.activeSeasonalTheme).toBe('christmas')
    expect(result.current.seasonalCalendar?.currentPeriod?.id).toBe('christmas')
    expect(jest.getTimerCount()).toBe(1)
    unmount()
    expect(jest.getTimerCount()).toBe(0)
  })

  it.each(['halloween', 'off'] as const)('preserves explicit %s and dark mode over midnight', preference => {
    localStorage.setItem('seasonal-theme', preference)
    localStorage.setItem('theme', 'dark')
    jest.setSystemTime(new Date(2026, 11, 1, 23, 59, 59))
    const { result, unmount } = renderHook(() => useTheme(), { wrapper })
    act(() => jest.advanceTimersByTime(1000))
    expect(result.current.seasonalTheme).toBe(preference)
    expect(result.current.activeSeasonalTheme).toBe(preference === 'off' ? null : preference)
    expect(result.current.isDark).toBe(true)
    expect(localStorage.getItem('seasonal-theme')).toBe(preference)
    unmount()
  })


})

describe.each(['android', 'ios'])('native theme contract: %s', os => {
  let onAppState: (state: AppStateStatus) => void
  let onAppearance: (event: { colorScheme: 'light' | 'dark' | null }) => void
  let removeAppState: jest.Mock
  let removeAppearance: jest.Mock
  const multiGet = jest.mocked(AsyncStorage.multiGet)
  const setItem = jest.mocked(AsyncStorage.setItem)

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: os })
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' })
    // React async act queues warning microtasks; keep those real so timer counts
    // measure owned calendar timeouts rather than React's await bookkeeping.
    jest.useFakeTimers({ doNotFake: ['queueMicrotask'] })
    jest.setSystemTime(new Date(2026, 9, 14, 23, 59, 59))
    multiGet.mockReset().mockResolvedValue([])
    setItem.mockReset().mockResolvedValue(undefined)
    removeAppState = jest.fn()
    removeAppearance = jest.fn()
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      onAppState = listener
      return { remove: removeAppState }
    })
    jest.spyOn(Appearance, 'addChangeListener').mockImplementation(listener => {
      onAppearance = listener
      return { remove: removeAppearance }
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
  })

  const renderNativeTheme = () => renderHook(() => ({ prefs: useTheme(), colors: useThemedColors() }), { wrapper })
  const finishRestore = () => act(async () => { await Promise.resolve() })

  it.each(['easter', 'off', 'auto'] as const)('restores %s independently from dark mode', async season => {
    multiGet.mockResolvedValue([['theme', 'dark'], ['seasonal-theme', season]])
    const { result } = renderNativeTheme()
    expect(result.current.prefs.themeReady).toBe(false)
    await finishRestore()
    expect(result.current.prefs.themeReady).toBe(true)
    expect(result.current.prefs.theme).toBe('dark')
    expect(result.current.prefs.isDark).toBe(true)
    expect(result.current.prefs.seasonalTheme).toBe(season)
    expect(result.current.prefs.activeSeasonalTheme).toBe(season === 'off' ? null : season === 'auto' ? 'autumn' : season)
    expect(multiGet).toHaveBeenCalledWith(['theme', 'seasonal-theme'])
  })

  it.each(['theme', 'seasonal-theme', 'both'])('does not overwrite an early selection (%s)', async changed => {
    let resolveRead!: (values: [string, string | null][]) => void
    multiGet.mockReturnValue(new Promise(resolve => { resolveRead = resolve }))
    const { result } = renderNativeTheme()
    act(() => {
      if (changed !== 'seasonal-theme') result.current.prefs.setTheme('light')
      if (changed !== 'theme') result.current.prefs.setSeasonalTheme('halloween')
    })
    await act(async () => resolveRead([['theme', 'dark'], ['seasonal-theme', 'easter']]))
    expect(result.current.prefs.theme).toBe(changed === 'seasonal-theme' ? 'dark' : 'light')
    expect(result.current.prefs.isDark).toBe(changed === 'seasonal-theme')
    expect(result.current.prefs.seasonalTheme).toBe(changed === 'theme' ? 'easter' : 'halloween')
    expect(result.current.prefs.themeReady).toBe(true)
  })

  it.each(['invalid', 'rejected'])('settles readiness with automatic defaults for %s storage', async failure => {
    if (failure === 'invalid') multiGet.mockResolvedValue([['theme', 'unknown'], ['seasonal-theme', 'unknown']])
    else multiGet.mockRejectedValue(new Error('unavailable storage'))
    const { result } = renderNativeTheme()
    await finishRestore()
    expect(result.current.prefs.themeReady).toBe(true)
    expect(result.current.prefs.theme).toBe('auto')
    expect(result.current.prefs.seasonalTheme).toBe('auto')
    expect(result.current.prefs.activeSeasonalTheme).toBe('autumn')
  })

  it('updates the palette on seasonal selection and scheme changes even when writes reject', async () => {
    setItem.mockRejectedValue(new Error('full storage'))
    const { result } = renderNativeTheme()
    await finishRestore()
    act(() => {
      result.current.prefs.setSeasonalTheme('christmas')
      result.current.prefs.setTheme('light')
    })
    expect(result.current.colors.primary).toBe('#609078')
    act(() => result.current.prefs.setTheme('dark'))
    expect(result.current.colors.primary).toBe('#86c4a3')
    expect(result.current.prefs.seasonalTheme).toBe('christmas')
    act(() => result.current.prefs.setTheme('auto'))
    act(() => onAppearance({ colorScheme: 'dark' }))
    expect(result.current.prefs.isDark).toBe(true)
    act(() => result.current.prefs.setSeasonalTheme('off'))
    expect(result.current.prefs.activeSeasonalTheme).toBeNull()
    expect(result.current.colors.primary).not.toBe('#86c4a3')
    expect(setItem).toHaveBeenCalledWith('seasonal-theme', 'christmas')
    expect(setItem).toHaveBeenCalledWith('seasonal-theme', 'off')
    await finishRestore() // rejected persistence is handled without changing the session.
  })

  it('refreshes once at civil midnight and cleans up subscriptions/timer', async () => {
    const { result, unmount } = renderNativeTheme()
    await finishRestore()
    expect(result.current.prefs.activeSeasonalTheme).toBe('autumn')
    act(() => jest.advanceTimersByTime(1000))
    expect(result.current.prefs.activeSeasonalTheme).toBe('halloween')
    expect(result.current.prefs.seasonalCalendar?.currentPeriod?.id).toBe('halloween')
    expect(jest.getTimerCount()).toBe(1)
    unmount()
    expect(removeAppState).toHaveBeenCalledTimes(1)
    expect(removeAppearance).toHaveBeenCalledTimes(1)
    expect(jest.getTimerCount()).toBe(0)
  })

  it.each(['auto', 'halloween', 'off'] as const)('suspends in background and recomputes on resume for %s', async preference => {
    const { result, unmount } = renderNativeTheme()
    await finishRestore()
    act(() => result.current.prefs.setSeasonalTheme(preference))
    act(() => onAppState('background'))
    expect(jest.getTimerCount()).toBe(0)
    jest.setSystemTime(new Date(2026, 11, 25, 12))
    act(() => onAppState('active'))
    expect(result.current.prefs.activeSeasonalTheme).toBe(preference === 'auto' ? 'christmas' : preference === 'off' ? null : preference)
    expect(result.current.prefs.seasonalCalendar?.currentPeriod?.id).toBe('christmas')
    expect(jest.getTimerCount()).toBe(1)
    unmount()
  })

  it('starts backgrounded without a timer and ignores a storage read after unmount', async () => {
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'background' })
    let resolveRead!: (values: [string, string | null][]) => void
    multiGet.mockReturnValue(new Promise(resolve => { resolveRead = resolve }))
    const { result, unmount } = renderNativeTheme()
    expect(jest.getTimerCount()).toBe(0)
    expect(result.current.prefs.themeReady).toBe(false)
    unmount()
    await act(async () => resolveRead([['theme', 'dark'], ['seasonal-theme', 'easter']]))
    expect(result.current.prefs.themeReady).toBe(false)
    expect(removeAppState).toHaveBeenCalledTimes(1)
    expect(jest.getTimerCount()).toBe(0)
  })
})
