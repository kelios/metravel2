// __tests__/trips/plannedTripEndDate.test.ts
// #1838: дата окончания планируемой поездки — чтение, отправка и показ.
//
// Regression control здесь двойной. До правки нормализатор игнорировал
// `end_date`, а форма его не слала, поэтому поездка 26.09–04.10 показывалась
// одним днём. Оба дефекта тихие: сохранение проходит, ответ 200, и на экране
// просто нет второй даты. Тесты ниже падают ровно на этих двух возвратах.

jest.mock('@/stores/authStore', () => ({
  useAuthStore: {
    getState: jest.fn(() => ({ userId: null, isAuthenticated: false })),
  },
}))

jest.mock('@/utils/logger', () => ({
  devWarn: jest.fn(),
  devLog: jest.fn(),
  devError: jest.fn(),
}))

jest.mock('@/api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message?: string) {
      super(message ?? String(status))
      this.status = status
      this.name = 'ApiError'
    }
  },
}))

delete process.env.EXPO_PUBLIC_TRIPS_MOCK

import { apiClient } from '@/api/client'
import { createTrip, updatePlannedTrip } from '@/api/plannedTripsRequests'
import { mapTrip, type PlannedTripDto } from '@/api/plannedTripsNormalizers'
import {
  formatTripDateTimeRangeLong,
  isTripEndBeforeStart,
  serializeTripEnd,
  serializeTripStart,
} from '@/utils/tripDateTime'

const dto = (overrides: Partial<PlannedTripDto> = {}): PlannedTripDto => ({
  id: 4242,
  title: 'Поход по Налибокской пуще',
  start_date: '2026-09-26T09:00:00+02:00',
  ...overrides,
})

describe('mapTrip end date', () => {
  it('reads the trip end from its own field', () => {
    const trip = mapTrip(dto({ end_date: '2026-10-04T12:00:00+02:00' }))

    expect(trip.startDate).toBe('2026-09-26')
    expect(trip.endDate).toBe('2026-10-04')
  })

  it('leaves the end empty when the backend has none', () => {
    expect(mapTrip(dto()).endDate).toBeNull()
    expect(mapTrip(dto({ end_date: null })).endDate).toBeNull()
  })

  // Ровно тот дефект, который чинила #1836 на бэкенде: конец, подставленный из
  // старта, выглядит как настоящий и делает однодневной любую поездку.
  it('never substitutes the start for a missing end', () => {
    const trip = mapTrip(dto())

    expect(trip.endDate).not.toBe(trip.startDate)
  })

  it('drops an unreadable end instead of printing it raw', () => {
    expect(mapTrip(dto({ end_date: 'позавчера' })).endDate).toBeNull()
  })
})

describe('serializeTripEnd', () => {
  const start = (date: string, time: string) => serializeTripStart(date, time)

  // Полдень, а не конец дня: момент читается в поясе устройства-читателя, и
  // 23:59 переезжают на следующую дату от сдвига вперёд на одну минуту.
  it('anchors the chosen day at midday with the device offset', () => {
    expect(serializeTripEnd('2026-10-04', start('2026-09-26', '09:00'))).toMatch(
      /^2026-10-04T12:00:00[+-]\d{2}:\d{2}$/,
    )
  })

  // Ровно тот дефект, ради которого якорь не может быть 23:59: читатель всего
  // на час восточнее автора (Варшава → Минск) видел бы конец следующим днём.
  it.each([0, 1, 11])('keeps the chosen day for a reader %s hours east', (shiftHours) => {
    const payload = serializeTripEnd('2026-10-04', start('2026-09-26', '09:00'))
    const authorOffsetMinutes = -new Date(payload).getTimezoneOffset()
    const wall = new Date(
      new Date(payload).getTime() + (authorOffsetMinutes + shiftHours * 60) * 60_000,
    )
    const pad = (value: number) => String(value).padStart(2, '0')

    expect(
      `${wall.getUTCFullYear()}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())}`,
    ).toBe('2026-10-04')
  })

  // Конец в полдень был бы раньше старта в 18:00, и бэкенд ответил бы 400 на
  // корректно выбранный пользователем день: однодневная поездка кончается
  // ровно своим стартом.
  it('reuses the start moment for a same-day end', () => {
    const startPayload = start('2026-10-04', '18:00')

    expect(serializeTripEnd('2026-10-04', startPayload)).toBe(startPayload)
    expect(new Date(serializeTripEnd('2026-10-04', startPayload)).getTime()).toBeGreaterThanOrEqual(
      new Date(startPayload).getTime(),
    )
  })

  it('throws instead of sending an unreadable end', () => {
    expect(() => serializeTripEnd('2026-02-30', start('2026-02-01', '09:00'))).toThrow(
      /unreadable trip end/,
    )
  })
})

