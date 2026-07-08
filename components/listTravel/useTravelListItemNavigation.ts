import { useCallback, useMemo } from 'react'
import { Platform } from 'react-native'
import { router, usePathname } from 'expo-router'

import { HEADER_NAV_ITEMS } from '@/constants/headerNavigation'
import { appendReturnToParam, normalizeInternalReturnPath } from '@/utils/navigationReturnPath'

type Props = {
  travelUrl: string
  isMetravel: boolean
  selectable: boolean
  onToggle?: () => void
}

export function useTravelListItemNavigation({
  travelUrl,
  isMetravel,
  selectable,
  onToggle,
}: Props) {
  const pathname = usePathname()

  const returnToPath = useMemo(() => {
    if (isMetravel) return '/metravel'
    const normalizedPathname =
      normalizeInternalReturnPath(pathname) ??
      (Platform.OS === 'web' && typeof window !== 'undefined'
        ? normalizeInternalReturnPath(window.location.pathname)
        : null)
    const navItem = HEADER_NAV_ITEMS.find((item) => !item.external && item.path === normalizedPathname)
    return navItem?.path || ''
  }, [isMetravel, pathname])

  const navigationUrl = useMemo(() => {
    if (!travelUrl) return ''
    return appendReturnToParam(travelUrl, returnToPath)
  }, [returnToPath, travelUrl])

  const handlePress = useCallback(() => {
    if (selectable) {
      onToggle?.()
      return
    }
    if (!navigationUrl) return
    router.push(navigationUrl as any)
  }, [navigationUrl, onToggle, selectable])

  return {
    navigationUrl,
    returnToPath,
    handlePress,
    isNavigable: Boolean(navigationUrl),
  }
}
