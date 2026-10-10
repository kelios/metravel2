import {
  SEASONAL_THEMES,
  getSeasonalThemeByCalendar,
  isMonthDayInWindow,
  isSeasonalThemePreference,
  resolveSeasonalTheme,
} from '@/constants/seasonalThemes'

const at = (month: number, day: number) => new Date(2026, month - 1, day, 12)

describe('seasonalThemes registry (#2376)', () => {
  it('keeps ids unique and windows non-overlapping', () => {
    const ids = SEASONAL_THEMES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (let m = 1; m <= 12; m += 1) {
      for (let d = 1; d <= 28; d += 1) {
        const matches = SEASONAL_THEMES.filter((t) => isMonthDayInWindow({ month: m, day: d }, t.window))
        expect(matches.length).toBeLessThanOrEqual(1)
      }
    }
  })

  it('wraps a window across the new year inclusively', () => {
    const window = { from: { month: 12, day: 1 }, to: { month: 1, day: 14 } }
    expect(isMonthDayInWindow({ month: 12, day: 1 }, window)).toBe(true)
    expect(isMonthDayInWindow({ month: 12, day: 31 }, window)).toBe(true)
    expect(isMonthDayInWindow({ month: 1, day: 14 }, window)).toBe(true)
    expect(isMonthDayInWindow({ month: 1, day: 15 }, window)).toBe(false)
    expect(isMonthDayInWindow({ month: 11, day: 30 }, window)).toBe(false)
  })

  it('resolves the calendar: halloween 15.10–01.11, christmas 01.12–14.01, otherwise none', () => {
    expect(getSeasonalThemeByCalendar(at(10, 10))).toBeNull()
    expect(getSeasonalThemeByCalendar(at(10, 15))).toBe('halloween')
    expect(getSeasonalThemeByCalendar(at(11, 1))).toBe('halloween')
    expect(getSeasonalThemeByCalendar(at(11, 2))).toBeNull()
    expect(getSeasonalThemeByCalendar(at(12, 24))).toBe('christmas')
    expect(getSeasonalThemeByCalendar(at(1, 7))).toBe('christmas')
    expect(getSeasonalThemeByCalendar(at(7, 1))).toBeNull()
  })

  it('honours the preference over the calendar', () => {
    expect(resolveSeasonalTheme('off', at(12, 25))).toBeNull()
    expect(resolveSeasonalTheme('auto', at(12, 25))).toBe('christmas')
    expect(resolveSeasonalTheme('halloween', at(7, 1))).toBe('halloween')
    expect(resolveSeasonalTheme('christmas', at(10, 20))).toBe('christmas')
  })

  it('validates stored preferences', () => {
    expect(isSeasonalThemePreference('auto')).toBe(true)
    expect(isSeasonalThemePreference('off')).toBe(true)
    expect(isSeasonalThemePreference('christmas')).toBe(true)
    expect(isSeasonalThemePreference('easter')).toBe(false)
    expect(isSeasonalThemePreference(null)).toBe(false)
  })
})
