import {
  getTravelStatusDisplayCalendarDate,
  travelStatusEntryMatchesSelectedDate,
} from '@/utils/travelStatusCalendarDisplay'
import type { TravelStatusEntry } from '@/stores/travelStatusStore'

const makeEntry = (
  extra: Partial<TravelStatusEntry> & { status?: TravelStatusEntry['status'] }
): TravelStatusEntry => ({
  id: 1,
  type: 'travel',
  title: 'Trip',
  url: '/travels/1',
  status: extra.status ?? 'visited',
  addedAt: 100,
  ...extra,
})

describe('travelStatusCalendarDisplay', () => {
  it('matches entries without exact date by the selected month', () => {
    const entry = makeEntry({
      status: 'visited',
      travelYear: '2020',
      travelMonthName: 'Август',
    })

    expect(getTravelStatusDisplayCalendarDate(entry)).toMatch(/^2020-08-/)
    expect(travelStatusEntryMatchesSelectedDate(entry, '2020-08-22')).toBe(true)
    expect(travelStatusEntryMatchesSelectedDate(entry, '2020-09-01')).toBe(false)
  })

  it('keeps explicit status dates day-specific', () => {
    const entry = makeEntry({
      status: 'visited',
      visitedDate: '2020-08-15',
      travelYear: '2020',
      travelMonthName: 'Август',
    })

    expect(travelStatusEntryMatchesSelectedDate(entry, '2020-08-15')).toBe(true)
    expect(travelStatusEntryMatchesSelectedDate(entry, '2020-08-22')).toBe(false)
  })

  it('uses authored-travel fallback dates for month matching', () => {
    const entry = makeEntry({
      status: 'visited',
      _fallbackCalendarDate: '2020-08-08',
    } as Partial<TravelStatusEntry> & { _fallbackCalendarDate: string })

    expect(getTravelStatusDisplayCalendarDate(entry as TravelStatusEntry & { _fallbackCalendarDate: string })).toBe('2020-08-08')
    expect(travelStatusEntryMatchesSelectedDate(entry as TravelStatusEntry & { _fallbackCalendarDate: string }, '2020-08-22')).toBe(true)
  })
})
