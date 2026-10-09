import { AsyncLocalStorage } from 'node:async_hooks'
import { DEFAULT_LOCALE, isSupportedLocale, type SupportedLocale } from '../../i18n/config'
import type { BookSettingsLocale } from '../../types/bookSettings'

const locales = new AsyncLocalStorage<SupportedLocale>()

/** A job's locale must never leak into a concurrent job or the app singleton. */
export function withWorkerLocale<T>(locale: BookSettingsLocale | SupportedLocale, run: () => T): T {
  const normalized = locale.toLowerCase()
  if (!isSupportedLocale(normalized)) throw new Error(`Unsupported worker locale: ${locale}`)
  return locales.run(normalized, run)
}

export const getWorkerLocale = (): SupportedLocale => locales.getStore() ?? DEFAULT_LOCALE

/** Build-time replacement for i18n/instance; canonical formatters need only this getter. */
export const i18n = Object.freeze({ get resolvedLanguage() { return getWorkerLocale() } })
export default i18n
