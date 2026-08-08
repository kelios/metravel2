// __tests__/trips/tripDateTime.test.ts
// Матрица разбора дат домена trips (#1313).
//
// Зону пинить внутри файла нельзя: в jsdom-воркере Jest присваивание
// `process.env.TZ` не переключает уже инициализированную зону V8 (проверено —
// `09:00Z` остаётся тем же часом до и после присваивания). Поэтому ожидания
// локального времени строятся независимым оракулом `Intl.formatToParts`: он
// берёт ту же зону, но совсем другим путём, чем геттеры `Date` в реализации.
// Контрактный случай «09:00Z → 12:00 в Europe/Minsk» получается прогоном
// `TZ=Europe/Minsk npx jest __tests__/trips/tripDateTime.test.ts`.

import {
  formatTripDateLong,
  formatTripDateRangeShort,
  formatTripDateTimeLong,
  parseTripDateTime,
  serializeTripStart,
  tripDateUnavailableText,
} from '@/utils/tripDateTime'

const LOCAL_PARTS = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** Независимый оракул: как эта зона показывает данный момент. */
const localOracle = (iso: string): { date: string; time: string } => {
  const parts = LOCAL_PARTS.formatToParts(new Date(iso))
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  const hour = pick('hour') === '24' ? '00' : pick('hour')
  return {
    date: `${pick('year')}-${pick('month')}-${pick('day')}`,
    time: `${hour}:${pick('minute')}`,
  }
}

/** Смещение зоны для конкретного локального момента, тоже через Intl. */
const localOffset = (year: number, month: number, day: number, hour: number): string => {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZoneName: 'longOffset',
  }).format(new Date(year, month - 1, day, hour))
  const match = /GMT([+-]\d{2}:\d{2})/.exec(formatted)
  return match ? match[1] : '+00:00'
}

describe('parseTripDateTime', () => {
  it('keeps a date-only value on its calendar day, without a time', () => {
    const parsed = parseTripDateTime('2026-10-12')
    expect(parsed).not.toBeNull()
    expect(parsed).toMatchObject({ date: '2026-10-12', time: null, hasTime: false })
    // Локальная полночь, а не UTC-полночь: иначе день уезжает на сутки.
    expect(parsed!.value.getHours()).toBe(0)
    expect(parsed!.value.getDate()).toBe(12)
  })

  it.each([
    ['+00:00 offset', '2026-10-12T09:00:00+00:00'],
    ['Z suffix', '2026-10-12T09:00:00Z'],
    ['offset without colon', '2026-10-12T09:00:00+0000'],
    ['fractional seconds', '2026-10-12T09:00:00.123Z'],
    ['no seconds', '2026-10-12T09:00Z'],
  ])('converts %s into the device local day and time', (_label, input) => {
    const parsed = parseTripDateTime(input)
    const expected = localOracle('2026-10-12T09:00:00Z')
    expect(parsed).toMatchObject({ ...expected, hasTime: true })
    // Момент сохранён точно — значение не было прочитано как стенные часы.
    expect(parsed!.value.getTime()).toBe(Date.parse('2026-10-12T09:00:00Z'))
  })

  it('keeps an instant that is already expressed with an offset', () => {
    const parsed = parseTripDateTime('2026-10-12T12:00:00+03:00')
    expect(parsed).toMatchObject(localOracle('2026-10-12T09:00:00Z'))
    expect(parsed!.value.getTime()).toBe(Date.parse('2026-10-12T12:00:00+03:00'))
  })

  it('treats an offset-less legacy date-time as device wall clock', () => {
    // Ровно та форма, которую до сих пор писал наш собственный клиент.
    expect(parseTripDateTime('2026-10-12T09:00:00')).toMatchObject({
      date: '2026-10-12',
      time: '09:00',
      hasTime: true,
    })
  })

  it('moves a late-evening UTC value to the correct local day', () => {
    const parsed = parseTripDateTime('2026-10-12T23:30:00Z')
    expect(parsed).toMatchObject(localOracle('2026-10-12T23:30:00Z'))
    // В любой зоне восточнее UTC это уже следующие сутки.
    if (new Date('2026-10-12T23:30:00Z').getTimezoneOffset() < 0) {
      expect(parsed!.date).toBe('2026-10-13')
    }
  })

  it.each([
    ['empty string', ''],
    ['blank string', '   '],
    ['null', null],
    ['undefined', undefined],
    ['free text', 'not-a-date'],
    ['impossible month and day', '2026-13-45'],
    ['impossible calendar day', '2026-02-30'],
    ['impossible calendar day with time', '2026-02-30T09:00:00Z'],
    ['impossible hour', '2026-10-12T25:00:00Z'],
    ['impossible minute', '2026-10-12T10:99:00'],
    ['trailing garbage', `2026-10-12T09:00:00Z${'0'.repeat(64)}`],
    // Форма валидная, отсекает её только ограничение длины — иначе граница
    // была бы непокрытой и её можно было бы удалить незаметно.
    ['over-long well-formed input', `2026-10-12T09:00:00.${'1'.repeat(25)}Z`],
    ['number instead of string', 20261012 as unknown as string],
  ])('rejects %s', (_label, input) => {
    expect(parseTripDateTime(input as string | null | undefined)).toBeNull()
  })
})

