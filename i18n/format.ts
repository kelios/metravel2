import i18n from './instance'
import {
  DEFAULT_LOCALE,
  getLocaleDefinition,
  isSupportedLocale,
  type SupportedLocale,
} from './config'
import { selectPluralCategory } from './pluralRules'

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

export const formatCurrency = (
  value: number,
  currency: string,
  locale: SupportedLocale = getActiveLocale(),
): string => formatNumber(value, { style: 'currency', currency }, locale)

export const formatRelativeTime = (
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  options: Intl.RelativeTimeFormatOptions = { numeric: 'auto' },
  locale: SupportedLocale = getActiveLocale(),
): string => new Intl.RelativeTimeFormat(getFormatLocale(locale), options).format(value, unit)

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
