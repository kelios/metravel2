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

export const getLocaleDisplayName = (locale: SupportedLocale): string =>
  translate(LOCALE_DISPLAY_NAME_KEYS[locale])
