import {
  SEASONAL_THEMES, SEASONAL_THEME_IDS, getSeasonalCalendar, getSeasonalThemeByCalendar,
  isMonthDayInWindow, isSeasonalThemePreference, resolveSeasonalTheme, validateSeasonalRegistry,
} from '@/constants/seasonalThemes'
import { seasonalCalendarCore, type SeasonalCalendarDefinition, type SeasonalCivilDate } from '@/utils/seasonalCalendarCore'

const at = (month: number, day: number, year = 2026) => new Date(year, month - 1, day, 12)
const civil = (date: Date): SeasonalCivilDate => ({ year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() })
const stamp = ({ year, month, day }: SeasonalCivilDate) => year * 10000 + month * 100 + day
const fixed = (id: string, priority: number, from: number, to: number): SeasonalCalendarDefinition => ({
  id, priority, rules: [{ kind: 'fixedAnnual', from: { month: 3, day: from }, to: { month: 3, day: to } }],
})

describe('seasonal calendar registry', () => {
  it('validates all annual dates across a full century including 2100', () => {
    expect(() => validateSeasonalRegistry()).not.toThrow()
    expect(SEASONAL_THEME_IDS).toEqual(['spring', 'easter', 'autumn', 'halloween', 'christmas'])
  })

  it.each([
    [2, 28, null], [3, 1, 'spring'], [3, 10, 'spring'], [3, 11, null],
    [9, 14, null], [9, 15, 'autumn'], [10, 14, 'autumn'],
    [10, 15, 'halloween'], [11, 1, 'halloween'], [11, 2, null],
    [11, 30, null], [12, 1, 'christmas'], [12, 31, 'christmas'],
    [1, 14, 'christmas'], [1, 15, null],
  ] as Array<[number, number, string | null]>)('resolves inclusive fixed boundary %s/%s', (month, day, expected) => {
    expect(getSeasonalThemeByCalendar(at(month, day))).toBe(expected)
  })

  it('keeps the month/day helper inclusive across New Year', () => {
    const window = { from: { month: 12, day: 1 }, to: { month: 1, day: 14 } }
    expect(isMonthDayInWindow({ month: 12, day: 31 }, window)).toBe(true)
    expect(isMonthDayInWindow({ month: 1, day: 14 }, window)).toBe(true)
    expect(isMonthDayInWindow({ month: 1, day: 15 }, window)).toBe(false)
  })

  it('visits every real day including 29–31/leap days with stable reordered selection', () => {
    let count = 0
    for (const year of [2000, 2008, 2024, 2025, 2026, 2099, 2100]) {
      for (let date = at(1, 1, year); date.getFullYear() === year; date.setDate(date.getDate() + 1)) {
        const normal = seasonalCalendarCore(SEASONAL_THEMES, civil(date))
        expect(seasonalCalendarCore([...SEASONAL_THEMES].reverse(), civil(date))).toEqual(normal)
        expect(normal.currentPeriod?.id ?? null).toBe(normal.activeId)
        if (normal.currentPeriod) {
          expect(stamp(normal.currentPeriod.from)).toBeLessThanOrEqual(stamp(civil(date)))
          expect(stamp(normal.currentPeriod.to)).toBeGreaterThanOrEqual(stamp(civil(date)))
        }
        count++
      }
    }
    expect(count).toBe(2558)
    expect(getSeasonalThemeByCalendar(at(2, 29, 2000))).toBeNull()
    expect(getSeasonalThemeByCalendar(at(2, 29, 2024))).toBeNull()
  })

  // Independent fixtures checked using bundled python-dateutil.easter methods
  // 3 (Western) and 2 (Julian converted to Gregorian), 2026-10-11.
  // https://dateutil.readthedocs.io/en/2.8.2/easter.html
  // Western reference: https://aa.usno.navy.mil/data/christian_observances
  it.each([
    [2000, 4, 23, 4, 30], [2008, 3, 23, 4, 27], [2010, 4, 4, 4, 4],
    [2024, 3, 31, 5, 5], [2025, 4, 20, 4, 20], [2026, 4, 5, 4, 12],
    [2099, 4, 12, 4, 12], [2100, 3, 28, 5, 2],
  ])('matches independently verified Easter dates in %s', (year, wm, wd, om, od) => {
    for (const [calendar, month, day] of [['western', wm, wd], ['orthodox', om, od]] as const) {
      const registry: SeasonalCalendarDefinition[] = [{
        id: 'easter', priority: 30,
        rules: [{ kind: 'easterRelative', calendar, fromOffset: -7, toOffset: 2 }],
      }]
      const sunday = at(month, day, year)
      const from = new Date(sunday); from.setDate(from.getDate() - 7)
      const to = new Date(sunday); to.setDate(to.getDate() + 2)
      expect(seasonalCalendarCore(registry, civil(sunday)).currentPeriod).toEqual({ id: 'easter', from: civil(from), to: civil(to) })
      for (const [offset, expected] of [[-8, null], [-7, 'easter'], [2, 'easter'], [3, null]] as const) {
        const date = new Date(sunday); date.setDate(date.getDate() + offset)
        expect(seasonalCalendarCore(registry, civil(date)).activeId).toBe(expected)
      }
    }
  })

  it('merges coincident/overlapping Easter windows and preserves disjoint status', () => {
    expect(getSeasonalCalendar(at(4, 20, 2025)).currentPeriod).toEqual({
      id: 'easter', from: { year: 2025, month: 4, day: 13 }, to: { year: 2025, month: 4, day: 22 },
    })
    expect(getSeasonalCalendar(at(4, 5, 2026)).currentPeriod).toEqual({
      id: 'easter', from: { year: 2026, month: 3, day: 29 }, to: { year: 2026, month: 4, day: 14 },
    })
    const separated = getSeasonalCalendar(at(4, 10, 2024))
    expect(separated.currentPeriod).toBeNull()
    expect(separated.nextPeriod).toEqual({ id: 'easter', from: { year: 2024, month: 4, day: 28 }, to: { year: 2024, month: 5, day: 7 } })
    expect(separated.windows.filter((period) => period.id === 'easter' && period.from.year === 2024)).toHaveLength(2)
  })

  it('merges adjacent same-theme rules without duplicate periods', () => {
    const registry = [{ ...fixed('spring', 10, 1, 5), rules: [...fixed('spring', 10, 1, 5).rules, ...fixed('spring', 10, 6, 10).rules] }]
    expect(seasonalCalendarCore(registry, { year: 2026, month: 3, day: 6 }).currentPeriod).toEqual({
      id: 'spring', from: { year: 2026, month: 3, day: 1 }, to: { year: 2026, month: 3, day: 10 },
    })
  })

  it('uses priority for appearance and exact observable status ranges', () => {
    const easter: SeasonalCalendarDefinition = { id: 'easter', priority: 30, rules: [{ kind: 'easterRelative', calendar: 'western', fromOffset: -7, toOffset: 2 }] }
    const registry = [fixed('spring', 10, 1, 31), easter]
    const result = seasonalCalendarCore(registry, { year: 2008, month: 3, day: 20 })
    expect(result).toEqual(seasonalCalendarCore([...registry].reverse(), { year: 2008, month: 3, day: 20 }))
    expect(result.currentPeriod).toEqual({ id: 'easter', from: { year: 2008, month: 3, day: 16 }, to: { year: 2008, month: 3, day: 25 } })
    expect(result.nextPeriod).toEqual({ id: 'spring', from: { year: 2008, month: 3, day: 26 }, to: { year: 2008, month: 3, day: 31 } })
  })

  it('reports Christmas across last year and next-year upcoming periods', () => {
    expect(getSeasonalCalendar(at(1, 7)).currentPeriod).toEqual({
      id: 'christmas', from: { year: 2025, month: 12, day: 1 }, to: { year: 2026, month: 1, day: 14 },
    })
    expect(getSeasonalCalendar(at(12, 31)).nextPeriod).toEqual({
      id: 'spring', from: { year: 2027, month: 3, day: 1 }, to: { year: 2027, month: 3, day: 10 },
    })
  })

  it('rejects duplicates, invalid dates/rules and equal-priority conflicts', () => {
    expect(() => validateSeasonalRegistry([fixed('spring', 10, 1, 3), fixed('spring', 20, 4, 5)])).toThrow(/duplicate/)
    expect(() => validateSeasonalRegistry([fixed('spring', 10, 1, 4), fixed('other', 10, 4, 5)])).toThrow(/equal-priority/)
    expect(() => validateSeasonalRegistry([fixed('spring', 10, 1, 32)])).toThrow(/fixed annual/)
    expect(() => validateSeasonalRegistry([{ ...fixed('spring', 10, 1, 4), priority: NaN }])).toThrow(/priority/)
    expect(() => validateSeasonalRegistry([{ id: 'easter', priority: 30, rules: [{ kind: 'easterRelative', calendar: 'western', fromOffset: 2, toOffset: -7 }] }])).toThrow(/Easter/)
    expect(() => seasonalCalendarCore(SEASONAL_THEMES, { year: 2100, month: 2, day: 29 })).toThrow(/civil date/)
  })

  it('preserves auto/off/manual and handles unknown stored preferences', () => {
    expect(resolveSeasonalTheme('off', at(12, 25))).toBeNull()
    expect(resolveSeasonalTheme('auto', at(12, 25))).toBe('christmas')
    for (const id of SEASONAL_THEME_IDS) expect(resolveSeasonalTheme(id, at(7, 1))).toBe(id)
    expect(resolveSeasonalTheme('unknown' as never, at(12, 25))).toBe('christmas')
    expect(isSeasonalThemePreference('easter')).toBe(true)
    expect(isSeasonalThemePreference('unknown')).toBe(false)
    expect(isSeasonalThemePreference(null)).toBe(false)
  })
})
