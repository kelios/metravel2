import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { I18nextProvider, useTranslation } from 'react-i18next'

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

type LocaleContextValue = {
  locale: SupportedLocale
  preference: LocalePreference
  supportedLocales: readonly SupportedLocale[]
  isHydrated: boolean
  setLocale: (locale: SupportedLocale) => Promise<void>
  useSystemLocale: () => Promise<void>
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

/** Сколько ждать сохранённое предпочтение языка до монтирования приложения. */
const BOOT_LOCALE_TIMEOUT_MS = 3000

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
  const [preference, setPreference] = useState<LocalePreference>(
    DEFAULT_LOCALE_PREFERENCE,
  )
  const [isHydrated, setIsHydrated] = useState(false)
  const [legacyRenderRevision, setLegacyRenderRevision] = useState(0)
  // #2239: дерево приложения монтируется, когда сохранённая локаль уже
  // применена. Раньше оно монтировалось на системном языке, а смена языка из
  // AsyncStorage перемонтировала его ключом — экраны слали стартовые запросы
  // дважды. Native не гидратирует серверный HTML, поэтому достаточно не
  // монтировать детей до чтения предпочтения (сплэш ещё на экране).
  const [isBootReady, setIsBootReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    // Зависшее хранилище не должно держать приложение на сплэше.
    const bootTimeout = setTimeout(() => setIsBootReady(true), BOOT_LOCALE_TIMEOUT_MS)

    void readLocalePreference().then(async (storedPreference) => {
      if (cancelled) return
      const nextLocale = resolveLocalePreference(storedPreference)
      try {
        if (nextLocale !== normalizeActiveLocale(i18n.resolvedLanguage)) {
          await i18n.changeLanguage(nextLocale)
        }
      } catch {
        // Язык не переключился — остаётся системный.
      } finally {
        clearTimeout(bootTimeout)
      }
      if (cancelled) return
      const activeLocale = normalizeActiveLocale(i18n.resolvedLanguage)
      setPreference(storedPreference)
      setLocaleState(activeLocale)
      syncDocumentLocale(activeLocale)
      setIsHydrated(true)
      setIsBootReady(true)
    })

    return () => {
      cancelled = true
      clearTimeout(bootTimeout)
    }
  }, [])

  useEffect(() => {
    const handleLanguageChanged = (language: string) => {
      const nextLocale = normalizeActiveLocale(language)
      setLocaleState(nextLocale)
      syncDocumentLocale(nextLocale)
      // Existing non-hook call sites are remounted during the migration. New code
      // should use useTranslation(), which updates without a subtree remount.
      setLegacyRenderRevision((revision) => revision + 1)
    }

    i18n.on('languageChanged', handleLanguageChanged)
    syncDocumentLocale(locale)
    return () => {
      i18n.off('languageChanged', handleLanguageChanged)
    }
  }, [locale])

  const setLocale = useCallback(async (nextLocale: SupportedLocale) => {
    const nextPreference: LocalePreference = {
      version: 1,
      mode: 'explicit',
      locale: nextLocale,
    }
    await writeLocalePreference(nextPreference)
    setPreference(nextPreference)
    await i18n.changeLanguage(nextLocale)
  }, [])

  const useSystemLocale = useCallback(async () => {
    await writeLocalePreference(SYSTEM_LOCALE_PREFERENCE)
    setPreference(SYSTEM_LOCALE_PREFERENCE)
    await i18n.changeLanguage(resolveLocalePreference(SYSTEM_LOCALE_PREFERENCE))
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
    <I18nextProvider i18n={i18n}>
      <LocaleContext.Provider value={value}>
        {isBootReady ? (
          <React.Fragment key={legacyRenderRevision}>{children}</React.Fragment>
        ) : null}
      </LocaleContext.Provider>
    </I18nextProvider>
  )
}

export const useLocale = (): LocaleContextValue => {
  const value = React.useContext(LocaleContext)
  if (!value) throw new Error('useLocale must be used inside LocaleProvider')
  return value
}

export { useTranslation }
