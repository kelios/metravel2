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

type BootCatalogEntry = [number, LoadedTranslation]
type BundleLoader = (bundlePath: unknown) => Promise<void>

declare global {
  // Written by `locale-<lang>-boot-*.js` (scripts/lib/expoStaticShell.js).
  var __METRAVEL_BOOT_CATALOGS__: Partial<Record<SupportedLocale, BootCatalogEntry[]>> | undefined
}

// `import()` starts the chunk request synchronously, before the first `await`.
const importFullCatalog = async (locale: SupportedLocale): Promise<Map<number, LoadedTranslation>> => {
  switch (locale) {
    case 'be':
      return (await import('./deferred/locale-be')).beCatalog
    case 'uk':
      return (await import('./deferred/locale-uk')).ukCatalog
    case 'en':
      return (await import('./deferred/locale-en')).enCatalog
    default:
      return (await import('./deferred/locale-pl')).plCatalog
  }
}

const takeBootCatalog = (locale: SupportedLocale): Map<number, LoadedTranslation> | null => {
  const catalogs = globalThis.__METRAVEL_BOOT_CATALOGS__
  const entries = catalogs?.[locale]
  if (!Array.isArray(entries)) return null
  delete catalogs![locale]
  return new Map(entries)
}

// Expo's chunk loader (`expo/src/async-require`) is read from this global on
// every `import()`. Chunks the document did not ship wait for the complete
// catalogue: only the keys of the shipped chunks are in the boot subset.
const holdLazyChunksUntil = (ready: Promise<void>) => {
  const scope = globalThis as unknown as Record<string, BundleLoader | string | undefined>
  const prefix = typeof scope.__METRO_GLOBAL_PREFIX__ === 'string' ? scope.__METRO_GLOBAL_PREFIX__ : ''
  const key = `${prefix}__loadBundleAsync`
  const load = scope[key]
  if (typeof load !== 'function') return
  const held: BundleLoader = (bundlePath) => Promise.all([load(bundlePath), ready]).then(() => undefined)
  scope[key] = held
  void ready.then(() => {
    if (scope[key] === held) scope[key] = load
  })
}

export const loadWebLocale = async (locale: SupportedLocale): Promise<void> => {
  if (locale === FALLBACK_LOCALE || loadedCatalogs.has(locale)) return
  const existing = localeLoadPromises.get(locale)
  if (existing) return existing

  const boot = takeBootCatalog(locale)
  const promise = importFullCatalog(locale).then((catalog) => {
    loadedCatalogs.set(locale, catalog)
  })
  if (boot) {
    // #2484: a translated quest document ships the keys of its own chunks
    // instead of the whole catalogue (~115 KB brotli on the critical path).
    // The complete one follows; until it lands, lazy chunks wait for it, and a
    // failed load keeps the subset (missing keys show their Russian source).
    loadedCatalogs.set(locale, boot)
    const settled = promise.catch(() => undefined)
    holdLazyChunksUntil(settled)
    return
  }
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
