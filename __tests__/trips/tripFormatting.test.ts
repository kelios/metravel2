// __tests__/trips/tripFormatting.test.ts
// Презентационные хелперы каталога публичных поездок (#411/#414).

import {
  APPLICATION_STATUS_LABEL,
  TRIP_STATUS_LABEL,
  formatSeats,
  formatTripDates,
  tripCardMeta,
} from '@/components/trips/tripFormatting'
import type { PublicTrip } from '@/api/publicTrips'

const baseTrip: PublicTrip = {
  id: 1,
  slug: 's',
  title: 'T',
  coverUrl: null,
  region: 'Минск',
  tripType: 'Поход',
  startDate: '2026-07-18',
  endDate: '2026-07-20',
  organizer: { id: 1, name: 'A', avatarUrl: null },
  seatsTotal: 6,
  seatsTaken: 2,
  status: 'open',
  description: '',
  featured: false,
  myApplicationStatus: null,
  isOwner: false,
  meetingPoint: null,
  contactNote: null,
}

describe('tripFormatting', () => {
  it('has labels for every status', () => {
    expect(Object.keys(TRIP_STATUS_LABEL)).toEqual(['open', 'full', 'completed'])
    expect(Object.keys(APPLICATION_STATUS_LABEL)).toEqual([
      'new',
      'pending',
      'approved',
      'rejected',
      'cancelled',
    ])
  })

  it('formats date ranges and single days', () => {
    expect(formatTripDates(baseTrip)).toBe('18 июл. – 20 июл.')
    expect(formatTripDates({ startDate: '2026-06-28', endDate: null })).toBe('28 июн.')
    expect(
      formatTripDates({ startDate: '2026-06-28', endDate: '2026-06-28' }),
    ).toBe('28 июн.')
  })

  it('computes free seats', () => {
    expect(formatSeats(baseTrip)).toBe('мест: 4 из 6')
    expect(formatSeats({ seatsTotal: 4, seatsTaken: 4 })).toBe('мест: 0 из 4')
  })

  it('joins card meta with separators', () => {
    expect(tripCardMeta(baseTrip)).toContain('Минск')
    expect(tripCardMeta(baseTrip)).toContain('·')
  })
})
