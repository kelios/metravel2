import { Platform } from 'react-native'

import { METRICS } from '@/constants/layout'

export const isHeaderTestEnv =
  typeof process !== 'undefined' && process.env?.JEST_WORKER_ID !== undefined

// Возвращаем width как есть — caller уже использует useWindowDimensions/useResponsive,
// которые hydration-safe (SSR + первый клиентский рендер возвращают одинаковый результат).
// Прямое чтение window.innerWidth здесь давало расхождение SSR→клиент и React error #418.
export const getEffectiveHeaderWidth = (width: number) => width

export const getIsHeaderMobile = (width: number, effectiveWebWidth: number) => {
  if (Platform.OS === 'web') {
    return effectiveWebWidth < METRICS.breakpoints.tablet
  }
  return width < METRICS.breakpoints.largeTablet
}

const ACTIVE_PATH_PREFIXES = ['/search', '/travelsby', '/export', '/map', '/places', '/trips', '/quests', '/roulette']

export const isQuestDetailHeaderPath = (pathname: string) =>
  /^\/quests\/[^/]+\/[^/]+\/?$/.test(pathname || '')

export const getHeaderActivePath = (pathname: string) => {
  if (pathname === '/' || pathname === '/index') return '/'
  if (pathname.startsWith('/travels/') || pathname.startsWith('/travel/')) return ''
  const match = ACTIVE_PATH_PREFIXES.find((p) => pathname.startsWith(p))
  return match ?? pathname
}

// Страницы, где HeaderContextBar свёрнут до JSON-LD (нет видимого бара):
//  1) верхняя навигация — её идентичность уже есть в основном меню (desktop) / доке (mobile);
//  2) кабинетные экраны с собственной шапкой (ProfileCollectionHeader: заголовок + «Назад»)
//     — глобальный контекст-бар/крошки дублировали бы её.
// Кабинетные без своей шапки (/settings, /messages, /subscriptions, /export, …) и
// информационные/правовые (/about, /terms, …) страницы тут СПЕЦИАЛЬНО отсутствуют —
// на них показываются хлебные крошки (см. useBreadcrumbModel).
// Keep in sync with HeaderContextBar.tsx render branches.
const TOP_LEVEL_PATHS_NO_CONTEXT_BAR = new Set<string>([
  '/',
  '/index',
  '/search',
  '/travelsby',
  '/places',
  '/trips',
  '/roulette',
  '/quests',
  '/favorites',
  '/history',
  '/calendar',
  '/profile',
])

export const shouldShowHeaderContextBar = (pathname: string, isMobile: boolean) => {
  const isTravelDetailRoute = pathname.startsWith('/travels/')
  const isMapRoute = pathname === '/map' || pathname.startsWith('/map/')
  const isUserPointsRoute = pathname === '/userpoints'
  // /travel/new и /travel/{id} — визард с собственной шапкой (TravelWizardHeader).
  // Глобальный контекст-бар дублирует её навигацию и оставляет пустую полосу.
  const isTravelUpsertRoute = pathname.startsWith('/travel/')

  if (Platform.OS !== 'web') {
    if (isTravelUpsertRoute) return false
    return true
  }

  // /userpoints — глобальный контекст-бар с крошками «Главная › Профиль › Мои точки»
  // на web (mobile + desktop); собственная шапка экрана (ProfileCollectionHeader) убрана.
  if (isUserPointsRoute) return true

  if (isMobile) {
    if (isTravelDetailRoute) return true
    if (isMapRoute) return false
    if (TOP_LEVEL_PATHS_NO_CONTEXT_BAR.has(pathname)) return false
    return true
  }

  // Desktop: hidden on travel detail (own nav) and top-level tabs (no breadcrumbs).
  if (isTravelDetailRoute) return false
  if (TOP_LEVEL_PATHS_NO_CONTEXT_BAR.has(pathname)) return false
  return true
}
