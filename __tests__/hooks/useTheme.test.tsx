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
    document.documentElement.style.colorScheme = ''
  })

  it('restores a persisted dark theme and synchronizes the document', async () => {
    localStorage.setItem('theme', 'dark')

    const { result } = renderHook(() => useTheme(), { wrapper })

    await waitFor(() => expect(result.current.theme).toBe('dark'))
    expect(result.current.isDark).toBe(true)
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
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
})
