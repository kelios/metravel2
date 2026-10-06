import React, {
  createContext,
  Suspense,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { BOOT_LOCALE_TIMEOUT_MS, normalizeActiveLocale, resolvePendingBootLocale } from './bootLocale'
import { getLocaleDefinition, SUPPORTED_LOCALES, type SupportedLocale } from './config'
import i18n from './instance'
import {
  DEFAULT_LOCALE_PREFERENCE,
  readLocalePreference,
  resolveLocalePreference,
  SYSTEM_LOCALE_PREFERENCE,
  writeLocalePreference,
  type LocalePreference,
} from './localeStorage'
import { isWebLocaleLoaded, loadWebLocale, translate } from './translate'
import { claimLocaleBootRecovery, releaseLocaleBootShell } from './localeBootShell'
import { getBootLocaleRecoveryCopy } from './bootLocaleRecoveryCopy'

type LocaleContextValue = {
  locale: SupportedLocale
  preference: LocalePreference
  supportedLocales: readonly SupportedLocale[]
  isHydrated: boolean
  setLocale: (locale: SupportedLocale) => Promise<void>
  useSystemLocale: () => Promise<void>
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

const syncDocumentLocale = (locale: SupportedLocale) => {
  if (typeof document === 'undefined') return
  const definition = getLocaleDefinition(locale)
  document.documentElement.lang = definition.htmlLang
  document.documentElement.dir = definition.direction
}

/**
 * The RU SSG tree hydrates deterministically, but the head bootstrap hides it
 * for a persisted non-RU preference until the final locale commit (#2327).
 * Catalogue preloading before Expo hydration plus the suspended boundary keep
 * screens mounted once (#2239). A null fallback prevents outer-context changes
 * from mounting a temporary Russian tree. Slow/failed boot exposes localized
 * recovery controls; choosing RU invalidates any older pending completion.
 * Explicit language switches after boot retain the legacy subtree revision.
 */
const BOOT_LOCALE_PENDING: Promise<never> = new Promise(() => {})

export { BOOT_LOCALE_TIMEOUT_MS }

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
      <Suspense fallback={null}>
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
  const [bootLocale] = useState(resolvePendingBootLocale)
  const [isBootPending, setIsBootPending] = useState(bootLocale !== null)
  const [bootRecovery, setBootRecovery] = useState<'loading' | 'slow' | 'failed'>('loading')
  const bootAbandoned = useRef(false)

  // The head recovery owns failures before React arrives. Hand off in the first
  // commit, before catalogue effects can fail and render our recovery controls.
  useLayoutEffect(() => {
    claimLocaleBootRecovery()
  }, [])

  // Reveal only a committed tree in its final boot locale. No reveal timer:
  // a slow catalogue must not mount Russian screens and send requests twice.
  useLayoutEffect(() => {
    if (!isBootPending) releaseLocaleBootShell()
  }, [isBootPending, locale])

  // Подписка — в layout effect, чтобы смена языка ниже уже меняла ключ.
  useLayoutEffect(() => {
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

  // Каталог загружен до гидратации: снятие ворот и смена ключа — в том же
  // синхронном рендере, что идёт сразу за коммитом гидратации, до того как
  // эффекты провайдеров выше (кадр окна, навигация) сменят их контексты.
  useLayoutEffect(() => {
    if (!bootLocale || !isWebLocaleLoaded(bootLocale)) return
    setIsBootPending(false)
    void i18n.changeLanguage(bootLocale)
  }, [bootLocale])

  useEffect(() => {
    let cancelled = false
    let released = false
    const releaseBootGate = () => {
      if (released) return
      released = true
      setIsBootPending(false)
    }
    // This timer displays recovery controls; it never reveals Russian screens.
    const recoveryTimeout = setTimeout(() => {
      if (!cancelled) setBootRecovery('slow')
    }, BOOT_LOCALE_TIMEOUT_MS)

    void readLocalePreference().then(async (storedPreference) => {
      if (cancelled) return
      const nextLocale = resolveLocalePreference(storedPreference)
      let failed = false
      try {
        if (nextLocale !== normalizeActiveLocale(i18n.resolvedLanguage)) {
          await loadWebLocale(nextLocale)
          if (cancelled || bootAbandoned.current) return
          // Снятие ворот и смена ключа (обработчик `languageChanged`) идут одним
          // синхронным блоком — одним рендером, без промежуточной гидратации.
          releaseBootGate()
          await i18n.changeLanguage(nextLocale)
        }
      } catch {
        failed = true
        if (!cancelled) setBootRecovery('failed')
      } finally {
        clearTimeout(recoveryTimeout)
        if (!cancelled && !failed) releaseBootGate()
      }
      if (failed) return
      if (cancelled) return
      const activeLocale = normalizeActiveLocale(i18n.resolvedLanguage)
      setPreference(storedPreference)
      setLocaleState(activeLocale)
      syncDocumentLocale(activeLocale)
      setIsHydrated(true)
    })
    return () => {
      cancelled = true
      clearTimeout(recoveryTimeout)
    }
  }, [])

  const setLocale = useCallback(async (nextLocale: SupportedLocale) => {
    const nextPreference: LocalePreference = { version: 1, mode: 'explicit', locale: nextLocale }
    if (!isWebLocaleLoaded(nextLocale)) await loadWebLocale(nextLocale)
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
  const recoveryCopy = getBootLocaleRecoveryCopy(bootLocale ?? locale)

  return (
    <LocaleContext.Provider value={value}>
      {isBootPending && bootRecovery !== 'loading' && (
        <div id="locale-boot-recovery" lang={bootLocale ?? locale}>
          <p role="status">{bootRecovery === 'failed' ? recoveryCopy.failed : recoveryCopy.slow}</p>
          <button type="button" onClick={() => window.location.reload()}>{recoveryCopy.retry}</button>
          <button type="button" onClick={() => {
            bootAbandoned.current = true
            void setLocale('ru').then(() => {
              setIsHydrated(true)
              setIsBootPending(false)
            })
          }}>{recoveryCopy.fallback}</button>
        </div>
      )}
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
