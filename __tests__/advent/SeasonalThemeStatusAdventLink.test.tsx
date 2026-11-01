import React from 'react'
import { render } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { i18n } from '@/i18n'
import { useTheme } from '@/hooks/useTheme'
import { getSeasonalCalendar } from '@/constants/seasonalThemes'
import SeasonalThemeStatus from '@/components/layout/SeasonalThemeStatus'
import { fakeToday } from './fakeToday'

jest.mock('@/hooks/useTheme', () => ({
  useTheme: jest.fn(),
  useThemedColors: () => ({ textMuted: '#555555', primaryDark: '#0a5' }),
}))
jest.mock('expo-router', () => {
  const ReactLib = require('react')
  return {
    Link: ({ children }: { children: React.ReactElement }) => ReactLib.Children.only(children),
  }
})

const install = (date: Date, preference = 'auto') => {
  fakeToday(date)
  ;(useTheme as jest.Mock).mockReturnValue({ seasonalTheme: preference, seasonalCalendar: getSeasonalCalendar(date) })
}

describe('SeasonalThemeStatus advent link (#2866)', () => {
  beforeEach(async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
    await i18n.changeLanguage('ru')
  })
  afterEach(() => jest.useRealTimers())

  it('adds the door-of-the-day link next to the status inside the window', async () => {
    install(new Date(2026, 11, 10, 12))
    const screen = await render(<SeasonalThemeStatus showAdventLink />)
    expect(screen.getByTestId('seasonal-theme-status')).toBeTruthy()
    expect(screen.getByTestId('seasonal-theme-advent-link').props.children).toBe('Открыть дверцу дня')
  })

  it('keeps the link when the seasonal theme is switched off', async () => {
    install(new Date(2026, 11, 10, 12), 'off')
    const screen = await render(<SeasonalThemeStatus showAdventLink />)
    expect(screen.queryByTestId('seasonal-theme-status')).toBeNull()
    expect(screen.getByTestId('seasonal-theme-advent-link')).toBeTruthy()
  })

  it('renders no link in menus (prop off) even inside the window', async () => {
    install(new Date(2026, 11, 10, 12))
    const screen = await render(<SeasonalThemeStatus />)
    expect(screen.getByTestId('seasonal-theme-status')).toBeTruthy()
    expect(screen.queryByTestId('seasonal-theme-advent-link')).toBeNull()
  })

  it('shows no link outside the campaign and nothing at all when the theme is off', async () => {
    install(new Date(2026, 6, 1, 12))
    expect((await render(<SeasonalThemeStatus showAdventLink />)).queryByTestId('seasonal-theme-advent-link')).toBeNull()
    install(new Date(2026, 6, 1, 12), 'off')
    expect((await render(<SeasonalThemeStatus showAdventLink />)).toJSON()).toBeNull()
  })
})
