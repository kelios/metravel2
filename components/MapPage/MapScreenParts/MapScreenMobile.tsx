import React, { Suspense } from 'react'
import { View } from 'react-native'

import { MapOfflineIndicator } from '@/components/MapPage/MapOfflineIndicator'
import { MapMobileLayout, MapOnboarding } from '@/screens/tabs/mapDeferred'

import { MAP_PANEL_PLACEHOLDER, ROOT_MAP_PROPS } from './shared'

type MapScreenMobileProps = {
  styles: any
  seoBlock: React.ReactNode
  mapComponent: React.ReactNode
  travelsData: any[]
  hasMore: boolean
  onLoadMore?: () => void
  refetchMapData: () => void
  loading: boolean
  isFetching: boolean
  isPlaceholderData: boolean
  coordinates: any
  transportMode: any
  buildRouteTo: (item: any) => void
  centerOnUser: () => void
  handleSelectSearchTab: () => void
  requestOpenBottomSheet: (tab: any) => void
  filtersPanelProps: any
  handleClearAllFilters: () => void
  handleExpandRadius: () => void
  isConnected: boolean
  shouldLoadOnboarding: boolean
  isWeb: boolean
  isMobile: boolean
  selectedPlace?: any | null
  clearSelectedPlace?: () => void
  selectedPlaceUserLocation?: { latitude: number; longitude: number } | null
}

export function MapScreenMobile({
  styles,
  seoBlock,
  mapComponent,
  travelsData,
  hasMore,
  onLoadMore,
  refetchMapData,
  loading,
  isFetching,
  isPlaceholderData,
  coordinates,
  transportMode,
  buildRouteTo,
  centerOnUser,
  handleSelectSearchTab,
  requestOpenBottomSheet,
  filtersPanelProps,
  handleClearAllFilters,
  handleExpandRadius,
  isConnected,
  shouldLoadOnboarding,
  isWeb,
  isMobile,
  selectedPlace,
  clearSelectedPlace,
  selectedPlaceUserLocation,
}: MapScreenMobileProps) {
  return (
    <View style={styles.container} {...ROOT_MAP_PROPS}>
      {seoBlock}
      <Suspense fallback={MAP_PANEL_PLACEHOLDER}>
        <MapMobileLayout
          mapComponent={mapComponent}
          travelsData={travelsData}
          hasMore={hasMore}
          onLoadMore={onLoadMore}
          onRefresh={refetchMapData}
          isLoading={loading || isFetching}
          isRefreshing={isFetching && isPlaceholderData}
          coordinates={coordinates}
          transportMode={transportMode}
          buildRouteTo={buildRouteTo}
          onCenterOnUser={centerOnUser}
          onOpenFilters={() => {
            handleSelectSearchTab()
            requestOpenBottomSheet('filters')
          }}
          filtersPanelProps={filtersPanelProps}
          onResetFilters={handleClearAllFilters}
          onExpandRadius={handleExpandRadius}
          selectedPlace={selectedPlace}
          clearSelectedPlace={clearSelectedPlace}
          selectedPlaceUserLocation={selectedPlaceUserLocation}
        />
      </Suspense>

      {/* topInset уводит плашку ниже верхнего ряда плавающих контролов карты */}
      <MapOfflineIndicator visible={!isConnected} topInset={56} />

      {/* Онбординг монтируется и на мобильном: иначе restartMapOnboarding()
          (кнопка «?») не имеет зарегистрированного _restartCb и ничего не показывает. */}
      {shouldLoadOnboarding && (
        <Suspense fallback={null}>
          <MapOnboarding mobileWebCoachmark={isWeb && isMobile} />
        </Suspense>
      )}
    </View>
  )
}
