import { Platform } from 'react-native'

import { isPrintAvailable } from '@/utils/printAvailability'

/** Экран управления cookie-согласием сайта. */
export const COOKIE_SETTINGS_ROUTE = '/cookies'

/** Каталог PDF-книги путешествий. */
export const BOOK_EXPORT_ROUTE = '/export'

/**
 * Маршруты, на которые внутри native-приложения не ведёт ни одна навигационная
 * поверхность: меню аккаунта, мобильное меню шапки, «Ещё» нижнего дока, ссылки
 * экранов «О проекте» и «Контакты». Единая политика вместо `Platform.OS`-проверок
 * в каждом списке пунктов.
 *
 * - `/cookies`: настройки cookie-согласия сайта. В приложении нет cookies и
 *   веб-аналитики, а cookie-UI в приложении App Review читает как трекинг без ATT
 *   (отказ 5.1.2(i) от 25.09.2026, #2135). Сам экран по прямой ссылке на native
 *   говорит, что приложение не использует cookies и не отслеживает пользователя.
 */
export const WEB_ONLY_NAV_ROUTES: readonly string[] = [COOKIE_SETTINGS_ROUTE]

/**
 * Маршруты, которым в приложении нужен системный диалог печати. PDF-книга
 * собирается на всех платформах (#2119), но печатать её в приложении можно только
 * сборкой с модулем `expo-print`: в старой сборке без него пункта нет, а не
 * «пункт есть, печать недоступна». До #2119 `/export` был веб-только (#495).
 */
export const PRINT_NAV_ROUTES: readonly string[] = [BOOK_EXPORT_ROUTE]

const toRoutePath = (route: unknown): string => {
  const raw =
    typeof route === 'string'
      ? route
      : route && typeof route === 'object' && typeof (route as { pathname?: unknown }).pathname === 'string'
        ? (route as { pathname: string }).pathname
        : ''
  const [pathname] = raw.split(/[?#]/)
  return pathname.replace(/\/+$/, '') || '/'
}

/** Показывать ли на текущей платформе пункт навигации, ведущий на `route`. */
export function isNavRouteAvailable(route: unknown, os: string = Platform.OS): boolean {
  if (os === 'web') return true
  const path = toRoutePath(route)
  if (WEB_ONLY_NAV_ROUTES.includes(path)) return false
  if (PRINT_NAV_ROUTES.includes(path)) return isPrintAvailable()
  return true
}

/**
 * Показывать ли вход в каталог PDF-книги на данной поверхности.
 *
 * На сайте книга — десктопная функция: из мобильных поверхностей (гамбургер,
 * док, плитка профиля) вход убран решением владельца от 01.07.2026, и это здесь
 * не меняется. В приложении печать идёт системным диалогом (AirPrint, «Сохранить
 * как PDF»), поэтому вход есть на любом размере экрана — когда есть модуль печати.
 */
export function isBookExportEntryVisible(
  { isDesktopSurface }: { isDesktopSurface: boolean },
  os: string = Platform.OS,
): boolean {
  return os === 'web' ? isDesktopSurface : isNavRouteAvailable(BOOK_EXPORT_ROUTE, os)
}
