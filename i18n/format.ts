import i18n from './instance'
import {
  DEFAULT_LOCALE,
  getLocaleDefinition,
  isSupportedLocale,
  type SupportedLocale,
} from './config'
import { selectPluralCategory } from './pluralRules'
import { formatRelativeTimeFallback } from './relativeTimeFallback'

export const getActiveLocale = (): SupportedLocale =>
  isSupportedLocale(i18n.resolvedLanguage) ? i18n.resolvedLanguage : DEFAULT_LOCALE

export const getActiveLocaleDefinition = () => getLocaleDefinition(getActiveLocale())

export const getFormatLocale = (locale: SupportedLocale = getActiveLocale()): string =>
  getLocaleDefinition(locale).languageTag

export const formatDate = (
  value: Date | number | string,
  options: Intl.DateTimeFormatOptions = {},
  locale: SupportedLocale = getActiveLocale(),
): string => new Intl.DateTimeFormat(getFormatLocale(locale), options).format(new Date(value))

export const formatDateTime = (
  value: Date | number | string,
  options: Intl.DateTimeFormatOptions = {},
  locale: SupportedLocale = getActiveLocale(),
): string =>
  formatDate(
    value,
    {
      dateStyle: 'medium',
      timeStyle: 'short',
      ...options,
    },
    locale,
  )

export const formatNumber = (
  value: number,
  options: Intl.NumberFormatOptions = {},
  locale: SupportedLocale = getActiveLocale(),
): string => new Intl.NumberFormat(getFormatLocale(locale), options).format(value)

export const formatInteger = (
  value: number,
  locale: SupportedLocale = getActiveLocale(),
): string => formatNumber(value, { maximumFractionDigits: 0 }, locale)

/**
 * С какого значения счётчик печатается компактно. Ниже порога компактная форма
 * не экономит место («999» короче «0,9 тыс.»), поэтому число идёт целым.
 */
export const COMPACT_NUMBER_THRESHOLD = 1000

/**
 * Канонический компактный счётчик (#1457): единицу выбирает локаль, а не
 * хардкод — русскому пользователю «1,2 тыс.», а не английское «1.2K».
 * Новое место, где печатается компактное число, должно звать его, а не
 * собирать строку на месте.
 */
export const formatCompactNumber = (
  value: number,
  options: Intl.NumberFormatOptions = {},
  locale: SupportedLocale = getActiveLocale(),
): string =>
  Math.abs(value) < COMPACT_NUMBER_THRESHOLD
    ? formatNumber(value, { maximumFractionDigits: 0, ...options }, locale)
    : formatNumber(
        value,
        { notation: 'compact', maximumFractionDigits: 1, ...options },
        locale,
      )

export const formatCurrency = (
  value: number,
  currency: string,
  locale: SupportedLocale = getActiveLocale(),
): string => formatNumber(value, { style: 'currency', currency }, locale)

/**
 * Канонический относительный формат (#1528). `Intl.RelativeTimeFormat` есть не
 * во всех движках: Hermes в Android-релизе его не содержит вовсе, поэтому
 * безусловный `new` уводил экран в error boundary. Защита живёт здесь, в самом
 * экспорте, как у `formatList` и `selectPlural` ниже, — новому коду достаточно
 * позвать эту функцию, отдельная проверка на месте вызова не нужна.
 */
export const formatRelativeTime = (
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  options: Intl.RelativeTimeFormatOptions = { numeric: 'auto' },
  locale: SupportedLocale = getActiveLocale(),
): string => {
  if (typeof Intl.RelativeTimeFormat === 'function') {
    return new Intl.RelativeTimeFormat(getFormatLocale(locale), options).format(value, unit)
  }
  return formatRelativeTimeFallback(value, unit, options, locale, getFormatLocale(locale))
}

export const formatList = (
  values: readonly string[],
  options: Intl.ListFormatOptions = { style: 'long', type: 'conjunction' },
  locale: SupportedLocale = getActiveLocale(),
): string => {
  if (typeof Intl.ListFormat === 'function') {
    return new Intl.ListFormat(getFormatLocale(locale), options).format(values)
  }
  return values.join(', ')
}

export const createCollator = (
  options: Intl.CollatorOptions = {},
  locale: SupportedLocale = getActiveLocale(),
): Intl.Collator => new Intl.Collator(getFormatLocale(locale), options)

export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & {
  other: string
}

export const selectPlural = (
  count: number,
  forms: PluralForms,
  locale: SupportedLocale = getActiveLocale(),
): string => {
  const category = selectPluralCategory(count, getFormatLocale(locale))
  return forms[category] ?? forms.other
}
