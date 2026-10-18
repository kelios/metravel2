import {
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  getLocaleDefinition,
  isSupportedLocale,
  type SupportedLocale,
} from './config'
import i18n from './instance'
import { selectPluralCategory } from './pluralRules'
import type { TranslationKey, TranslationParams } from './resources'
import type { CompiledPluralForms, LoadedTranslation } from './catalogCompiler'
export { compileLocaleCatalog, hashTranslationKey } from './catalogCompiler'

type CompiledTranslation =
  | string
  | {
      h: number
      v: string
      p?: CompiledPluralForms
    }

const MISSING_TRANSLATIONS: Record<SupportedLocale, string> = {
  ru: 'Перевод недоступен',
  be: 'Пераклад недаступны',
  uk: 'Переклад недоступний',
  pl: 'Tłumaczenie niedostępne',
  en: 'Translation not available',
}
const TRANSLATION_KEY_PATTERN = /^[a-z][a-zA-Z]*:[\w.-]+$/
const loadedCatalogs = new Map<SupportedLocale, Map<number, LoadedTranslation>>()
const localeLoadPromises = new Map<SupportedLocale, Promise<void>>()

export const loadWebLocale = async (locale: SupportedLocale): Promise<void> => {
  if (locale === FALLBACK_LOCALE || loadedCatalogs.has(locale)) return
  const existing = localeLoadPromises.get(locale)
  if (existing) return existing

  const promise = (async () => {
    let catalog: Map<number, LoadedTranslation>
    switch (locale) {
      case 'be':
        catalog = (await import('./deferred/locale-be')).beCatalog
        break
      case 'uk':
        catalog = (await import('./deferred/locale-uk')).ukCatalog
        break
      case 'en':
        catalog = (await import('./deferred/locale-en')).enCatalog
        break
      default:
        catalog = (await import('./deferred/locale-pl')).plCatalog
    }
    loadedCatalogs.set(locale, catalog)
  })()
  localeLoadPromises.set(locale, promise)

  try {
    await promise
  } finally {
    localeLoadPromises.delete(locale)
  }
}

/** Каталог локали уже в памяти — её можно применить синхронно. */
export const isWebLocaleLoaded = (locale: SupportedLocale): boolean =>
  locale === FALLBACK_LOCALE || loadedCatalogs.has(locale)

const normalizeLocale = (locale: string | undefined): SupportedLocale =>
  isSupportedLocale(locale) ? locale : FALLBACK_LOCALE

const selectTemplate = (
  translation: CompiledTranslation,
  params: TranslationParams,
  locale: SupportedLocale,
): string => {
  if (typeof translation === 'string') {
    return TRANSLATION_KEY_PATTERN.test(translation)
      ? MISSING_TRANSLATIONS[locale]
      : translation
  }

  const loaded = locale === FALLBACK_LOCALE
    ? undefined
    : loadedCatalogs.get(locale)?.get(translation.h)
  const base = loaded?.value ?? translation.v
  const count = Number(params.count)
  if (!Number.isFinite(count)) return base

  const forms = loaded?.plurals ?? translation.p
  if (!forms) return base
  const category = selectPluralCategory(count, getLocaleDefinition(locale).languageTag)
  return forms[category] ?? forms.other ?? base
}

const interpolate = (template: string, params: TranslationParams): string =>
  template.replace(/\{\{\s*([^}\s]+)\s*\}\}/g, (match, name: string) => {
    const value = params[name]
    return value === null || value === undefined ? match : String(value)
  })

export const hasTranslation = (
  translation: TranslationKey | CompiledTranslation,
): boolean =>
  typeof translation !== 'string' || !TRANSLATION_KEY_PATTERN.test(translation)

export const translate = (
  translation: TranslationKey | CompiledTranslation,
  params: TranslationParams = {},
): string => {
  const locale = normalizeLocale(i18n.resolvedLanguage)
  return interpolate(selectTemplate(translation, params, locale), params)
}

export const getFixedTranslator = (
  locale = i18n.resolvedLanguage || DEFAULT_LOCALE,
) => {
  const fixedLocale = normalizeLocale(locale)
  return (
    translation: TranslationKey | CompiledTranslation,
    params: TranslationParams = {},
  ): string => interpolate(selectTemplate(translation, params, fixedLocale), params)
}

export const translatePlural = (
  translation: TranslationKey | CompiledTranslation,
  count: number,
  params: TranslationParams = {},
): string => translate(translation, { ...params, count })
