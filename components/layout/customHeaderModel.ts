import { Platform } from 'react-native'

import { METRICS } from '@/constants/layout'

export const isHeaderTestEnv =
  typeof process !== 'undefined' && process.env?.JEST_WORKER_ID !== undefined

export const getEffectiveHeaderWidth = (width: number) => {
  if (Platform.OS !== 'web') return width
  if (!isHeaderTestEnv && typeof window !== 'undefined' && window.innerWidth > 0) {
    return window.innerWidth
  }

  return width
}

export const getIsHeaderMobile = (width: number, effectiveWebWidth: number) => {
  if (Platform.OS === 'web') {
    return effectiveWebWidth < METRICS.breakpoints.tablet
  }

  return width < METRICS.breakpoints.largeTablet
}

export const getHeaderActivePath = (pathname: string) => {
  if (pathname === '/' || pathname === '/index') return '/'
  if (pathname.startsWith('/travels/')) return ''
  if (pathname.startsWith('/travel/')) return ''
  if (pathname.startsWith('/search')) return '/search'
  if (pathname.startsWith('/travelsby')) return '/travelsby'
  if (pathname.startsWith('/export')) return '/export'
  if (pathname.startsWith('/map')) return '/map'
  if (pathname.startsWith('/quests')) return '/quests'
  if (pathname.startsWith('/roulette')) return '/roulette'

  return pathname
}

// Paths where HeaderContextBar renders no visible content (returns just JSON-LD).
// Keeping this list in sync with HeaderContextBar.tsx render branches lets
// CustomHeader skip reserving header space for these pages and avoid CLS.
const TOP_LEVEL_PATHS_NO_CONTEXT_BAR = new Set<string>([
  '/',
  '/index',
  '/search',
  '/travelsby',
  '/roulette',
  '/quests',
  '/favorites',
  '/history',
  '/settings',
  '/messages',
  '/subscriptions',
  '/about',
  '/privacy',
  '/cookies',
])

export const shouldShowHeaderContextBar = (
  pathname: string,
  isMobile: boolean,
) => {
  if (Platform.OS !== 'web') return true

  const isTravelDetailRoute = pathname.startsWith('/travels/')
  const isTravelEditRoute = pathname.startsWith('/travel/')
  const isMapRoute = pathname === '/map' || pathname.startsWith('/map/')
  const isUserPointsRoute = pathname === '/userpoints'

  if (isMobile) {
    // Mobile renders the bar (with back/sections actions) for these routes.
    if (isMapRoute || isUserPointsRoute) return true
    if (isTravelDetailRoute) return true
    // Top-level tabs render null on mobile (no back, no action) — don't reserve.
    if (TOP_LEVEL_PATHS_NO_CONTEXT_BAR.has(pathname)) return false
    return !isTravelEditRoute ? true : true
  }

  // Desktop: bar hidden on travel detail (has its own nav) and on top-level
  // tabs (no breadcrumbs to render → component returns null).
  if (isTravelDetailRoute) return false
  if (TOP_LEVEL_PATHS_NO_CONTEXT_BAR.has(pathname)) return false
  return true
}
