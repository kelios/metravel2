import 'i18next'

import { DEFAULT_NAMESPACE, type TranslationResources } from '@/i18n/resources'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof DEFAULT_NAMESPACE
    resources: TranslationResources
    returnNull: false
    strictKeyChecks: true
    enableSelector: 'optimize'
  }
}
