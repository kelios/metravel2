import { formatRelativeTime } from '@/utils/relativeTime'
import { pluralizeRu } from '@/utils/pluralize'
import { i18n } from '@/i18n'

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

  it('keeps comment/history labels localized when Intl.RelativeTimeFormat is unavailable', async () => {
    const originalLanguage = i18n.language
    const relativeTimeFormatDescriptor = Object.getOwnPropertyDescriptor(
      Intl,
      'RelativeTimeFormat',
    )
    Object.defineProperty(Intl, 'RelativeTimeFormat', {
      configurable: true,
      value: undefined,
    })

    try {
      const expectedByLocale = {
        ru: ['5 минут назад', '3 часа назад', 'вчера'],
        be: ['5 хвілін таму', '3 гадзіны таму', 'учора'],
        uk: ['5 хвилин тому', '3 години тому', 'учора'],
        pl: ['5 minut temu', '3 godziny temu', 'wczoraj'],
        en: ['5 minutes ago', '3 hours ago', 'yesterday'],
      } as const

      for (const [locale, expected] of Object.entries(expectedByLocale)) {
        await i18n.changeLanguage(locale)
        expect([
          formatRelativeTime(now - 5 * 60 * 1000, now),
          formatRelativeTime(now - 3 * 60 * 60 * 1000, now),
          formatRelativeTime(new Date('2026-06-02T20:00:00').getTime(), now),
        ]).toEqual(expected)
      }
    } finally {
      if (relativeTimeFormatDescriptor) {
        Object.defineProperty(Intl, 'RelativeTimeFormat', relativeTimeFormatDescriptor)
      } else {
        Reflect.deleteProperty(Intl, 'RelativeTimeFormat')
      }
      await i18n.changeLanguage(originalLanguage)
    }
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
