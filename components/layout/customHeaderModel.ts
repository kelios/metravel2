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

const ACTIVE_PATH_PREFIXES = ['/search', '/travelsby', '/export', '/map', '/quests', '/roulette']

export const getHeaderActivePath = (pathname: string) => {
  if (pathname === '/' || pathname === '/index') return '/'
  if (pathname.startsWith('/travels/') || pathname.startsWith('/travel/')) return ''
  const match = ACTIVE_PATH_PREFIXES.find((p) => pathname.startsWith(p))
  return match ?? pathname
}

// Top-level tabs where HeaderContextBar renders no visible content (JSON-LD only).
// Keep in sync with HeaderContextBar.tsx render branches.
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

export const shouldShowHeaderContextBar = (pathname: string, isMobile: boolean) => {
  if (Platform.OS !== 'web') return true

  const isTravelDetailRoute = pathname.startsWith('/travels/')
  const isMapRoute = pathname === '/map' || pathname.startsWith('/map/')
  const isUserPointsRoute = pathname === '/userpoints'

  if (isMobile) {
    if (isMapRoute || isUserPointsRoute || isTravelDetailRoute) return true
    if (TOP_LEVEL_PATHS_NO_CONTEXT_BAR.has(pathname)) return false
    return true
  }

  // Desktop: hidden on travel detail (own nav) and top-level tabs (no breadcrumbs).
  if (isTravelDetailRoute) return false
  if (TOP_LEVEL_PATHS_NO_CONTEXT_BAR.has(pathname)) return false
  return true
}
