import fs from 'node:fs'
import path from 'node:path'

import { SUPPORTED_LOCALES, type SupportedLocale } from '@/i18n/config'
import * as formatModule from '@/i18n/format'
import {
  createCollator,
  formatCompactNumber,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatInteger,
  formatList,
  formatNumber,
  formatRelativeTime,
  getActiveLocale,
  getActiveLocaleDefinition,
  getFormatLocale,
  selectPlural,
} from '@/i18n/format'
import { formatRelativeTimeFallback } from '@/i18n/relativeTimeFallback'

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

// #1528. The engines this app ships on do not all carry the same `Intl`.
// The Android release binary (`lib/arm64-v8a/libhermesvm.so`, versionCode 20)
// and the iOS one (`hermesvm.xcframework/ios-arm64/hermesvm.framework/hermesvm`
// out of `ios/Pods/hermes-engine-artifacts/hermes-ios-*-release.tar.gz`) each
// expose only `Intl.Collator`, `Intl.DateTimeFormat`, `Intl.NumberFormat` and
// `getCanonicalLocales`; `RelativeTimeFormat`, `PluralRules` and `ListFormat`
// are absent from both binaries entirely. Two tickets in a row (#1335, #1511)
// found that composition by watching a device, not by reading the code, and
// both were fixed at the call site while the canonical formatter stayed
// unguarded. This block turns the invariant into a check: every formatter
// `i18n/format.ts` exports has to answer on that engine, including the ones
// added after this was written.
const OPTIONAL_INTL_CONSTRUCTORS = ['ListFormat', 'PluralRules', 'RelativeTimeFormat'] as const

// Present on Hermes, so a formatter may construct them unguarded.
const REQUIRED_INTL_CONSTRUCTORS = ['Collator', 'DateTimeFormat', 'NumberFormat'] as const

// The canonical formatting layer: `i18n/format.ts` plus the two modules it
// leans on for the constructors Hermes does not carry.
const CANONICAL_FORMAT_SOURCES = [
  'i18n/format.ts',
  'i18n/pluralRules.js',
  'i18n/relativeTimeFallback.ts',
] as const

const withoutIntlConstructors = (names: readonly string[], run: () => void): void => {
  const saved = names.map((name) => [name, Object.getOwnPropertyDescriptor(Intl, name)] as const)
  for (const name of names) {
    Object.defineProperty(Intl, name, { configurable: true, value: undefined })
  }

  try {
    run()
  } finally {
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(Intl, name, descriptor)
    }
  }
}

// One call per exported formatter, with arguments that actually reach the
// `Intl` constructor behind it. The coverage test below keeps this map in step
// with the module, so a new export cannot skip the matrix.
const FORMATTER_INVOCATIONS: Record<string, (locale: SupportedLocale) => unknown> = {
  createCollator: (locale) => createCollator({}, locale).compare('а', 'б'),
  formatCompactNumber: (locale) => formatCompactNumber(12345, {}, locale),
  formatCurrency: (locale) => formatCurrency(25, 'BYN', locale),
  formatDate: (locale) => formatDate(new Date(2026, 6, 14), { dateStyle: 'medium' }, locale),
  formatDateTime: (locale) => formatDateTime(new Date(2026, 6, 14), {}, locale),
  formatInteger: (locale) => formatInteger(1234, locale),
  formatList: (locale) => formatList(['Минск', 'Гродно'], undefined, locale),
  formatNumber: (locale) => formatNumber(1234.5, {}, locale),
  formatRelativeTime: (locale) => formatRelativeTime(-5, 'minute', { numeric: 'auto' }, locale),
  getActiveLocale: () => getActiveLocale(),
  getActiveLocaleDefinition: () => getActiveLocaleDefinition(),
  getFormatLocale: (locale) => getFormatLocale(locale),
  selectPlural: (locale) => selectPlural(5, { one: 'one', few: 'few', other: 'other' }, locale),
}

const invokeEveryFormatter = (context: string): void => {
  for (const locale of SUPPORTED_LOCALES) {
    for (const [name, invoke] of Object.entries(FORMATTER_INVOCATIONS)) {
      try {
        invoke(locale)
      } catch (error) {
        throw new Error(`${name}('${locale}') threw ${context}: ${String(error)}`)
      }
    }
  }
}

