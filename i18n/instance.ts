import { createInstance } from 'i18next'
import { initReactI18next } from 'react-i18next'

import {
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  getInitialLocale,
  SUPPORTED_LOCALES,
} from './config'
import { DEFAULT_NAMESPACE, resources } from './resources'

const missingTranslation = resources[FALLBACK_LOCALE].common['i18n.missingTranslation']

export const i18n = createInstance()

void i18n.use(initReactI18next).init({
  resources,
  lng: getInitialLocale() || DEFAULT_LOCALE,
  fallbackLng: FALLBACK_LOCALE,
  supportedLngs: SUPPORTED_LOCALES,
  defaultNS: DEFAULT_NAMESPACE,
  fallbackNS: DEFAULT_NAMESPACE,
  ns: Object.keys(resources[FALLBACK_LOCALE]),
  keySeparator: false,
  nsSeparator: ':',
  returnNull: false,
  returnEmptyString: false,
  initAsync: false,
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
  parseMissingKeyHandler: () => missingTranslation,
})

export default i18n
