// `import()` каталога работает через загрузчик чанков Expo (`__loadBundleAsync`),
// а его ставит побочный эффект модуля `expo` (Expo.fx), который обычно
// исполняется внутри `expo-router/entry`. `prepareBootLocale` вызывается раньше —
// без этого импорта загрузка каталога падала мгновенно, и гидратация шла
// по-русски (проверено на прод-сборке).
import 'expo'

import { isSupportedLocale, DEFAULT_LOCALE, type SupportedLocale } from './config'
import i18n from './instance'
import { readWebLocalePreferenceSync, resolveLocalePreference } from './localeStorage'
import { loadWebLocale } from './translate'

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

/** Сохранённая локаль, которую нужно применить при старте, или `null`. */
export const resolvePendingBootLocale = (): SupportedLocale | null => {
  const storedPreference = readWebLocalePreferenceSync()
  if (!storedPreference) return null
  const target = resolveLocalePreference(storedPreference)
  return target === normalizeActiveLocale(i18n.resolvedLanguage) ? null : target
}

/**
 * Начинает загрузку каталога сохранённой локали. Возвращает промис, который
 * не отклоняется (ошибка и таймаут = русский интерфейс), или `null`, если
 * загружать нечего.
 */
export const prepareBootLocale = (): Promise<void> | null => {
  const target = resolvePendingBootLocale()
  if (!target) return null
  return new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, BOOT_LOCALE_TIMEOUT_MS)
    const finish = () => {
      clearTimeout(timeout)
      resolve()
    }
    loadWebLocale(target).then(finish, finish)
  })
}
