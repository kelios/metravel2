import { beResources } from './locales/be'
import { enResources } from './locales/en'
import { plResources } from './locales/pl'
import { ruResources } from './locales/ru'
import { ukResources } from './locales/uk'

export const DEFAULT_NAMESPACE = 'common' as const

export type LocaleResourceContract = {
  readonly [N in keyof typeof ruResources]: {
    readonly [K in keyof (typeof ruResources)[N]]: string
  }
}

/**
 * Apply this helper to every future locale bundle. It makes missing namespaces
 * and keys a compile-time error while keeping each locale's string literals.
 */
export const defineLocaleResources = <T extends LocaleResourceContract>(locale: T): T => locale

const typedRuResources = defineLocaleResources(ruResources)
const typedBeResources = defineLocaleResources(beResources)
const typedUkResources = defineLocaleResources(ukResources)
const typedPlResources = defineLocaleResources(plResources)
const typedEnResources = defineLocaleResources(enResources)

export const resources = {
  ru: typedRuResources,
  be: typedBeResources,
  uk: typedUkResources,
  pl: typedPlResources,
  en: typedEnResources,
} as const

export type TranslationResources = LocaleResourceContract
export type TranslationNamespace = keyof TranslationResources

type NamespaceKey<N extends TranslationNamespace> = Extract<keyof TranslationResources[N], string>

export type TranslationKey = {
  [N in TranslationNamespace]: `${N}:${NamespaceKey<N>}`
}[TranslationNamespace]

export type TranslationParams = Record<string, string | number | boolean | null | undefined>
