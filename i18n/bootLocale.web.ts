// `import()` каталога работает через загрузчик чанков Expo (`__loadBundleAsync`),
// а его ставит побочный эффект модуля `expo` (Expo.fx), который обычно
// исполняется внутри `expo-router/entry`. `prepareBootLocale` вызывается раньше —
// без этого импорта загрузка каталога падала мгновенно, и гидратация шла
// по-русски (проверено на прод-сборке).
import 'expo'

import { isSupportedLocale, DEFAULT_LOCALE, type SupportedLocale } from './config'
import i18n from './instance'
import { readWebLocalePreferenceSync, resolveLocalePreference } from './localeStorage'
import { isWebLocaleLoaded, loadWebLocale } from './translate'
import { parseQuestLocaleRoute } from '@/utils/questLocaleRouting'

/**
 * Каталог сохранённой локали — до гидратации (#2239, `I18N-LOCALE-BOOT-REMOUNT-001`).
 *
 * Статический HTML всегда русский (#938), поэтому `LocaleProvider` держит своё
 * поддерево негидратированным (граница `Suspense`), пока не применит сохранённую
 * локаль, и ставит дерево сразу на нужном языке. Но негидратированная граница
 * переживает только рендеры без смены контекста выше неё: на любую смену React
 * отрисовывает её клиентом с `fallback`. Над приложением стоят провайдеры
 * expo-router — `SafeAreaProvider` (кадр окна) и состояние навигации, — и их
 * значения меняются в первые же миллисекунды после гидратации. Если каталог
 * грузится после гидратации, поддерево успевает смонтироваться по-русски и
 * отправить стартовые запросы, а после загрузки каталога монтируется второй раз.
 *
 * Поэтому `entry.js` вызывает `prepareBootLocale()` ДО `expo-router/entry`:
 * гидратация начинается, когда каталог уже в памяти, и провайдер применяет
 * локаль синхронно сразу после коммита гидратации (layout effect), раньше
 * любых эффектов провайдеров выше. Русскому интерфейсу и посетителю без
 * сохранённой локали ждать нечего — `null`, гидратация без задержки.
 */

/** Сколько ждать каталог локали до гидратации и сколько держать статический HTML. */
export const BOOT_LOCALE_TIMEOUT_MS = 3000

export const normalizeActiveLocale = (value: string | undefined): SupportedLocale =>
  isSupportedLocale(value) ? value : DEFAULT_LOCALE

/** URL-локаль детали либо сохранённая локаль, ожидающая boot commit. */
export const resolvePendingBootLocale = (): SupportedLocale | null => {
  // Only canonical, allowlisted quest details bind the UI to their URL. Other
  // sections retain the established preference-driven boot lifecycle.
  const routeLocale = typeof window === 'undefined'
    ? null
    : parseQuestLocaleRoute(window.location.pathname)?.locale
  if (routeLocale) {
    return routeLocale === normalizeActiveLocale(i18n.resolvedLanguage) && isWebLocaleLoaded(routeLocale)
      ? null
      : routeLocale
  }
  const storedPreference = readWebLocalePreferenceSync()
  if (!storedPreference) return null
  const target = resolveLocalePreference(storedPreference)
  return target === normalizeActiveLocale(i18n.resolvedLanguage) ? null : target
}

/**
 * Preload before Expo hydration. A quest prefix additionally commits its URL
 * locale, matching translated SSG. The promise never rejects: on timeout/error
 * the provider keeps its boundary pending and exposes localized recovery.
 */
export const prepareBootLocale = (): Promise<void> | null => {
  const routeLocale = typeof window === 'undefined'
    ? null
    : parseQuestLocaleRoute(window.location.pathname)?.locale
  const target = resolvePendingBootLocale()
  if (!target) return null
  return new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, BOOT_LOCALE_TIMEOUT_MS)
    const finish = () => {
      clearTimeout(timeout)
      resolve()
    }
    loadWebLocale(target).then(async () => {
      // A prefix can receive the legacy RU 404 document while translated
      // serving is disabled. Only translated HTML may commit before hydration;
      // fallback HTML uses the pending boundary and commits after hydration.
      if (routeLocale && parseQuestLocaleRoute(window.location.pathname)?.locale === routeLocale
        && typeof document !== 'undefined' && document.documentElement.lang === routeLocale
        && normalizeActiveLocale(i18n.resolvedLanguage) !== routeLocale) {
        await i18n.changeLanguage(routeLocale)
      }
      finish()
    }, finish).catch(finish)
  })
}
