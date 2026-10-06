import { SUPPORTED_LOCALES, type SupportedLocale } from '@/i18n/config'
import { formatBelarusianDate } from '@/i18n/beDateFormat'

/**
 * Контракт `i18n/format.ts` по пяти локалям (#2283).
 *
 * Снимок — то, что печатает полный ICU (Node 22: ICU 76.1, CLDR 46). Второй
 * прогон делает то же через движок без данных `be`, как Chromium 149 (замер
 * 06.10.2026: `be` есть только в `PluralRules`), причём недостающая локаль в
 * нём молча уходит в хост `en-US`. Канонический слой обязан напечатать тот же
 * белорусский снимок, а не «Sep 2» и не русский формат.
 */

type FormatModule = typeof import('@/i18n/format')

const SAMPLE = new Date(Date.UTC(2026, 8, 2, 9, 5))
const NBSP = ' '

const DATE_OPTIONS: Intl.DateTimeFormatOptions[] = [
  { day: 'numeric', month: 'short', timeZone: 'UTC' },
  { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' },
  { weekday: 'short', day: 'numeric', timeZone: 'UTC' },
  { month: 'long', year: 'numeric', timeZone: 'UTC' },
  { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' },
]

type LocaleSnapshot = {
  dates: string[]
  number: string
  compact: string
  percent: string
  relative: string
  yesterday: string
  plural: string
  list: string
}

const EXPECTED: Record<SupportedLocale, LocaleSnapshot> = {
  ru: {
    dates: ['2 сент.', '2 сентября 2026 г.', 'ср, 2', 'сентябрь 2026 г.', '2 сент. 2026 г., 09:05'],
    number: `1${NBSP}234${NBSP}567,891`,
    compact: `12,3${NBSP}тыс.`,
    percent: `42${NBSP}%`,
    relative: '3 дня назад',
    yesterday: 'вчера',
    plural: 'one,few,many,one',
    list: 'A, B и C',
  },
  be: {
    dates: ['2 вер', '2 верасня 2026 г.', '2, ср', 'верасень 2026', '2 вер 2026 г., 09:05'],
    number: `1${NBSP}234${NBSP}567,891`,
    compact: `12,3${NBSP}тыс.`,
    percent: `42${NBSP}%`,
    relative: '3 дні таму',
    yesterday: 'учора',
    plural: 'one,few,many,one',
    list: 'A, B і C',
  },
  uk: {
    dates: ['2 вер.', '2 вересня 2026 р.', 'ср, 2', 'вересень 2026 р.', '2 вер. 2026 р., 09:05'],
    number: `1${NBSP}234${NBSP}567,891`,
    compact: `12,3${NBSP}тис.`,
    percent: '42%',
    relative: '3 дні тому',
    yesterday: 'учора',
    plural: 'one,few,many,one',
    list: 'A, B і C',
  },
  pl: {
    dates: ['2 wrz', '2 września 2026', 'śr., 2', 'wrzesień 2026', '2 wrz 2026, 09:05'],
    number: `1${NBSP}234${NBSP}567,891`,
    compact: `12,3${NBSP}tys.`,
    percent: '42%',
    relative: '3 dni temu',
    yesterday: 'wczoraj',
    plural: 'one,few,many,many',
    list: 'A, B i C',
  },
  en: {
    dates: ['Sep 2', 'September 2, 2026', '2 Wed', 'September 2026', 'Sep 2, 2026, 9:05 AM'],
    number: '1,234,567.891',
    compact: '12.3K',
    percent: '42%',
    relative: '3 days ago',
    yesterday: 'yesterday',
    plural: 'one,other,other,other',
    list: 'A, B, and C',
  },
}

const snapshotOf = (format: FormatModule, locale: SupportedLocale): LocaleSnapshot => ({
  dates: DATE_OPTIONS.map((options) => format.formatDate(SAMPLE, options, locale)),
  number: format.formatNumber(1234567.891, {}, locale),
  compact: format.formatCompactNumber(12345, {}, locale),
  percent: format.formatNumber(0.42, { style: 'percent', maximumFractionDigits: 0 }, locale),
  relative: format.formatRelativeTime(-3, 'day', { numeric: 'auto' }, locale),
  yesterday: format.formatRelativeTime(-1, 'day', { numeric: 'auto' }, locale),
  plural: [1, 2, 5, 21]
    .map((count) =>
      format.selectPlural(count, { one: 'one', few: 'few', many: 'many', other: 'other' }, locale),
    )
    .join(','),
  list: format.formatList(['A', 'B', 'C'], undefined, locale),
})

const loadFreshFormat = (): FormatModule => {
  let loaded: FormatModule | undefined
  jest.isolateModules(() => {
    loaded = require('@/i18n/format') as FormatModule
  })
  if (!loaded) throw new Error('i18n/format did not load')
  return loaded
}

// Семейства, в которых Chromium 149 не знает `be` (PluralRules — знает).
const FAMILIES_WITHOUT_BE = [
  'Collator',
  'DateTimeFormat',
  'ListFormat',
  'NumberFormat',
  'RelativeTimeFormat',
] as const

const isBelarusianTag = (tag: unknown) => /^be(-|$)/i.test(String(tag))

type NativeIntlConstructor = {
  new (locales?: string | string[], options?: object): object
  supportedLocalesOf: (locales: string | string[], options?: object) => string[]
  prototype: object
}

/** Движок без данных `be`: такой тег он молча форматирует хостом `en-US`. */
const withEngineWithoutBelarusian = (run: () => void): void => {
  const intl = Intl as unknown as Record<string, NativeIntlConstructor>
  const saved = FAMILIES_WITHOUT_BE.map((name) => [name, intl[name]] as const)
  for (const [name, Native] of saved) {
    function WithoutBelarusian(locales?: string | string[], options?: object) {
      const requested = ([] as string[]).concat(locales ?? []).filter((tag) => !isBelarusianTag(tag))
      return new Native(requested.length > 0 ? requested : 'en-US', options)
    }
    WithoutBelarusian.prototype = Native.prototype
    WithoutBelarusian.supportedLocalesOf = (locales: string | string[], options?: object) =>
      Native.supportedLocalesOf(locales, options).filter((tag) => !isBelarusianTag(tag))
    Object.defineProperty(Intl, name, {
      configurable: true,
      writable: true,
      value: WithoutBelarusian,
    })
  }
  try {
    run()
  } finally {
    for (const [name, Native] of saved) {
      Object.defineProperty(Intl, name, { configurable: true, writable: true, value: Native })
    }
  }
}

describe('i18n/format five-locale contract (#2283)', () => {
  it('runs on an engine with full CLDR data, so the snapshot is real ICU output', () => {
    expect(Intl.DateTimeFormat.supportedLocalesOf(['be-BY'])).toEqual(['be-BY'])
  })

  it.each(SUPPORTED_LOCALES)('prints the CLDR snapshot for %s on a full-ICU engine', (locale) => {
    expect(snapshotOf(loadFreshFormat(), locale)).toEqual(EXPECTED[locale])
  })

  it('reproduces the Chromium host leak in the simulated engine (the detector works)', () => {
    withEngineWithoutBelarusian(() => {
      const leaked = new Intl.DateTimeFormat('be-BY', DATE_OPTIONS[0]).format(SAMPLE)
      expect(leaked).toBe('Sep 2')
      expect(Intl.DateTimeFormat.supportedLocalesOf(['be', 'be-BY'])).toEqual([])
    })
  })

  it('keeps Belarusian formats on an engine without be data instead of the host locale', () => {
    withEngineWithoutBelarusian(() => {
      const snapshot = snapshotOf(loadFreshFormat(), 'be')
      expect(snapshot).toEqual({
        ...EXPECTED.be,
        // Без данных `ListFormat` слой склеивает нейтрально — без союза чужого языка.
        list: 'A, B, C',
      })
      const hostValues = new Set(Object.values(EXPECTED.en).flat())
      for (const value of Object.values(snapshot).flat()) {
        expect(hostValues.has(value)).toBe(false)
      }
    })
  })

  it.each(SUPPORTED_LOCALES.filter((locale) => locale !== 'be'))(
    'leaves %s untouched on the same engine',
    (locale) => {
      withEngineWithoutBelarusian(() => {
        expect(snapshotOf(loadFreshFormat(), locale)).toEqual(EXPECTED[locale])
      })
    },
  )

  it('falls back to the Russian format, not the host one, where it has no own data', () => {
    withEngineWithoutBelarusian(() => {
      const format = loadFreshFormat()
      const twelveHour: Intl.DateTimeFormatOptions = {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'UTC',
      }
      expect(format.formatDate(SAMPLE, twelveHour, 'be')).toBe(
        format.formatDate(SAMPLE, twelveHour, 'ru'),
      )
      expect(format.createCollator({}, 'be').resolvedOptions().locale).toBe('ru')
    })
  })
})

describe('formatBelarusianDate parity with full ICU be-BY (#2283)', () => {
  // Наборы опций приложения (call site'ы formatDate/formatDateTime) плюс стили.
  const OPTION_SETS: Intl.DateTimeFormatOptions[] = [
    {},
    { day: 'numeric', month: 'short' },
    { day: 'numeric', month: 'short', year: 'numeric' },
    { day: 'numeric', month: 'long' },
    { day: 'numeric', month: 'long', year: 'numeric' },
    { month: 'long' },
    { month: 'long', year: 'numeric' },
    { month: 'short' },
    { weekday: 'short' },
    { weekday: 'long' },
    { weekday: 'short', day: 'numeric' },
    { weekday: 'long', day: 'numeric' },
    { weekday: 'short', day: 'numeric', month: 'long' },
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
    { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' },
    { hour: '2-digit', minute: '2-digit' },
    { hour: 'numeric', minute: '2-digit' },
    { hour: '2-digit', minute: '2-digit', second: '2-digit' },
    { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' },
    { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' },
    { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' },
    { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' },
    { day: '2-digit', month: '2-digit', year: 'numeric' },
    { day: 'numeric', month: 'numeric' },
    { year: 'numeric', month: 'numeric' },
    { year: '2-digit', month: '2-digit', day: '2-digit' },
    { year: 'numeric' },
    { dateStyle: 'full' },
    { dateStyle: 'long' },
    { dateStyle: 'medium' },
    { dateStyle: 'short' },
    { timeStyle: 'short' },
    { dateStyle: 'medium', timeStyle: 'short' },
    { dateStyle: 'long', timeStyle: 'short' },
    { dateStyle: 'full', timeStyle: 'short' },
    { dateStyle: 'short', timeStyle: 'short' },
  ]
  const DATES = Array.from({ length: 12 }, (_, month) => new Date(Date.UTC(2026, month, month + 3, 17, 4, 9)))
  const TIME_ZONES = [undefined, 'UTC', 'Europe/Minsk', 'America/New_York']

  it('matches Intl.DateTimeFormat("be-BY") for every app option set, month and zone', () => {
    const mismatches: string[] = []
    for (const timeZone of TIME_ZONES) {
      for (const base of OPTION_SETS) {
        const options = timeZone ? { ...base, timeZone } : base
        for (const date of DATES) {
          const expected = new Intl.DateTimeFormat('be-BY', options).format(date)
          const actual = formatBelarusianDate(date, options)
          if (actual !== expected) {
            mismatches.push(`${JSON.stringify(options)} ${date.toISOString()}: ${actual} != ${expected}`)
          }
        }
      }
    }
    expect(mismatches).toEqual([])
  })

  it('declines option sets it has no data for, so the caller can fall back', () => {
    expect(formatBelarusianDate(SAMPLE, { hour: 'numeric', hour12: true })).toBeNull()
    expect(formatBelarusianDate(SAMPLE, { era: 'long', year: 'numeric' })).toBeNull()
    expect(formatBelarusianDate(SAMPLE, { timeStyle: 'full' })).toBeNull()
    expect(formatBelarusianDate(SAMPLE, { dateStyle: 'short', day: 'numeric' })).toBeNull()
  })

  it('throws on an invalid date like Intl does', () => {
    expect(() => formatBelarusianDate(new Date(Number.NaN), { day: 'numeric' })).toThrow(RangeError)
  })
})