describe('Intl availability governance for i18n/format.ts (#1528)', () => {
  it('covers every exported formatter in the availability matrix', () => {
    const exported = Object.entries(formatModule)
      .filter(([, value]) => typeof value === 'function')
      .map(([name]) => name)
      .sort()

    expect(exported).toEqual(Object.keys(FORMATTER_INVOCATIONS).sort())
  })

  it('classifies every Intl constructor the canonical layer touches', () => {
    const classified = new Set<string>([
      ...OPTIONAL_INTL_CONSTRUCTORS,
      ...REQUIRED_INTL_CONSTRUCTORS,
    ])

    const referenced = new Set<string>()
    for (const relativePath of CANONICAL_FORMAT_SOURCES) {
      const source = fs.readFileSync(path.join(__dirname, '../..', relativePath), 'utf8')
      for (const match of source.matchAll(/\bIntl\.([A-Z]\w+)/g)) {
        const name = match[1]
        // Type positions (`Intl.NumberFormatOptions`, `Intl.LDMLPluralRule`)
        // share the namespace with the constructors; only the runtime ones
        // can be missing from an engine.
        if (typeof (Intl as Record<string, unknown>)[name] === 'function') referenced.add(name)
      }
    }

    expect(referenced.size).toBeGreaterThan(0)
    expect([...referenced].filter((name) => !classified.has(name))).toEqual([])
    // Both halves have to stay reachable, or the matrix silently goes vacuous.
    expect(OPTIONAL_INTL_CONSTRUCTORS.some((name) => referenced.has(name))).toBe(true)
  })

  it.each(OPTIONAL_INTL_CONSTRUCTORS)(
    'keeps every canonical formatter answering without Intl.%s',
    (name) => {
      withoutIntlConstructors([name], () => invokeEveryFormatter(`without Intl.${name}`))
    },
  )

  it('keeps every canonical formatter answering on the Hermes Intl composition', () => {
    withoutIntlConstructors(OPTIONAL_INTL_CONSTRUCTORS, () =>
      invokeEveryFormatter('on the Hermes Intl composition'),
    )
  })

  it('fails when a guard is removed from a formatter', () => {
    // The matrix above only proves something if a missing guard is loud, so
    // prove the detector itself: an unguarded constructor has to throw here.
    withoutIntlConstructors(['RelativeTimeFormat'], () => {
      expect(() => new Intl.RelativeTimeFormat('ru-RU').format(-5, 'minute')).toThrow()
    })
  })
})

