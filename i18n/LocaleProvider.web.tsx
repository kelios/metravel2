import React, { createContext, Suspense, use, useCallback, useEffect, useMemo, useState } from 'react'

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
  readWebLocalePreferenceSync,
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

/**
 * Загрузка сохранённой локали при старте не перемонтирует приложение (#2239,
 * `I18N-LOCALE-BOOT-REMOUNT-001`).
 *
 * Статический HTML всегда русский (#938: первый клиентский кадр равен ему), а
 * ~800 модулей зовут `translate` прямо в рендере и не подписаны на смену языка.
 * Поэтому смена языка перемонтирует поддерево ключом `legacyRenderRevision` —
 * и раньше это случалось и на старте: дерево гидратировалось по-русски, экраны
 * отправляли стартовые запросы, затем ключ размонтировал всё и запросы уходили
 * второй раз.
 *
 * Теперь, если сохранённая локаль не совпадает с активной, поддерево на время
 * загрузки её каталога остаётся НЕгидратированным: граница `Suspense` держит
 * серверный HTML как есть (без расхождения разметки и без эффектов), а когда
 * каталог готов, смена ключа заменяет её свежим деревом уже на нужном языке —
 * одно монтирование. Если на границу до этого придёт обновление сверху
 * (контекст родителя), React отрисует её клиентом с `fallback` — это те же
 * дети, то есть прежнее поведение с двумя монтированиями, но без пустого кадра.
 * Явная смена языка пользователем по-прежнему перемонтирует поддерево.
 */
const BOOT_LOCALE_PENDING: Promise<never> = new Promise(() => {})

/** Сколько держать статический HTML, если каталог локали не грузится. */
export const BOOT_LOCALE_TIMEOUT_MS = 3000

const readPendingBootLocale = (): SupportedLocale | null => {
  const storedPreference = readWebLocalePreferenceSync()
  if (!storedPreference) return null
  const target = resolveLocalePreference(storedPreference)
  return target === normalizeActiveLocale(i18n.resolvedLanguage) ? null : target
}

function BootLocaleGate({ pending }: { pending: boolean }) {
  if (pending) use(BOOT_LOCALE_PENDING)
  return null
}

const BootLocaleBoundary = React.memo(
  function BootLocaleBoundary({
    pending,
    children,
  }: {
    pending: boolean
    children: React.ReactNode
  }) {
    return (
      <Suspense fallback={children}>
        <BootLocaleGate pending={pending} />
        {children}
      </Suspense>
    )
  },
  // Пока граница ждёт локаль, новые `children` от родителя ей не передаются:
  // обновление пропсов негидратированной границы заставило бы React отрисовать
  // её клиентом раньше времени. Свежие дети придут вместе со сменой ключа.
  (previous, next) => previous.pending && next.pending,
)

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(() =>
    normalizeActiveLocale(i18n.resolvedLanguage),
  )
  const [preference, setPreference] = useState<LocalePreference>(DEFAULT_LOCALE_PREFERENCE)
  const [isHydrated, setIsHydrated] = useState(false)
  const [legacyRenderRevision, setLegacyRenderRevision] = useState(0)
  // На сервере `window` нет — разметка всегда полная; на клиенте граница лишь
  // откладывает гидратацию, разметку она не меняет.
  const [isBootPending, setIsBootPending] = useState(() => readPendingBootLocale() !== null)

  useEffect(() => {
    let cancelled = false
    let released = false
    const releaseBootGate = () => {
      if (released) return
      released = true
      setIsBootPending(false)
    }
    const bootTimeout = setTimeout(releaseBootGate, BOOT_LOCALE_TIMEOUT_MS)

    void readLocalePreference().then(async (storedPreference) => {
      if (cancelled) return
      const nextLocale = resolveLocalePreference(storedPreference)
      try {
        if (nextLocale !== normalizeActiveLocale(i18n.resolvedLanguage)) {
          await loadWebLocale(nextLocale)
          if (cancelled) return
          // Снятие ворот и смена ключа (обработчик `languageChanged`) идут одним
          // синхронным блоком — одним рендером, без промежуточной гидратации.
          releaseBootGate()
          await i18n.changeLanguage(nextLocale)
        }
      } catch {
        // Каталог не загрузился — остаётся русский интерфейс.
      } finally {
        clearTimeout(bootTimeout)
        if (!cancelled) releaseBootGate()
      }
      if (cancelled) return
      const activeLocale = normalizeActiveLocale(i18n.resolvedLanguage)
      setPreference(storedPreference)
      setLocaleState(activeLocale)
      syncDocumentLocale(activeLocale)
      setIsHydrated(true)
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
      <BootLocaleBoundary key={legacyRenderRevision} pending={isBootPending}>
        {children}
      </BootLocaleBoundary>
    </LocaleContext.Provider>
  )
}

export const useLocale = (): LocaleContextValue => {
  const value = React.useContext(LocaleContext)
  if (!value) throw new Error('useLocale must be used inside LocaleProvider')
  return value
}

export const useTranslation = () => ({ t: translate, i18n, ready: true })
