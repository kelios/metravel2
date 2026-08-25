import type { SupportedLocale } from './config'
import { selectPluralCategory } from './pluralRules'

/**
 * CLDR relative-time data for the production locales, used only where the
 * engine has no `Intl.RelativeTimeFormat` (#1528).
 *
 * Hermes ships a reduced `Intl`: the Android release binary
 * (`lib/arm64-v8a/libhermesvm.so`) exposes only `Intl.Collator`,
 * `Intl.DateTimeFormat`, `Intl.NumberFormat` and `getCanonicalLocales`, while
 * `RelativeTimeFormat`, `PluralRules` and `ListFormat` are absent from the
 * binary entirely. `i18n/pluralRules.js` already re-implements the missing
 * plural rules for the same five locales; this module is the same move for the
 * missing relative-time data, so the canonical formatter can answer instead of
 * throwing.
 *
 * The values below are CLDR, extracted from ICU (`Intl.RelativeTimeFormat`)
 * for `ru-RU`/`be-BY`/`uk-UA`/`pl-PL`/`en-US`, so the fallback prints exactly
 * what a full-ICU engine prints. `__tests__/i18n/format.test.ts` holds that
 * parity: it compares this table against the native formatter wherever the
 * running engine has one.
 *
 * This is locale data, not app copy, which is why it lives next to the plural
 * rules instead of in the translation catalogues: nothing here is a phrase a
 * writer chooses.
 */

type RelativeTimeUnitKey =
  | 'second'
  | 'minute'
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year'

type RelativeTimeUnitForms = Partial<Record<Intl.LDMLPluralRule, string>> & {
  other: string
}

type LocaleRelativeTimeData = {
  /** `{{value}} {{unit}} назад` — the wrapper for a negative value. */
  past: string
  /** `через {{value}} {{unit}}` — the wrapper for a positive value. */
  future: string
  units: Record<RelativeTimeUnitKey, RelativeTimeUnitForms>
  /**
   * `numeric: 'auto'` phrases, keyed by the exact value CLDR names in words
   * («вчера», «на прошлой неделе»). A value without an entry falls through to
   * the numeric wrappers, which is what a full-ICU engine does too.
   */
  auto: Partial<Record<RelativeTimeUnitKey, Record<number, string>>>
}