describe('formatRelativeTime without Intl.RelativeTimeFormat (#1528)', () => {
  // The exact CLDR output of a full-ICU engine — the fallback prints the same
  // strings, so a Hermes build reads identically to the web.
  const EXPECTED_BY_LOCALE: Record<SupportedLocale, readonly string[]> = {
    ru: ['5 минут назад', 'через 3 часа', 'вчера', 'на прошлой неделе', '1 год назад', 'сейчас'],
    be: ['5 хвілін таму', 'праз 3 гадзіны', 'учора', 'на мінулым тыдні', '1 год таму', 'цяпер'],
    uk: ['5 хвилин тому', 'через 3 години', 'учора', 'минулого тижня', '1 рік тому', 'зараз'],
    pl: ['5 minut temu', 'za 3 godziny', 'wczoraj', 'w zeszłym tygodniu', '1 rok temu', 'teraz'],
    en: ['5 minutes ago', 'in 3 hours', 'yesterday', 'last week', '1 year ago', 'now'],
  }

  const sample = (locale: SupportedLocale): string[] => [
    formatRelativeTime(-5, 'minute', { numeric: 'always' }, locale),
    formatRelativeTime(3, 'hour', { numeric: 'always' }, locale),
    formatRelativeTime(-1, 'day', { numeric: 'auto' }, locale),
    formatRelativeTime(-1, 'week', { numeric: 'auto' }, locale),
    formatRelativeTime(-1, 'year', { numeric: 'always' }, locale),
    formatRelativeTime(0, 'second', { numeric: 'auto' }, locale),
  ]

  it.each(SUPPORTED_LOCALES)('returns localized text on %s with the constructor gone', (locale) => {
    withoutIntlConstructors(OPTIONAL_INTL_CONSTRUCTORS, () => {
      expect(sample(locale)).toEqual(EXPECTED_BY_LOCALE[locale])
    })
  })

  it.each(SUPPORTED_LOCALES)('leaves the native output on %s untouched', (locale) => {
    expect(sample(locale)).toEqual(EXPECTED_BY_LOCALE[locale])
  })

  // The goldens above are six strings; this one holds the whole surface. It is
  // skipped on an engine whose ICU cannot answer for a production locale,
  // because then the "native" side is not CLDR either.
  const hasFullIcu = SUPPORTED_LOCALES.every(
    (locale) =>
      new Intl.RelativeTimeFormat(getFormatLocale(locale)).resolvedOptions().locale ===
      getFormatLocale(locale),
  )

  const parityTest = hasFullIcu ? it : it.skip
  parityTest('matches the native formatter across units, values and both numeric modes', () => {
    const units: Intl.RelativeTimeFormatUnit[] = [
      'second',
      'minute',
      'hour',
      'day',
      'week',
      'month',
      'quarter',
      'year',
    ]
    const values = [-100, -25, -21, -11, -5, -4, -2, -1, -0, 0, 1, 2, 4, 5, 11, 21, 25, 100, -1.5, 1.5]
    // `undefined` is the shape a caller leaves behind with `{}` or
    // `{ style: 'short' }`. The constructor reads it as 'always', so the
    // fallback has to as well.
    const numericModes: Intl.RelativeTimeFormatOptions['numeric'][] = [
      'always',
      'auto',
      undefined,
    ]

    for (const locale of SUPPORTED_LOCALES) {
      const languageTag = getFormatLocale(locale)
      for (const numeric of numericModes) {
        const native = new Intl.RelativeTimeFormat(languageTag, { numeric })
        for (const unit of units) {
          for (const value of values) {
            expect(
              `${locale}/${numeric}/${unit}/${value}: ${formatRelativeTimeFallback(value, unit, { numeric }, locale, languageTag)}`,
            ).toBe(`${locale}/${numeric}/${unit}/${value}: ${native.format(value, unit)}`)
          }
        }
      }
    }
  })

  it('accepts the plural unit spelling the Intl type allows', () => {
    withoutIntlConstructors(OPTIONAL_INTL_CONSTRUCTORS, () => {
      expect(formatRelativeTime(-3, 'days', { numeric: 'always' }, 'ru')).toBe('3 дня назад')
      expect(formatRelativeTime(-3, 'day', { numeric: 'always' }, 'ru')).toBe('3 дня назад')
    })
  })

  // An options object that carries something other than `numeric` is the
  // ordinary way a caller loses the field. `Intl.RelativeTimeFormat` then
  // defaults to 'always', so both engines have to print the numeric wording;
  // reading the missing field as 'auto' would split them on «вчера».
  it.each(SUPPORTED_LOCALES)(
    'reads a missing `numeric` the way the constructor does on %s',
    (locale) => {
      const optionShapes: Intl.RelativeTimeFormatOptions[] = [{}, { style: 'long' }]

      for (const options of optionShapes) {
        const label = `${locale}/${JSON.stringify(options)}`
        const native = formatRelativeTime(-1, 'day', options, locale)
        let fallback = ''
        withoutIntlConstructors(OPTIONAL_INTL_CONSTRUCTORS, () => {
          fallback = formatRelativeTime(-1, 'day', options, locale)
        })

        expect(`${label}: ${fallback}`).toBe(`${label}: ${native}`)
        expect(fallback).not.toBe(formatRelativeTime(-1, 'day', { numeric: 'auto' }, locale))
      }
    },
  )

  it('degrades an abbreviated style to the long form instead of throwing', () => {
    // The abbreviated CLDR tables are not carried, so `short`/`narrow` answer
    // in the long wording. Pinned here so the gap is a known boundary rather
    // than a surprise the next caller finds on a device.
    withoutIntlConstructors(OPTIONAL_INTL_CONSTRUCTORS, () => {
      expect(formatRelativeTime(-5, 'minute', { numeric: 'always', style: 'short' }, 'ru')).toBe(
        '5 минут назад',
      )
      expect(formatRelativeTime(-5, 'minute', { numeric: 'always', style: 'narrow' }, 'ru')).toBe(
        '5 минут назад',
      )
    })
  })

  it('formats the value through the locale, not through String()', () => {
    withoutIntlConstructors(OPTIONAL_INTL_CONSTRUCTORS, () => {
      expect(formatRelativeTime(-1000, 'day', { numeric: 'always' }, 'ru')).toMatch(
        /^1[\s\u00a0]000 дней назад$/,
      )
      expect(formatRelativeTime(-1.5, 'minute', { numeric: 'always' }, 'ru')).toBe(
        '1,5 минуты назад',
      )
    })
  })
})
