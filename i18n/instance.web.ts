import { DEFAULT_LOCALE, type SupportedLocale } from './config'
import type { i18n as I18nInstance } from 'i18next'

type LanguageChangedListener = (language: string) => void

const languageChangedListeners = new Set<LanguageChangedListener>()

const webI18n = {
  language: DEFAULT_LOCALE as string,
  resolvedLanguage: DEFAULT_LOCALE as string,
  async changeLanguage(locale: SupportedLocale): Promise<void> {
    this.language = locale
    this.resolvedLanguage = locale
    for (const listener of languageChangedListeners) listener(locale)
  },
  on(event: 'languageChanged', listener: LanguageChangedListener) {
    if (event === 'languageChanged') languageChangedListeners.add(listener)
    return this
  },
  off(event: 'languageChanged', listener: LanguageChangedListener) {
    if (event === 'languageChanged') languageChangedListeners.delete(listener)
    return this
  },
}

// TypeScript resolves platform suffixes while checking shared files, so the
// lightweight web implementation intentionally exposes the public i18next type.
// Web call sites only use the locale lifecycle subset implemented above; native
// resolves instance.ts and gets the full runtime.
export const i18n = webI18n as unknown as I18nInstance

export default i18n
