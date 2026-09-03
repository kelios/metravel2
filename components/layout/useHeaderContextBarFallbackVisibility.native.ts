import { useMemo } from 'react'

import useBreadcrumbModel from '@/hooks/useBreadcrumbModel'

import { resolveHeaderContextBarAction } from './headerContextBarModel'
import { isTopLevelSectionPath } from './topLevelSections'
import { useHasListFilterQuery } from './useListFilterQuery'

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
  const hasListFilterQuery = useHasListFilterQuery()

  return useMemo(() => {
    if (!showHeaderContextBar) return false
    if (isMobile) {
      const action = resolveHeaderContextBarAction(pathname)
      const isTopLevelTab = !!pathname && isTopLevelSectionPath(pathname, hasListFilterQuery)
      return !(isTopLevelTab && action === 'none')
    }
    return breadcrumbModel.showBreadcrumbs
  }, [
    breadcrumbModel.showBreadcrumbs,
    hasListFilterQuery,
    isMobile,
    pathname,
    showHeaderContextBar,
  ])
}