const RELATIVE_TIME_DATA: Record<SupportedLocale, LocaleRelativeTimeData> = {
  ru: {
    past: '{{value}} {{unit}} назад',
    future: 'через {{value}} {{unit}}',
    units: {
      second: { one: 'секунду', few: 'секунды', many: 'секунд', other: 'секунды' },
      minute: { one: 'минуту', few: 'минуты', many: 'минут', other: 'минуты' },
      hour: { one: 'час', few: 'часа', many: 'часов', other: 'часа' },
      day: { one: 'день', few: 'дня', many: 'дней', other: 'дня' },
      week: { one: 'неделю', few: 'недели', many: 'недель', other: 'недели' },
      month: { one: 'месяц', few: 'месяца', many: 'месяцев', other: 'месяца' },
      quarter: { one: 'квартал', few: 'квартала', many: 'кварталов', other: 'квартала' },
      year: { one: 'год', few: 'года', many: 'лет', other: 'года' },
    },
    auto: {
      second: { 0: 'сейчас' },
      minute: { 0: 'в эту минуту' },
      hour: { 0: 'в этот час' },
      day: { [-2]: 'позавчера', [-1]: 'вчера', 0: 'сегодня', 1: 'завтра', 2: 'послезавтра' },
      week: { [-1]: 'на прошлой неделе', 0: 'на этой неделе', 1: 'на следующей неделе' },
      month: { [-1]: 'в прошлом месяце', 0: 'в этом месяце', 1: 'в следующем месяце' },
      quarter: { [-1]: 'в прошлом квартале', 0: 'в текущем квартале', 1: 'в следующем квартале' },
      year: { [-1]: 'в прошлом году', 0: 'в этом году', 1: 'в следующем году' },
    },
  },
  be: {
    past: '{{value}} {{unit}} таму',
    future: 'праз {{value}} {{unit}}',
    units: {
      second: { one: 'секунду', few: 'секунды', many: 'секунд', other: 'секунды' },
      minute: { one: 'хвіліну', few: 'хвіліны', many: 'хвілін', other: 'хвіліны' },
      hour: { one: 'гадзіну', few: 'гадзіны', many: 'гадзін', other: 'гадзіны' },
      day: { one: 'дзень', few: 'дні', many: 'дзён', other: 'дня' },
      week: { one: 'тыдзень', few: 'тыдні', many: 'тыдняў', other: 'тыдня' },
      month: { one: 'месяц', few: 'месяцы', many: 'месяцаў', other: 'месяца' },
      quarter: { one: 'квартал', few: 'кварталы', many: 'кварталаў', other: 'квартала' },
      year: { one: 'год', few: 'гады', many: 'гадоў', other: 'года' },
    },
    auto: {
      second: { 0: 'цяпер' },
      minute: { 0: 'у гэту хвіліну' },
      hour: { 0: 'у гэту гадзіну' },
      day: { [-2]: 'пазаўчора', [-1]: 'учора', 0: 'сёння', 1: 'заўтра', 2: 'паслязаўтра' },
      week: { [-1]: 'на мінулым тыдні', 0: 'на гэтым тыдні', 1: 'на наступным тыдні' },
      month: { [-1]: 'у мінулым месяцы', 0: 'у гэтым месяцы', 1: 'у наступным месяцы' },
      quarter: { [-1]: 'у мінулым квартале', 0: 'у гэтым квартале', 1: 'у наступным квартале' },
      year: { [-1]: 'у мінулым годзе', 0: 'у гэтым годзе', 1: 'у наступным годзе' },
    },
  },
  uk: {
    past: '{{value}} {{unit}} тому',
    future: 'через {{value}} {{unit}}',
    units: {
      second: { one: 'секунду', few: 'секунди', many: 'секунд', other: 'секунди' },
      minute: { one: 'хвилину', few: 'хвилини', many: 'хвилин', other: 'хвилини' },
      hour: { one: 'годину', few: 'години', many: 'годин', other: 'години' },
      day: { one: 'день', few: 'дні', many: 'днів', other: 'дня' },
      week: { one: 'тиждень', few: 'тижні', many: 'тижнів', other: 'тижня' },
      month: { one: 'місяць', few: 'місяці', many: 'місяців', other: 'місяця' },
      quarter: { one: 'квартал', few: 'квартали', many: 'кварталів', other: 'кварталу' },
      year: { one: 'рік', few: 'роки', many: 'років', other: 'року' },
    },
    auto: {
      second: { 0: 'зараз' },
      minute: { 0: 'цієї хвилини' },
      hour: { 0: 'цієї години' },
      day: { [-2]: 'позавчора', [-1]: 'учора', 0: 'сьогодні', 1: 'завтра', 2: 'післязавтра' },
      week: { [-1]: 'минулого тижня', 0: 'цього тижня', 1: 'наступного тижня' },
      month: { [-1]: 'минулого місяця', 0: 'цього місяця', 1: 'наступного місяця' },
      quarter: { [-1]: 'минулого кварталу', 0: 'цього кварталу', 1: 'наступного кварталу' },
      year: { [-1]: 'минулого року', 0: 'цього року', 1: 'наступного року' },
    },
  },
  pl: {
    past: '{{value}} {{unit}} temu',
    future: 'za {{value}} {{unit}}',
    units: {
      second: { one: 'sekundę', few: 'sekundy', many: 'sekund', other: 'sekundy' },
      minute: { one: 'minutę', few: 'minuty', many: 'minut', other: 'minuty' },
      hour: { one: 'godzinę', few: 'godziny', many: 'godzin', other: 'godziny' },
      day: { one: 'dzień', few: 'dni', many: 'dni', other: 'dnia' },
      week: { one: 'tydzień', few: 'tygodnie', many: 'tygodni', other: 'tygodnia' },
      month: { one: 'miesiąc', few: 'miesiące', many: 'miesięcy', other: 'miesiąca' },
      quarter: { one: 'kwartał', few: 'kwartały', many: 'kwartałów', other: 'kwartału' },
      year: { one: 'rok', few: 'lata', many: 'lat', other: 'roku' },
    },
    auto: {
      second: { 0: 'teraz' },
      minute: { 0: 'ta minuta' },
      hour: { 0: 'ta godzina' },
      day: { [-2]: 'przedwczoraj', [-1]: 'wczoraj', 0: 'dzisiaj', 1: 'jutro', 2: 'pojutrze' },
      week: { [-1]: 'w zeszłym tygodniu', 0: 'w tym tygodniu', 1: 'w przyszłym tygodniu' },
      month: { [-1]: 'w zeszłym miesiącu', 0: 'w tym miesiącu', 1: 'w przyszłym miesiącu' },
      quarter: { [-1]: 'w zeszłym kwartale', 0: 'w tym kwartale', 1: 'w przyszłym kwartale' },
      year: { [-1]: 'w zeszłym roku', 0: 'w tym roku', 1: 'w przyszłym roku' },
    },
  },
  en: {
    past: '{{value}} {{unit}} ago',
    future: 'in {{value}} {{unit}}',
    units: {
      second: { one: 'second', other: 'seconds' },
      minute: { one: 'minute', other: 'minutes' },
      hour: { one: 'hour', other: 'hours' },
      day: { one: 'day', other: 'days' },
      week: { one: 'week', other: 'weeks' },
      month: { one: 'month', other: 'months' },
      quarter: { one: 'quarter', other: 'quarters' },
      year: { one: 'year', other: 'years' },
    },
    auto: {
      second: { 0: 'now' },
      minute: { 0: 'this minute' },
      hour: { 0: 'this hour' },
      day: { [-1]: 'yesterday', 0: 'today', 1: 'tomorrow' },
      week: { [-1]: 'last week', 0: 'this week', 1: 'next week' },
      month: { [-1]: 'last month', 0: 'this month', 1: 'next month' },
      quarter: { [-1]: 'last quarter', 0: 'this quarter', 1: 'next quarter' },
      year: { [-1]: 'last year', 0: 'this year', 1: 'next year' },
    },
  },
}