describe('isTripEndBeforeStart', () => {
  it.each([
    ['2026-09-26', '2026-09-25', true],
    ['2026-09-26', '2026-09-26', false],
    ['2026-09-26', '2026-10-04', false],
  ])('start %s + end %s → %s', (start, end, expected) => {
    expect(isTripEndBeforeStart(start, end)).toBe(expected)
  })

  it('does not report a range error for a missing or unreadable value', () => {
    expect(isTripEndBeforeStart('2026-09-26', null)).toBe(false)
    expect(isTripEndBeforeStart('2026-09-26', 'позавчера')).toBe(false)
    expect(isTripEndBeforeStart(null, '2026-09-26')).toBe(false)
  })
})

describe('formatTripDateTimeRangeLong', () => {
  it('prints a range when the trip has an end', () => {
    expect(formatTripDateTimeRangeLong('2026-09-26', '09:00', '2026-10-04')).toBe(
      '26 сентября 2026 г., 09:00 — 4 октября 2026 г.',
    )
  })

  it('keeps a single date when there is no end', () => {
    expect(formatTripDateTimeRangeLong('2026-09-26', '09:00', null)).toBe(
      '26 сентября 2026 г., 09:00',
    )
  })

  it('does not duplicate the date for a one-day range', () => {
    expect(formatTripDateTimeRangeLong('2026-09-26', null, '2026-09-26')).toBe(
      '26 сентября 2026 г.',
    )
  })

  it('does not print «Дата не указана» as the second half of the range', () => {
    expect(formatTripDateTimeRangeLong('2026-09-26', null, 'позавчера')).toBe(
      '26 сентября 2026 г.',
    )
  })
})

// ── Отправка на бэкенд ───────────────────────────────────────────────────────

const mockPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>
const mockPatch = apiClient.patch as jest.MockedFunction<typeof apiClient.patch>

describe('planned trip payload carries the end date', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as { __DEV__?: boolean }).__DEV__ = false
  })

  const createInput = {
    title: 'Поход по Налибокской пуще',
    description: '',
    startDate: '2026-09-26',
    startTime: '09:00',
    transport: 'foot' as const,
    visibility: 'public' as const,
    seatsTotal: 4,
    startPoint: null,
  }

  it('sends end_date on create', async () => {
    mockPost.mockResolvedValueOnce(dto({ end_date: '2026-10-04T12:00:00+02:00' }) as never)

    await createTrip({ ...createInput, endDate: '2026-10-04' })

    const [, body] = mockPost.mock.calls[0] as [string, Record<string, unknown>]
    expect(body.end_date).toMatch(/^2026-10-04T12:00:00[+-]\d{2}:\d{2}$/)
  })

  it('sends an explicit null when the trip has no end', async () => {
    mockPost.mockResolvedValueOnce(dto() as never)

    await createTrip(createInput)

    const [, body] = mockPost.mock.calls[0] as [string, Record<string, unknown>]
    expect(body).toHaveProperty('end_date', null)
  })

  it('sends end_date on update and clears it back to null', async () => {
    mockPatch.mockResolvedValue(dto() as never)
    const updateInput = {
      tripId: 4242,
      title: createInput.title,
      description: '',
      startDate: '2026-09-26',
      startTime: '09:00',
      transport: createInput.transport,
      visibility: createInput.visibility,
      seatsTotal: 4,
      coverUrl: null,
    }

    await updatePlannedTrip({ ...updateInput, endDate: '2026-10-04' })
    const [, withEnd] = mockPatch.mock.calls[0] as [string, Record<string, unknown>]
    expect(withEnd.end_date).toMatch(/^2026-10-04T12:00:00[+-]\d{2}:\d{2}$/)

    await updatePlannedTrip({ ...updateInput, endDate: null })
    const [, cleared] = mockPatch.mock.calls[1] as [string, Record<string, unknown>]
    expect(cleared).toHaveProperty('end_date', null)
  })
})
