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

type CompiledPluralForms = Partial<Record<Intl.LDMLPluralRule, string>>

type CompiledTranslation =
  | string
  | {
      h: number
      v: string
      p?: CompiledPluralForms
    }

type LocaleResources = Record<string, Record<string, string>>
type LoadedTranslation = { value: string; plurals?: CompiledPluralForms }

const MISSING_TRANSLATIONS: Record<SupportedLocale, string> = {
  ru: 'Перевод недоступен',
  be: 'Пераклад недаступны',
  uk: 'Переклад недоступний',
  pl: 'Tłumaczenie niedostępne',
  en: 'Translation not available',
}
const TRANSLATION_KEY_PATTERN = /^[a-z][a-zA-Z]*:[\w.-]+$/
const PLURAL_SUFFIX_PATTERN = /_(zero|one|two|few|many|other)$/
const loadedCatalogs = new Map<SupportedLocale, Map<number, LoadedTranslation>>()
const localeLoadPromises = new Map<SupportedLocale, Promise<void>>()

export const hashTranslationKey = (key: string): number => {
  let hash = 0x811c9dc5
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

const compileLocaleCatalog = (resources: LocaleResources): Map<number, LoadedTranslation> => {
  const catalog = new Map<number, LoadedTranslation>()

  for (const [namespace, entries] of Object.entries(resources)) {
    for (const [key, value] of Object.entries(entries)) {
      const suffixMatch = key.match(PLURAL_SUFFIX_PATTERN)
      const baseKey = suffixMatch ? key.slice(0, -suffixMatch[0].length) : key
      const hasBase = Object.prototype.hasOwnProperty.call(entries, baseKey)
      const translationKey = `${namespace}:${hasBase ? baseKey : key}`
      const hash = hashTranslationKey(translationKey)
      const current = catalog.get(hash) ?? {
        value: hasBase ? entries[baseKey] : value,
      }

      if (suffixMatch && hasBase) {
        current.plurals = {
          ...current.plurals,
          [suffixMatch[1]]: value,
        }
      } else {
        current.value = value
      }
      catalog.set(hash, current)
    }
  }

  return catalog
}

export const loadWebLocale = async (locale: SupportedLocale): Promise<void> => {
  if (locale === FALLBACK_LOCALE || loadedCatalogs.has(locale)) return
  const existing = localeLoadPromises.get(locale)
  if (existing) return existing

  const promise = (async () => {
    let resources: LocaleResources
    switch (locale) {
      case 'be':
        resources = (await import('./deferred/locale-be')).beResources
        break
      case 'uk':
        resources = (await import('./deferred/locale-uk')).ukResources
        break
      case 'en':
        resources = (await import('./deferred/locale-en')).enResources
        break
      default:
        resources = (await import('./deferred/locale-pl')).plResources
    }
    loadedCatalogs.set(locale, compileLocaleCatalog(resources))
  })()
  localeLoadPromises.set(locale, promise)

  try {
    await promise
  } finally {
    localeLoadPromises.delete(locale)
  }
}

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
