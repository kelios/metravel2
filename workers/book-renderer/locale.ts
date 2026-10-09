import { FALLBACK_LOCALE, resolveSupportedLocale, type SupportedLocale } from '../../i18n/config'
import { selectPluralCategory } from '../../i18n/pluralRules'
import { resources, type TranslationKey, type TranslationParams } from '../../i18n/resources'
import { getWorkerLocale } from './localeInstance'

export { DEFAULT_LOCALE, FALLBACK_LOCALE, LOCALE_REGISTRY, SUPPORTED_LOCALES,
  getLocaleDefinition, resolveSupportedLocale, type SupportedLocale } from '../../i18n/config'
export { formatDate, formatDateTime, formatNumber, formatInteger, formatCurrency,
  formatList, formatRelativeTime, getActiveLocale, getFormatLocale, selectPlural,
  createCollator } from '../../i18n/format'
export { i18n, withWorkerLocale, getWorkerLocale } from './localeInstance'
export type { TranslationKey, TranslationParams } from '../../i18n/resources'

type Catalog = Record<string, Record<string, string>>
const catalogs = resources as unknown as Record<SupportedLocale, Catalog>

function template(key: string, locale: SupportedLocale, count?: number): string | undefined {
  const colon = key.indexOf(':')
  const namespace = colon < 0 ? 'common' : key.slice(0, colon)
  const name = colon < 0 ? key : key.slice(colon + 1)
  const active = catalogs[locale][namespace]
  const fallback = catalogs[FALLBACK_LOCALE][namespace]
  const names = Number.isFinite(count)
    ? [`${name}_${selectPluralCategory(count!, locale)}`, `${name}_other`, name]
    : [name]
  for (const catalog of [active, fallback]) {
    for (const candidate of names) {
      const value = catalog?.[candidate]
      if (value) return value
    }
  }
  return undefined
}

function translateFor(locale: SupportedLocale, key: TranslationKey, params: TranslationParams): string {
  const count = params.count === undefined ? undefined : Number(params.count)
  const text = template(key, locale, count) ?? catalogs[FALLBACK_LOCALE].common['i18n.missingTranslation']
  return text.replace(/\{\{\s*([^}\s]+)\s*\}\}/g, (match, name: string) => {
    const value = params[name]
    return value === null || value === undefined ? match : String(value)
  })
}

export const hasTranslation = (key: TranslationKey): boolean => template(key, getWorkerLocale()) !== undefined
export const translate = (key: TranslationKey, params: TranslationParams = {}): string =>
  translateFor(getWorkerLocale(), key, params)
export const translatePlural = (key: TranslationKey, count: number, params: TranslationParams = {}): string =>
  translate(key, { ...params, count })
export const getFixedTranslator = (locale: string = getWorkerLocale()) => {
  const fixed = resolveSupportedLocale([locale])
  return (key: TranslationKey, params: TranslationParams = {}): string => translateFor(fixed, key, params)
}
