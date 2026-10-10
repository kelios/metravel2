import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { Platform } from 'react-native'

jest.unmock('@/hooks/useTheme')

const { ThemeProvider, useTheme } = jest.requireActual('@/hooks/useTheme') as typeof import('@/hooks/useTheme')

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
    localStorage.setItem('seasonal-theme', 'easter')

    const { result } = renderHook(() => useTheme(), { wrapper })

    await waitFor(() => expect(result.current.theme).toBe('auto'))
    expect(result.current.seasonalTheme).toBe('auto')
  })
})
