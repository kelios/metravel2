export const DEFAULT_LOCALE = 'ru' as const
export const FALLBACK_LOCALE = DEFAULT_LOCALE

export const LOCALE_REGISTRY = {
  ru: {
    languageTag: 'ru-RU',
    htmlLang: 'ru',
    ogLocale: 'ru_RU',
    geocoderLanguage: 'ru',
    direction: 'ltr',
    displayNameKey: 'language.ru',
    urlPrefix: '',
  },
  pl: {
    languageTag: 'pl-PL',
    htmlLang: 'pl',
    ogLocale: 'pl_PL',
    geocoderLanguage: 'pl',
    direction: 'ltr',
    displayNameKey: 'language.pl',
    urlPrefix: '',
  },
  en: {
    languageTag: 'en-US',
    htmlLang: 'en',
    ogLocale: 'en_US',
    geocoderLanguage: 'en',
    direction: 'ltr',
    displayNameKey: 'language.en',
    urlPrefix: '',
  },
} as const

export type SupportedLocale = keyof typeof LOCALE_REGISTRY
export type LocaleDirection = (typeof LOCALE_REGISTRY)[SupportedLocale]['direction']

export const SUPPORTED_LOCALES = Object.freeze(
  Object.keys(LOCALE_REGISTRY) as SupportedLocale[],
)

export const isSupportedLocale = (value: unknown): value is SupportedLocale =>
  typeof value === 'string' && value in LOCALE_REGISTRY

export const resolveSupportedLocale = (
  candidates: ReadonlyArray<string | null | undefined>,
): SupportedLocale => {
  for (const candidate of candidates) {
    if (!candidate) continue
    const normalized = candidate.trim().toLowerCase().replace(/_/g, '-')
    const exact = SUPPORTED_LOCALES.find(
      (locale) => LOCALE_REGISTRY[locale].languageTag.toLowerCase() === normalized,
    )
    if (exact) return exact

    const language = normalized.split('-')[0]
    if (isSupportedLocale(language)) return language
  }

  return FALLBACK_LOCALE
}

type RuntimeLocale = {
  languageTag?: string | null
  languageCode?: string | null
}

const getExpoLocales = (): RuntimeLocale[] => {
  try {
    // Kept optional so SSR, Jest and partially configured native shells still
    // fall back to Intl instead of failing during module initialization.
    const localization = require('expo-localization') as {
      getLocales?: () => RuntimeLocale[]
    }
    return localization.getLocales?.() ?? []
  } catch {
    return []
  }
}

const getIntlLocale = (): string | null => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || null
  } catch {
    return null
  }
}

export const getSystemLocale = (): SupportedLocale => {
  const candidates: Array<RuntimeLocale[keyof RuntimeLocale]> = [
    ...getExpoLocales().flatMap((locale) => [locale.languageTag, locale.languageCode]),
    getIntlLocale(),
  ]
  return resolveSupportedLocale(candidates)
}

const getDocumentLocale = (): string | null => {
  if (typeof document === 'undefined') return null
  return document.documentElement?.lang || null
}

const isReactNativeRuntime = (): boolean =>
  typeof navigator !== 'undefined' && navigator.product === 'ReactNative'

/**
 * Keeps the first web render deterministic across static SSR and hydration.
 * A persisted/system preference is intentionally applied by LocaleProvider
 * after hydration; native has no server markup and may start from the device
 * locale immediately.
 */
export const getInitialLocale = (): SupportedLocale => {
  const documentLocale = getDocumentLocale()
  if (documentLocale) return resolveSupportedLocale([documentLocale])
  if (isReactNativeRuntime()) return getSystemLocale()
  return DEFAULT_LOCALE
}

export const getLocaleDefinition = (locale: SupportedLocale = DEFAULT_LOCALE) =>
  LOCALE_REGISTRY[locale]

export const hasMultipleProductionLocales = SUPPORTED_LOCALES.length > 1
