import { Suspense, useEffect, useState } from 'react';

import { MapOfflineIndicator } from '@/components/MapPage/MapOfflineIndicator'
import { MapMobileLayout, MapOnboarding } from '@/screens/tabs/mapDeferred'

import { MAP_PANEL_PLACEHOLDER } from './shared'

type MapScreenMobileProps = {
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
  focusPlace?: (item: any) => void
  travelsCount: number
  centerOnUser: () => void
  onShowAllPlaces?: () => void
  canSearchThisArea?: boolean
  onSearchThisArea?: () => void
  handleSelectSearchTab: () => void
  requestOpenBottomSheet: (tab: any) => void
  filtersPanelProps: any
  handleClearAllFilters: () => void
  hasActiveFilters?: boolean
  handleExpandRadius: () => void
  isConnected: boolean
  shouldLoadOnboarding: boolean
  isWeb: boolean
  isMobile: boolean
  selectedPlace?: any | null
  clearSelectedPlace?: () => void
  selectedPlaceUserLocation?: { latitude: number; longitude: number } | null
}

/**
 * Mobile chrome: the maps.me-style top overlay + bottom sheet + FABs, rendered
 * as an absolute overlay ON TOP of the stable map host (see MapScreenShell). The
 * map node is never rendered here, so a breakpoint flip cannot remount it. #217.
 */
export function MapScreenMobile({
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
  focusPlace,
  travelsCount,
  centerOnUser,
  onShowAllPlaces,
  canSearchThisArea,
  onSearchThisArea,
  handleSelectSearchTab,
  requestOpenBottomSheet,
  filtersPanelProps,
  handleClearAllFilters,
  hasActiveFilters,
  handleExpandRadius,
  isConnected,
  shouldLoadOnboarding,
  isWeb,
  isMobile,
  selectedPlace,
  clearSelectedPlace,
  selectedPlaceUserLocation,
}: MapScreenMobileProps) {
  const [consentBannerVisible, setConsentBannerVisible] = useState(false)

  useEffect(() => {
    if (!isWeb || typeof document === 'undefined') return
    const body = document.body
    if (!body) return
    const update = () => {
      setConsentBannerVisible(
        body.getAttribute('data-consent-banner-open') === 'true',
      )
    }
    update()
    const observer = new MutationObserver(update)
    observer.observe(body, {
      attributes: true,
      attributeFilter: ['data-consent-banner-open'],
    })
    return () => observer.disconnect()
  }, [isWeb])

  return (
    <>
      <Suspense fallback={MAP_PANEL_PLACEHOLDER}>
        <MapMobileLayout
          travelsData={travelsData}
          hasMore={hasMore}
          onLoadMore={onLoadMore}
          onRefresh={refetchMapData}
          isLoading={loading || isFetching}
          isRefreshing={isFetching && isPlaceholderData}
          coordinates={coordinates}
          transportMode={transportMode}
          buildRouteTo={buildRouteTo}
          focusPlace={focusPlace}
          totalCount={travelsCount}
          onCenterOnUser={centerOnUser}
          onShowAllPlaces={onShowAllPlaces}
          canSearchThisArea={canSearchThisArea}
          onSearchThisArea={onSearchThisArea}
          onOpenFilters={() => {
            handleSelectSearchTab()
            requestOpenBottomSheet('filters')
          }}
          filtersPanelProps={filtersPanelProps}
          onResetFilters={handleClearAllFilters}
          hasActiveFilters={hasActiveFilters}
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
          <MapOnboarding
            mobileWebCoachmark={isWeb && isMobile}
            suspendAutoOpen={isWeb && isMobile && consentBannerVisible}
          />
        </Suspense>
      )}
    </>
  )
}
