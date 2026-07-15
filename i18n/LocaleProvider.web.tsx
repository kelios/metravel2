import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react'

import {
  DEFAULT_LOCALE,
  getLocaleDefinition,
  isSupportedLocale,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from './config'
import i18n from './instance'
import {
  DEFAULT_LOCALE_PREFERENCE,
  readLocalePreference,
  resolveLocalePreference,
  SYSTEM_LOCALE_PREFERENCE,
  writeLocalePreference,
  type LocalePreference,
} from './localeStorage'
import { loadWebLocale, translate } from './translate'

type LocaleContextValue = {
  locale: SupportedLocale
  preference: LocalePreference
  supportedLocales: readonly SupportedLocale[]
  isHydrated: boolean
  setLocale: (locale: SupportedLocale) => Promise<void>
  useSystemLocale: () => Promise<void>
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

const normalizeActiveLocale = (value: string | undefined): SupportedLocale =>
  isSupportedLocale(value) ? value : DEFAULT_LOCALE

const syncDocumentLocale = (locale: SupportedLocale) => {
  if (typeof document === 'undefined') return
  const definition = getLocaleDefinition(locale)
  document.documentElement.lang = definition.htmlLang
  document.documentElement.dir = definition.direction
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(() =>
    normalizeActiveLocale(i18n.resolvedLanguage),
  )
  const [preference, setPreference] = useState<LocalePreference>(DEFAULT_LOCALE_PREFERENCE)
  const [isHydrated, setIsHydrated] = useState(false)
  const [legacyRenderRevision, setLegacyRenderRevision] = useState(0)

  useEffect(() => {
    let cancelled = false
    void readLocalePreference().then(async (storedPreference) => {
      if (cancelled) return
      const nextLocale = resolveLocalePreference(storedPreference)
      setPreference(storedPreference)
      if (nextLocale !== normalizeActiveLocale(i18n.resolvedLanguage)) {
        await loadWebLocale(nextLocale)
        await i18n.changeLanguage(nextLocale)
      }
      if (cancelled) return
      setLocaleState(nextLocale)
      syncDocumentLocale(nextLocale)
      setIsHydrated(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const handleLanguageChanged = (language: string) => {
      const nextLocale = normalizeActiveLocale(language)
      setLocaleState(nextLocale)
      syncDocumentLocale(nextLocale)
      setLegacyRenderRevision((revision) => revision + 1)
    }

    i18n.on('languageChanged', handleLanguageChanged)
    syncDocumentLocale(locale)
    return () => {
      i18n.off('languageChanged', handleLanguageChanged)
    }
  }, [locale])

  const setLocale = useCallback(async (nextLocale: SupportedLocale) => {
    const nextPreference: LocalePreference = { version: 1, mode: 'explicit', locale: nextLocale }
    await loadWebLocale(nextLocale)
    await writeLocalePreference(nextPreference)
    setPreference(nextPreference)
    await i18n.changeLanguage(nextLocale)
  }, [])

  const useSystemLocale = useCallback(async () => {
    const nextLocale = resolveLocalePreference(SYSTEM_LOCALE_PREFERENCE)
    await loadWebLocale(nextLocale)
    await writeLocalePreference(SYSTEM_LOCALE_PREFERENCE)
    setPreference(SYSTEM_LOCALE_PREFERENCE)
    await i18n.changeLanguage(nextLocale)
  }, [])

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      preference,
      supportedLocales: SUPPORTED_LOCALES,
      isHydrated,
      setLocale,
      useSystemLocale,
    }),
    [isHydrated, locale, preference, setLocale, useSystemLocale],
  )

  return (
    <LocaleContext.Provider value={value}>
      <React.Fragment key={legacyRenderRevision}>{children}</React.Fragment>
    </LocaleContext.Provider>
  )
}

export const useLocale = (): LocaleContextValue => {
  const value = React.useContext(LocaleContext)
  if (!value) throw new Error('useLocale must be used inside LocaleProvider')
  return value
}

export const useTranslation = () => ({ t: translate, i18n, ready: true })
