import type { SupportedLocale } from './config'
import { translate } from './translate'
import type { TranslationKey } from './resources'

const LOCALE_DISPLAY_NAME_KEYS: Record<SupportedLocale, TranslationKey> = {
  ru: 'common:language.ru',
  be: 'common:language.be',
  uk: 'common:language.uk',
  pl: 'common:language.pl',
  en: 'common:language.en',
}

const LOCALE_DISPLAY_CODES: Record<SupportedLocale, string> = {
  ru: 'RU',
  be: 'BY',
  uk: 'UK',
  pl: 'PL',
  en: 'EN',
}

export const getLocaleDisplayName = (locale: SupportedLocale): string =>
  translate(LOCALE_DISPLAY_NAME_KEYS[locale])

export const getLocaleDisplayCode = (locale: SupportedLocale): string =>
  LOCALE_DISPLAY_CODES[locale]
