import {
  DEFAULT_LOCALE_PREFERENCE,
  parseLocalePreference,
  resolveLocalePreference,
} from '@/i18n/localeStorage'

describe('locale preference storage contract', () => {
  it('accepts a versioned explicit locale', () => {
    const preference = parseLocalePreference(
      JSON.stringify({ version: 1, mode: 'explicit', locale: 'ru' }),
    )

    expect(preference).toEqual({ version: 1, mode: 'explicit', locale: 'ru' })
    expect(resolveLocalePreference(preference)).toBe('ru')
  })

  it.each(['be', 'uk', 'pl', 'en'] as const)('persists the %s locale explicitly', (locale) => {
    const preference = parseLocalePreference(
      JSON.stringify({ version: 1, mode: 'explicit', locale }),
    )

    expect(preference).toEqual({ version: 1, mode: 'explicit', locale })
    expect(resolveLocalePreference(preference)).toBe(locale)
  })

  it.each([null, '', 'invalid json', '{"version":2}', '{"version":1,"mode":"explicit","locale":"xx"}'])(
    'falls back safely for %p',
    (raw) => {
      expect(parseLocalePreference(raw)).toEqual(DEFAULT_LOCALE_PREFERENCE)
    },
  )
})
