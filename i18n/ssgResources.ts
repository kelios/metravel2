/**
 * SSG-only translation resources (#2399).
 *
 * Strings that only the SSG generator (`scripts/generate-seo-pages.js`) prints
 * live in `i18n/locales/<locale>/ssg/*_ssg.ts` under a `…Ssg` namespace.
 * `i18n/resources.ts` never imports them, so they never reach the client locale
 * chunks or the native bundle; the generator reads them through
 * `loadSsgCatalogs` in `i18n/babel-inline-plugin.js`. This module exists for the
 * type contract and for catalog tests only — application code must not import it
 * (`__tests__/i18n/ssgOnlyResources.test.ts`).
 */
import { ssgOnlyResources as beSsgOnly } from './locales/be/ssg'
import { ssgOnlyResources as enSsgOnly } from './locales/en/ssg'
import { ssgOnlyResources as plSsgOnly } from './locales/pl/ssg'
import { ssgOnlyResources as ruSsgOnly } from './locales/ru/ssg'
import { ssgOnlyResources as ukSsgOnly } from './locales/uk/ssg'
import { resources } from './resources'

type SsgOnlyResourceContract = {
  readonly [N in keyof typeof ruSsgOnly]: {
    readonly [K in keyof (typeof ruSsgOnly)[N]]: string
  }
}

/** Missing SSG-only namespaces or keys in any locale are a compile-time error. */
const defineSsgOnlyResources = <T extends SsgOnlyResourceContract>(locale: T): T => locale

export const ssgOnlyResources = {
  ru: defineSsgOnlyResources(ruSsgOnly),
  be: defineSsgOnlyResources(beSsgOnly),
  uk: defineSsgOnlyResources(ukSsgOnly),
  pl: defineSsgOnlyResources(plSsgOnly),
  en: defineSsgOnlyResources(enSsgOnly),
} as const

/** Every catalog any surface prints: runtime resources plus SSG-only ones. */
export const catalogResources = {
  ru: { ...resources.ru, ...ssgOnlyResources.ru },
  be: { ...resources.be, ...ssgOnlyResources.be },
  uk: { ...resources.uk, ...ssgOnlyResources.uk },
  pl: { ...resources.pl, ...ssgOnlyResources.pl },
  en: { ...resources.en, ...ssgOnlyResources.en },
} as const
