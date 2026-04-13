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

export const shouldShowHeaderContextBar = (
  pathname: string,
  isMobile: boolean,
) => {
  const isTravelRoute =
    pathname.startsWith('/travels/') || pathname.startsWith('/travel/')
  const isMapRoute = pathname === '/map' || pathname.startsWith('/map/')

  return !(
    (Platform.OS === 'web' && !isMobile && isTravelRoute) ||
    (Platform.OS === 'web' && isMobile && isMapRoute)
  )
}
