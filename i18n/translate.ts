import { DEFAULT_LOCALE, FALLBACK_LOCALE } from './config'
import i18n from './instance'
import { selectPluralCategory } from './pluralRules'
import { resources, type TranslationKey, type TranslationParams } from './resources'

const missingTranslation = resources[FALLBACK_LOCALE].common['i18n.missingTranslation']
type RuntimeTranslateOptions = Record<string, unknown>
type RuntimeI18n = {
  exists: (key: string, options?: RuntimeTranslateOptions) => boolean
  t: (key: string, options?: RuntimeTranslateOptions) => unknown
  getFixedT: (locale: string) => (key: string, options?: RuntimeTranslateOptions) => unknown
}
const runtimeI18n = i18n as unknown as RuntimeI18n

export const hasTranslation = (key: TranslationKey): boolean => runtimeI18n.exists(key)

export const translate = (
  key: TranslationKey,
  params: TranslationParams = {},
): string => {
  if (!runtimeI18n.exists(key)) return missingTranslation
  return String(runtimeI18n.t(key, params))
}

export const getFixedTranslator = (locale = i18n.resolvedLanguage || DEFAULT_LOCALE) => {
  const fixed = runtimeI18n.getFixedT(locale)
  return (key: TranslationKey, params: TranslationParams = {}): string => {
    if (!runtimeI18n.exists(key, { lng: locale })) return missingTranslation
    return String(fixed(key, params))
  }
}

/**
 * Форму числа выбираем сами, а не отдаём i18next: у Hermes на Android может не
 * быть `Intl.PluralRules`, и тогда i18next сваливается в `other`. На устройстве
 * это давало «4 участников» там, где web через инлайнер печатал «4 участника».
 * `selectPluralCategory` — тот же селектор, что у web (`translate.web.ts`) и у
 * `format.ts`, поэтому три пути дают одну форму.
 */
export const translatePlural = (
  key: TranslationKey,
  count: number,
  params: TranslationParams = {},
): string => {
  const locale = i18n.resolvedLanguage || DEFAULT_LOCALE
  const category = selectPluralCategory(count, locale)
  const suffixed = `${key}_${category}` as TranslationKey
  if (runtimeI18n.exists(suffixed)) return translate(suffixed, { ...params, count })
  return translate(key, { ...params, count })
}
