import { useMemo } from 'react'

import { HEADER_NAV_ITEMS } from '@/constants/headerNavigation'
import useBreadcrumbModel from '@/hooks/useBreadcrumbModel'

import { resolveHeaderContextBarAction } from './headerContextBarModel'

const TOP_LEVEL_TAB_PATHS = new Set<string>(
  ['/'].concat(HEADER_NAV_ITEMS.filter((item) => !item.external).map((item) => item.path)),
)

type HeaderContextBarFallbackVisibilityArgs = {
  isMobile: boolean
  pathname: string
  showHeaderContextBar: boolean
}
/** Native/iPad has no critical-CSS fallback, so preserve the full prediction. */
export function useHeaderContextBarFallbackVisibility({
  isMobile,
  pathname,
  showHeaderContextBar,
}: HeaderContextBarFallbackVisibilityArgs): boolean {
  const breadcrumbModel = useBreadcrumbModel()

  return useMemo(() => {
    if (!showHeaderContextBar) return false
    if (isMobile) {
      const action = resolveHeaderContextBarAction(pathname)
      const isTopLevelTab = !!pathname && TOP_LEVEL_TAB_PATHS.has(pathname)
      return !(isTopLevelTab && action === 'none')
    }
    return breadcrumbModel.showBreadcrumbs
  }, [breadcrumbModel.showBreadcrumbs, isMobile, pathname, showHeaderContextBar])
}
