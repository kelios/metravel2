import {
  createCollator,
  formatCurrency,
  formatDate,
  formatList,
  formatNumber,
  getFormatLocale,
  selectPlural,
} from '@/i18n/format'

describe('locale-aware formatting', () => {
  it('uses the registry language tag', () => {
    expect(getFormatLocale('ru')).toBe('ru-RU')
    expect(getFormatLocale('be')).toBe('be-BY')
    expect(getFormatLocale('uk')).toBe('uk-UA')
    expect(getFormatLocale('pl')).toBe('pl-PL')
    expect(getFormatLocale('en')).toBe('en-US')
  })

  it('formats dates and numbers through the requested locale', () => {
    const date = new Date(2026, 6, 14, 12, 0, 0)

    expect(formatDate(date, { day: 'numeric', month: 'long' }, 'ru')).toContain('14 июля')
    expect(formatNumber(1234.5, { minimumFractionDigits: 1 }, 'ru')).toMatch(/1[\s\u00a0]234,5/)
    expect(formatCurrency(25, 'BYN', 'ru')).toContain('25')
  })

  it('provides locale-aware lists and sorting', () => {
    expect(formatList(['Минск', 'Гродно'], undefined, 'ru')).toContain('и')
    expect(['Я', 'А'].sort(createCollator({}, 'ru').compare)).toEqual(['А', 'Я'])
  })

  it('selects grammar through the active locale plural rules', () => {
    const forms = { one: 'one', few: 'few', many: 'many', other: 'other' }
    expect(selectPlural(1, forms, 'ru')).toBe('one')
    expect(selectPlural(2, forms, 'ru')).toBe('few')
    expect(selectPlural(5, forms, 'ru')).toBe('many')
    expect(selectPlural(1.5, forms, 'ru')).toBe('other')
  })

  it('keeps Russian plural selection working when native Intl.PluralRules is unavailable', () => {
    const descriptor = Object.getOwnPropertyDescriptor(Intl, 'PluralRules')
    Object.defineProperty(Intl, 'PluralRules', { configurable: true, value: undefined })

    try {
      const forms = { one: 'one', few: 'few', many: 'many', other: 'other' }
      expect(selectPlural(1, forms, 'ru')).toBe('one')
      expect(selectPlural(2, forms, 'ru')).toBe('few')
      expect(selectPlural(5, forms, 'ru')).toBe('many')
      expect(selectPlural(11, forms, 'ru')).toBe('many')
      expect(selectPlural(21, forms, 'ru')).toBe('one')
      expect(selectPlural(1.5, forms, 'ru')).toBe('other')
      expect(selectPlural(2, forms, 'be')).toBe('few')
      expect(selectPlural(5, forms, 'be')).toBe('many')
      expect(selectPlural(2, forms, 'uk')).toBe('few')
      expect(selectPlural(5, forms, 'uk')).toBe('many')
      expect(selectPlural(1, forms, 'pl')).toBe('one')
      expect(selectPlural(2, forms, 'pl')).toBe('few')
      expect(selectPlural(5, forms, 'pl')).toBe('many')
      expect(selectPlural(1, forms, 'en')).toBe('one')
      expect(selectPlural(2, forms, 'en')).toBe('other')
    } finally {
      if (descriptor) Object.defineProperty(Intl, 'PluralRules', descriptor)
    }
  })
})
