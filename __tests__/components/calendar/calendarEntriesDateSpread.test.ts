import { buildCalendarEntriesWithDates } from '@/components/screens/calendar/calendarScreen.helpers'
import type { TravelStatusEntry } from '@/stores/travelStatusStore'

const makeVisited = (id: number, extra: Partial<TravelStatusEntry> = {}): TravelStatusEntry => ({
  id,
  type: 'travel',
  title: `Trip ${id}`,
  url: `/travel/${id}`,
  status: 'visited',
  addedAt: id,
  travelYear: '2024',
  travelMonthName: 'Июль',
  ...extra,
})

const isoDayOfWeek = (date?: string) => {
  if (!date) return null
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

describe('buildCalendarEntriesWithDates (weekend spread + anti-collision)', () => {
  it('places dateless same-month visits on distinct days, weekends first', () => {
    const entries = [1, 2, 3, 4].map((id) => makeVisited(id))
    const placed = buildCalendarEntriesWithDates(entries)

    const dates = placed.map((entry) => entry.visitedDate)
    expect(dates.every((date) => date?.startsWith('2024-07-'))).toBe(true)

    // все дни различны — коллизий нет
    expect(new Set(dates).size).toBe(entries.length)

    // в июле 2024 не меньше 8 выходных — все 4 записи должны сесть на выходные
    expect(dates.map(isoDayOfWeek).every((dow) => dow === 0 || dow === 6)).toBe(true)
  })

  it('is deterministic across runs and independent of input order', () => {
    const forward = buildCalendarEntriesWithDates([1, 2, 3].map((id) => makeVisited(id)))
    const reversed = buildCalendarEntriesWithDates([3, 2, 1].map((id) => makeVisited(id)))

    const byId = (list: TravelStatusEntry[]) =>
      Object.fromEntries(list.map((entry) => [entry.id, entry.visitedDate]))

    expect(byId(forward)).toEqual(byId(reversed))
  })

  it('keeps explicit dates as fixed anchors and does not reuse them for dateless trips', () => {
    const entries = [
      makeVisited(1, { visitedDate: '2024-07-06' }), // явная суббота-якорь
      makeVisited(2),
      makeVisited(3),
    ]
    const placed = buildCalendarEntriesWithDates(entries)
    const byId = Object.fromEntries(placed.map((entry) => [entry.id, entry.visitedDate]))

    expect(byId[1]).toBe('2024-07-06')
    expect(byId[2]).not.toBe('2024-07-06')
    expect(byId[3]).not.toBe('2024-07-06')
    expect(new Set(Object.values(byId)).size).toBe(3)
  })
})
