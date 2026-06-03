import { formatRelativeTime } from '@/utils/relativeTime'
import { pluralizeRu } from '@/utils/pluralize'

describe('formatRelativeTime', () => {
  const now = new Date('2026-06-03T12:00:00').getTime()

  it('returns "только что" for future and sub-minute timestamps', () => {
    expect(formatRelativeTime(now + 5000, now)).toBe('только что')
    expect(formatRelativeTime(now - 30 * 1000, now)).toBe('только что')
  })

  it('formats minutes and hours within the current day', () => {
    expect(formatRelativeTime(now - 5 * 60 * 1000, now)).toBe('5 минут назад')
    expect(formatRelativeTime(now - 3 * 60 * 60 * 1000, now)).toBe('3 часа назад')
  })

  it('returns "вчера" for a timestamp inside the previous calendar day', () => {
    const yesterdayEvening = new Date('2026-06-02T20:00:00').getTime()
    expect(formatRelativeTime(yesterdayEvening, now)).toBe('вчера')
  })

  // F-011: an evening "позавчера" timestamp must render "2 дня назад", not "1 день назад".
  // Math.round would undercount to 1 (colliding with the "вчера" bucket); Math.ceil gives the
  // correct calendar-day count.
  it('counts calendar days with ceil for an evening two-days-ago timestamp', () => {
    const twoDaysAgoEvening = new Date('2026-06-01T20:00:00').getTime()
    expect(formatRelativeTime(twoDaysAgoEvening, now)).toBe('2 дня назад')
  })

  it('returns empty string for invalid timestamps', () => {
    expect(formatRelativeTime(0, now)).toBe('')
    expect(formatRelativeTime(Number.NaN, now)).toBe('')
  })
})

describe('pluralizeRu', () => {
  it('selects the correct Russian plural form', () => {
    expect(pluralizeRu(1, 'день', 'дня', 'дней')).toBe('день')
    expect(pluralizeRu(2, 'день', 'дня', 'дней')).toBe('дня')
    expect(pluralizeRu(4, 'день', 'дня', 'дней')).toBe('дня')
    expect(pluralizeRu(5, 'день', 'дня', 'дней')).toBe('дней')
    expect(pluralizeRu(11, 'день', 'дня', 'дней')).toBe('дней')
    expect(pluralizeRu(14, 'день', 'дня', 'дней')).toBe('дней')
    expect(pluralizeRu(21, 'день', 'дня', 'дней')).toBe('день')
    expect(pluralizeRu(0, 'день', 'дня', 'дней')).toBe('дней')
  })
})
