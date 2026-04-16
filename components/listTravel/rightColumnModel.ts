import { Platform, type ViewStyle } from 'react-native'
import type { Travel } from '@/types/types'

export const RECOMMENDATIONS_TOTAL_HEIGHT = 376
export const STABLE_PLACEHOLDER_HEIGHT = 1200
export const TOP_SCROLL_PADDING = 8
export const WEB_ROW_INTRINSIC_SIZE_MOBILE = 'auto 340px'
export const WEB_ROW_INTRINSIC_SIZE_DESKTOP = 'auto 420px'

export function getRightColumnColumns(gridColumns: number, isMobile: boolean) {
  return Math.max(1, (isMobile ? 1 : gridColumns) || 1)
}

export function buildTravelRows(travels: Travel[], gridColumns: number, isMobile: boolean) {
  const cols = getRightColumnColumns(gridColumns, isMobile)
  const result: Travel[][] = []

  for (let index = 0; index < travels.length; index += cols) {
    result.push(travels.slice(index, index + cols))
  }

  return result
}

export function getRightColumnHeaderMinHeight(isMobile: boolean) {
  if (Platform.OS === 'web') {
    return isMobile ? 56 : 76
  }

  return 52
}

export function getWebRowIntrinsicSize(isMobile: boolean) {
  return isMobile ? WEB_ROW_INTRINSIC_SIZE_MOBILE : WEB_ROW_INTRINSIC_SIZE_DESKTOP
}

type RightColumnComparableProps = {
  activeFiltersCount: number
  cardSpacing?: number
  contentPadding: number
  gridColumns: number
  isError: boolean
  isExport?: boolean
  isMobile: boolean
  isRecommendationsVisible: boolean
  isSearchPending?: boolean
  onFiltersPress?: unknown
  renderItem: unknown
  search: string
  showEmptyState: boolean
  showInitialLoading: boolean
  showNextPageLoading: boolean
  topContent?: unknown
  total: number
  travels: Travel[]
}

export function areRightColumnPropsEqual(
  prev: RightColumnComparableProps,
  next: RightColumnComparableProps,
) {
  return (
    prev.search === next.search &&
    prev.total === next.total &&
    prev.travels === next.travels &&
    prev.topContent === next.topContent &&
    prev.renderItem === next.renderItem &&
    prev.gridColumns === next.gridColumns &&
    prev.isMobile === next.isMobile &&
    prev.contentPadding === next.contentPadding &&
    prev.cardSpacing === next.cardSpacing &&
    prev.showInitialLoading === next.showInitialLoading &&
    prev.isSearchPending === next.isSearchPending &&
    prev.isError === next.isError &&
    prev.isExport === next.isExport &&
    prev.onFiltersPress === next.onFiltersPress &&
    prev.showEmptyState === next.showEmptyState &&
    prev.showNextPageLoading === next.showNextPageLoading &&
    prev.activeFiltersCount === next.activeFiltersCount &&
    prev.isRecommendationsVisible === next.isRecommendationsVisible
  )
}

export function getRightColumnWebRowBaseStyle(params: {
  cardSpacing: number
  isExport: boolean
  isMobile: boolean
}): ViewStyle {
  return {
    alignItems: 'stretch',
    columnGap: params.cardSpacing,
    flexWrap: 'wrap',
    maxWidth: '100%',
    minWidth: 0,
    rowGap: params.cardSpacing,
    width: '100%',
    ...(Platform.OS === 'web' && !params.isExport
      ? ({
          containIntrinsicSize: getWebRowIntrinsicSize(params.isMobile),
          contentVisibility: 'auto',
        } as any)
      : null),
  } as ViewStyle
}
