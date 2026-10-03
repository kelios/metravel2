import { Platform } from 'react-native'

/** Экран управления cookie-согласием сайта. */
export const COOKIE_SETTINGS_ROUTE = '/cookies'

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
 * - `/export`: PDF-книга путешествий собирается только на web (#495).
 */
export const WEB_ONLY_NAV_ROUTES: readonly string[] = [COOKIE_SETTINGS_ROUTE, '/export']

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
  return !WEB_ONLY_NAV_ROUTES.includes(toRoutePath(route))
}
