/**
 * MapMobileSheetBody - renders list vs filters provider branch for the mobile bottom sheet.
 * Extracted from MapMobileLayout (no behavior change).
 */
import React, { Suspense } from 'react'

import TravelListPanel from '@/components/MapPage/TravelListPanel'

type UiTab = 'search' | 'route' | 'list'
type SheetState = 'collapsed' | 'quarter' | 'half' | 'full'

export interface MapMobileSheetBodyProps {
  uiTab: UiTab
  sheetState: SheetState
  travelsData: any[]
  buildRouteTo: (item: any) => void
  hasMore?: boolean
  onLoadMore?: () => void
  onRefresh?: () => void
  isRefreshing?: boolean
  coordinates: { latitude: number; longitude: number } | null
  transportMode: 'car' | 'bike' | 'foot'
  onToggleFavorite?: (id: string | number) => void
  favorites?: Set<string | number>
  onResetFilters?: () => void
  onExpandRadius?: () => void
  onOpenList: () => void
  onBackToMap: () => void
  onOpenSearch: () => void
  filtersPanelProps: any
  filtersContextProps: any
  filtersLoadingFallback: React.ReactNode
  onProviderOpenList: () => void
}

const MapMobileSheetBodyInner: React.FC<MapMobileSheetBodyProps> = ({
  uiTab,
  sheetState,
  travelsData,
  buildRouteTo,
  hasMore,
  onLoadMore,
  onRefresh,
  isRefreshing,
  coordinates,
  transportMode,
  onToggleFavorite,
  favorites,
  onResetFilters,
  onExpandRadius,
  onOpenList,
  onBackToMap,
  onOpenSearch,
  filtersPanelProps,
  filtersContextProps,
  filtersLoadingFallback,
  onProviderOpenList,
}) => {
  if (uiTab === 'list') {
    return (
      <TravelListPanel
        travelsData={travelsData}
        buildRouteTo={buildRouteTo}
        isMobile={true}
        hasMore={hasMore}
        onLoadMore={onLoadMore}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        userLocation={coordinates}
        transportMode={transportMode}
        onToggleFavorite={onToggleFavorite}
        favorites={favorites}
        compactPreview={sheetState === 'quarter'}
        onExpandList={onOpenList}
        onClosePanel={onBackToMap}
        onOpenFilters={onOpenSearch}
        onResetFilters={onResetFilters}
        onExpandRadius={onExpandRadius}
      />
    )
  }

  const ProviderComponent = filtersPanelProps?.Component
  const PanelComponent = filtersPanelProps?.Panel
  const providerProps = filtersContextProps

  if (!ProviderComponent || !PanelComponent || !providerProps) {
    return <>{filtersLoadingFallback}</>
  }

  const mergedProviderProps = {
    ...providerProps,
    onOpenList: onProviderOpenList,
  }

  return (
    <Suspense fallback={filtersLoadingFallback}>
      <ProviderComponent {...mergedProviderProps}>
        <PanelComponent hideTopControls={true} />
      </ProviderComponent>
    </Suspense>
  )
}

export const MapMobileSheetBody = React.memo(MapMobileSheetBodyInner)
export default MapMobileSheetBody
