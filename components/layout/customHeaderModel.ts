import { Platform } from 'react-native'

import { METRICS } from '@/constants/layout'
import { isCompactHeaderWidth } from './headerLayoutContract'
import { needsGlobalBackAffordance } from './topLevelSections'

export const isHeaderTestEnv =
  typeof process !== 'undefined' && process.env?.JEST_WORKER_ID !== undefined

// Возвращаем width как есть — caller уже использует useWindowDimensions/useResponsive,
// которые hydration-safe (SSR + первый клиентский рендер возвращают одинаковый результат).
// Прямое чтение window.innerWidth здесь давало расхождение SSR→клиент и React error #418.
export const getEffectiveHeaderWidth = (width: number) => width

export const getIsHeaderMobile = (width: number, effectiveWebWidth: number) => {
  if (Platform.OS === 'web') {
    // The full navigation needs the desktop content width. At tablet and
    // large-tablet sizes it otherwise clips links while hiding the overflow.
    return isCompactHeaderWidth(effectiveWebWidth)
  }
  return width < METRICS.breakpoints.largeTablet
}

const ACTIVE_PATH_PREFIXES = ['/search', '/travelsby', '/export', '/map', '/places', '/trips', '/quests', '/roulette']

export const isQuestDetailHeaderPath = (pathname: string) =>
  /^\/quests\/[^/]+\/[^/]+\/?$/.test(pathname || '')

export const isTravelUpsertHeaderPath = (pathname: string) =>
  pathname === '/travel/new' || /^\/travel\/[^/]+\/?$/.test(pathname || '')

export const getHeaderActivePath = (pathname: string) => {
  if (pathname === '/' || pathname === '/index') return '/'
  if (pathname.startsWith('/travels/') || pathname.startsWith('/travel/')) return ''
  const match = ACTIVE_PATH_PREFIXES.find((p) => pathname.startsWith(p))
  return match ?? pathname
}

// Страницы, где HeaderContextBar свёрнут до JSON-LD (нет видимого бара), —
// это ровно то, что `needsGlobalBackAffordance` считает НЕ нуждающимся в
// глобальной строке возврата:
//  1) разделы верхней навигации — их идентичность уже есть в основном меню
//     (desktop) / доке (mobile), и «предыдущего» экрана у них нет. Набор берётся
//     из самой навигации (`topLevelSections.ts`), руками пути туда не дописываем:
//     #1725 — ровно про то, что рукописный список разошёлся с навигацией;
//  2) кабинетные коллекции с собственной шапкой (ProfileCollectionHeader:
//     заголовок + «Назад») — глобальный бар дублировал бы её (#799).
// Кабинетные без своей шапки (/settings, /messages, /subscriptions, /export, …),
// информационные/правовые (/about, /terms, …), экраны входа и /metravel строку
// возврата получают: попасть туда можно только переходом.
// Keep in sync with HeaderContextBar.tsx render branches.

export const shouldShowHeaderContextBar = (
  pathname: string,
  isMobile: boolean,
  hasFilterQuery: boolean = false,
) => {
  const isTravelDetailRoute = pathname.startsWith('/travels/')
  const isMapRoute = pathname === '/map' || pathname.startsWith('/map/')
  const isUserPointsRoute = pathname === '/userpoints'
  // Create/edit keeps desktop compact because TravelWizardHeader already owns
  // the wide-screen navigation. On mobile web and native the context row is the
  // breadcrumb trail requested for the wizard and must stay visible.
  if (isTravelUpsertHeaderPath(pathname)) {
    return Platform.OS !== 'web' || isMobile
  }

  if (Platform.OS !== 'web') {
    return true
  }

  // /userpoints — глобальный контекст-бар с крошками «Главная › Профиль › Мои точки»
  // на web (mobile + desktop); собственная шапка экрана (ProfileCollectionHeader) убрана.
  if (isUserPointsRoute) return true

  if (isMobile) {
    if (isTravelDetailRoute) return true
    if (isMapRoute) return false
    return needsGlobalBackAffordance(pathname, hasFilterQuery)
  }

  // Desktop: hidden on travel detail (own nav) and top-level sections (no breadcrumbs).
  if (isTravelDetailRoute) return false
  return needsGlobalBackAffordance(pathname, hasFilterQuery)
}