describe('trips date presentation', () => {
  it('formats a long date', () => {
    expect(formatTripDateLong('2026-07-11')).toBe('11 июля 2026 г.')
  })

  it('formats a date-time using the time carried by the value itself', () => {
    const { date, time } = localOracle('2026-10-12T09:00:00+00:00')
    expect(formatTripDateTimeLong('2026-10-12T09:00:00+00:00', null)).toBe(
      `${formatTripDateLong(date)}, ${time}`,
    )
  })

  it('prefers an explicit time argument over the parsed one', () => {
    expect(formatTripDateTimeLong('2026-10-12', '08:00')).toBe('12 октября 2026 г., 08:00')
  })

  it('formats ranges and collapses a single day', () => {
    expect(formatTripDateRangeShort('2026-07-18', '2026-07-20')).toBe('18 июл. – 20 июл.')
    expect(formatTripDateRangeShort('2026-06-28', null)).toBe('28 июн.')
    expect(formatTripDateRangeShort('2026-06-28', '2026-06-28')).toBe('28 июн.')
  })

  it.each([
    ['long date', () => formatTripDateLong('not-a-date')],
    ['date-time', () => formatTripDateTimeLong('not-a-date', null)],
    ['range', () => formatTripDateRangeShort('not-a-date', null)],
    ['missing value', () => formatTripDateLong('')],
  ])('renders the unavailable placeholder for %s instead of the raw value', (_label, render) => {
    expect(render()).toBe(tripDateUnavailableText())
    expect(render()).toBe('Дата не указана')
  })

  it('never leaks an ISO fragment into rendered output', () => {
    const rendered = [
      formatTripDateLong('2026-10-12T09:00:00+00:00'),
      formatTripDateTimeLong('2026-10-12T09:00:00Z', null),
      formatTripDateRangeShort('2026-10-12T09:00:00Z', '2026-10-14T09:00:00Z'),
    ]
    for (const text of rendered) {
      expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/)
      expect(text).not.toMatch(/T\d{2}:\d{2}/)
      expect(text).not.toMatch(/[+-]\d{2}:\d{2}/)
      expect(text).not.toMatch(/Z$/)
    }
  })
})

describe('serializeTripStart', () => {
  it('sends an explicit offset so the saved instant round-trips', () => {
    expect(serializeTripStart('2026-10-12', '12:00')).toBe(
      `2026-10-12T12:00:00${localOffset(2026, 10, 12, 12)}`,
    )
  })

  it('keeps the 09:00 default only when no time was supplied', () => {
    const expected = `2026-10-12T09:00:00${localOffset(2026, 10, 12, 9)}`
    expect(serializeTripStart('2026-10-12', null)).toBe(expected)
    expect(serializeTripStart('2026-10-12', '')).toBe(expected)
  })

  it('round-trips through the parser without moving the wall clock', () => {
    expect(parseTripDateTime(serializeTripStart('2026-10-12', '12:00'))).toMatchObject({
      date: '2026-10-12',
      time: '12:00',
    })
  })

  // Инвариант, не зависящий от зоны прогона: payload обязан означать ровно тот
  // момент, который разрешил парсер. Именно он ловит час перехода на летнее
  // время, когда выбранных стенных часов не существует.
  it.each([
    ['2026-01-15', '02:30'],
    ['2026-03-29', '02:30'],
    ['2026-03-29', '03:30'],
    ['2026-07-15', '12:00'],
    ['2026-10-25', '02:30'],
  ])('payload for %s %s denotes the instant the parser resolved', (date, time) => {
    const resolved = parseTripDateTime(`${date}T${time}:00`)
    expect(resolved).not.toBeNull()
    expect(new Date(serializeTripStart(date, time)).getTime()).toBe(resolved!.value.getTime())
  })

  it.each([
    ['free text', 'not-a-date'],
    ['empty date', ''],
    ['impossible calendar day', '2026-02-30'],
  ])('refuses to serialize %s instead of emitting an offset-less payload', (_label, date) => {
    expect(() => serializeTripStart(date, '12:00')).toThrow(/unreadable trip start/)
  })

  it('refuses an unreadable time as well', () => {
    expect(() => serializeTripStart('2026-10-12', '99:99')).toThrow(/unreadable trip start/)
  })
})
