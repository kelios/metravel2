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
import { usePathname } from 'expo-router'
import { parseQuestLocaleRoute } from '@/utils/questLocaleRouting'

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
 * Canonical translated quest URLs preload/commit their own locale instead;
 * SPA transitions suspend before any screen mounts in the previous locale.
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
  const pathname = usePathname()
  const route = parseQuestLocaleRoute(pathname)
  const routeLocale = route?.locale ?? null
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
  // Navigation can change the route before an effect commits its language.
  // Suspend that render immediately, so new screens cannot request the old
  // locale. Entering/leaving a URL-bound page never persists a preference.
  const targetLocale = routeLocale ?? (isHydrated ? resolveLocalePreference(preference) : bootLocale)
  const isRoutePending = targetLocale !== null && (
    locale !== targetLocale || (routeLocale !== null && !isWebLocaleLoaded(targetLocale))
  )
  const pending = isBootPending || isRoutePending

  // The head recovery owns failures before React arrives. Hand off in the first
  // commit, before catalogue effects can fail and render our recovery controls.
  useLayoutEffect(() => {
    claimLocaleBootRecovery()
  }, [])

  // Reveal only a committed tree in its final boot locale. No reveal timer:
  // a slow catalogue must not mount Russian screens and send requests twice.
  useLayoutEffect(() => {
    if (!pending) releaseLocaleBootShell()
  }, [pending, locale])

  // Подписка — в layout effect, чтобы смена языка ниже уже меняла ключ.
  useLayoutEffect(() => {
    const handleLanguageChanged = (language: string) => {
      const nextLocale = normalizeActiveLocale(language)
      setLocaleState(nextLocale)
      syncDocumentLocale(routeLocale ?? nextLocale)
      setLegacyRenderRevision((revision) => revision + 1)
    }

    i18n.on('languageChanged', handleLanguageChanged)
    syncDocumentLocale(routeLocale ?? locale)
    return () => {
      i18n.off('languageChanged', handleLanguageChanged)
    }
  }, [locale, routeLocale])

  // Каталог загружен до гидратации: снятие ворот и смена ключа — в том же
  // синхронном рендере, что идёт сразу за коммитом гидратации, до того как
  // эффекты провайдеров выше (кадр окна, навигация) сменят их контексты.
  useLayoutEffect(() => {
    if (!bootLocale || !isWebLocaleLoaded(bootLocale)) return
    setIsBootPending(false)
    void i18n.changeLanguage(bootLocale)
  }, [bootLocale])

  useEffect(() => {
    bootAbandoned.current = false
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

    setBootRecovery('loading')
    void readLocalePreference().then(async (storedPreference) => {
      if (cancelled) return
      const nextLocale = routeLocale ?? resolveLocalePreference(storedPreference)
      let failed = false
      try {
        if (nextLocale !== normalizeActiveLocale(i18n.resolvedLanguage) || !isWebLocaleLoaded(nextLocale)) {
          if (!isWebLocaleLoaded(nextLocale)) await loadWebLocale(nextLocale)
          if (cancelled || bootAbandoned.current) return
          // Снятие ворот и смена ключа (обработчик `languageChanged`) идут одним
          // синхронным блоком — одним рендером, без промежуточной гидратации.
          releaseBootGate()
          if (nextLocale !== normalizeActiveLocale(i18n.resolvedLanguage)) {
            await i18n.changeLanguage(nextLocale)
          }
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
      syncDocumentLocale(routeLocale ?? activeLocale)
      setIsHydrated(true)
    })
    return () => {
      cancelled = true
      clearTimeout(recoveryTimeout)
    }
  }, [routeLocale])

  const setLocale = useCallback(async (nextLocale: SupportedLocale) => {
    const nextPreference: LocalePreference = { version: 1, mode: 'explicit', locale: nextLocale }
    if (!isWebLocaleLoaded(nextLocale)) await loadWebLocale(nextLocale)
    await writeLocalePreference(nextPreference)
    setPreference(nextPreference)
    // A language control persists an explicit choice, then navigates to its
    // canonical link. Never replace a PL URL's content with EN in between.
    if (!routeLocale) await i18n.changeLanguage(nextLocale)
  }, [routeLocale])

  const useSystemLocale = useCallback(async () => {
    const nextLocale = resolveLocalePreference(SYSTEM_LOCALE_PREFERENCE)
    await loadWebLocale(nextLocale)
    await writeLocalePreference(SYSTEM_LOCALE_PREFERENCE)
    setPreference(SYSTEM_LOCALE_PREFERENCE)
    if (!routeLocale) await i18n.changeLanguage(nextLocale)
  }, [routeLocale])

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
  const recoveryLocale = targetLocale ?? locale
  const recoveryCopy = getBootLocaleRecoveryCopy(recoveryLocale)

  return (
    <LocaleContext.Provider value={value}>
      {pending && bootRecovery !== 'loading' && (
        <div id="locale-boot-recovery" lang={recoveryLocale} data-url-locale={route ? 'true' : undefined}>
          <p role="status">{bootRecovery === 'failed' ? recoveryCopy.failed : recoveryCopy.slow}</p>
          <button type="button" onClick={() => window.location.reload()}>{recoveryCopy.retry}</button>
          {route ? (
            <a href={`/quests/${route.cityId}/${route.questSlug}`}>{recoveryCopy.fallback}</a>
          ) : <button type="button" onClick={() => {
            bootAbandoned.current = true
            void setLocale('ru').then(() => {
              setIsHydrated(true)
              setIsBootPending(false)
            })
          }}>{recoveryCopy.fallback}</button>}
        </div>
      )}
      <BootLocaleBoundary key={legacyRenderRevision} pending={pending}>
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