/**
 * `Intl.RelativeTimeFormatUnit` accepts both `'day'` and `'days'`; the data
 * table is keyed by the singular.
 */
const normalizeUnit = (unit: Intl.RelativeTimeFormatUnit): RelativeTimeUnitKey =>
  (unit.endsWith('s') ? unit.slice(0, -1) : unit) as RelativeTimeUnitKey

/**
 * Локализованный ответ вместо исключения там, где движок не даёт
 * `Intl.RelativeTimeFormat`. Вызывается только из `formatRelativeTime`
 * (`i18n/format.ts`) — точки входа для нового кода остаётся одна.
 */
export const formatRelativeTimeFallback = (
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  options: Intl.RelativeTimeFormatOptions,
  locale: SupportedLocale,
  languageTag: string,
): string => {
  const data = RELATIVE_TIME_DATA[locale]
  const unitKey = normalizeUnit(unit)
  const forms = data.units[unitKey]

  if (!forms) return String(value)

  // ICU words the near band («вчера», «на прошлой неделе») and falls through to
  // the numeric wrappers for everything else — mirror both halves.
  if (options.numeric !== 'always') {
    const phrase = data.auto[unitKey]?.[value]
    if (phrase !== undefined) return phrase
  }

  const magnitude = Math.abs(value)
  // `selectPluralCategory` is the same Hermes-safe layer `selectPlural` uses;
  // calling it directly keeps this module free of a cycle back into
  // `i18n/format.ts`, which imports it.
  const category = selectPluralCategory(magnitude, languageTag)
  const unitLabel = forms[category] ?? forms.other
  const formattedValue =
    typeof Intl.NumberFormat === 'function'
      ? new Intl.NumberFormat(languageTag).format(magnitude)
      : String(magnitude)

  // `-0` is a past value for ICU («0 секунд назад»), so it cannot go through
  // `value < 0` alone.
  const wrapper = value < 0 || Object.is(value, -0) ? data.past : data.future
  return wrapper.replace('{{value}}', formattedValue).replace('{{unit}}', unitLabel)
}
