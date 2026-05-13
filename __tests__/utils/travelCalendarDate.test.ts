import { buildTravelMonthFallbackDate, resolveTravelMonthNumber } from '@/utils/travelCalendarDate'

const getIsoDayOfWeek = (date: string | undefined) => {
  if (!date) return null
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).getDay()
}

describe('travelCalendarDate', () => {
  it('builds weekend fallback from numeric month and year', () => {
    const date = buildTravelMonthFallbackDate({ year: '2024', month: ['5'] })
    expect(date).toMatch(/^2024-05-/)
    expect([0, 6]).toContain(getIsoDayOfWeek(date))
  })

  it('builds weekend fallback from Russian month name', () => {
    const date = buildTravelMonthFallbackDate({ year: 2025, monthName: 'Мая' })
    expect(date).toMatch(/^2025-05-/)
    expect([0, 6]).toContain(getIsoDayOfWeek(date))
  })

  it('builds weekend fallback from English month name', () => {
    const date = buildTravelMonthFallbackDate({ year: '2026', monthName: 'October' })
    expect(date).toMatch(/^2026-10-/)
    expect([0, 6]).toContain(getIsoDayOfWeek(date))
  })

  it('ignores invalid year or month', () => {
    expect(buildTravelMonthFallbackDate({ year: '20', month: '5' })).toBeUndefined()
    expect(buildTravelMonthFallbackDate({ year: '2024', month: '13' })).toBeUndefined()
  })

  it('resolves month from option-shaped values', () => {
    expect(resolveTravelMonthNumber([{ id: '7', name: 'Июль' }])).toBe(7)
  })

  it('uses the next free weekend when the seeded date is occupied', () => {
    const first = buildTravelMonthFallbackDate({ year: '2026', month: '5', seed: 1 })
    const second = buildTravelMonthFallbackDate({
      year: '2026',
      month: '5',
      seed: 1,
      occupiedDates: first ? [first] : [],
    })

    expect(second).toMatch(/^2026-05-/)
    expect(second).not.toBe(first)
    expect([0, 6]).toContain(getIsoDayOfWeek(second))
  })
})
