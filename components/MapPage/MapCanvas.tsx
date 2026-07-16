import { useEffect, useState } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { formatRadiusLabel } from '@/constants/mapConfig'
import { MapPageSkeleton } from '@/components/MapPage/MapPageSkeleton'
import MapPanel from '@/components/MapPage/MapPanel'
import { MapLoadingBar } from '@/components/MapPage/MapLoadingBar'
import WeatherLegend from '@/components/MapPage/WeatherLegend'
import { translate as i18nT } from '@/i18n'
import type { CoordinatesSource, MapLocationState } from '@/hooks/map/useMapCoordinates'


const PRESSED_OPACITY_06 = { opacity: 0.6 } as const
const LOCATION_STALE_AFTER_MS = 30_000
const LOCATION_LOW_ACCURACY_METERS = 100

const MAP_PANEL_PLACEHOLDER = <MapPageSkeleton inline />

// Fix 1: «Искать в этой области» (zIndex 1001) paints over the open Leaflet place
// popup (popup pane ~700), covering its title/actions. The button and the Leaflet
// container share the `mapArea` ancestor, so a single `:has()` rule hides the button
// while any popup is open. Injected once, web-only; scoped via the `[data-map-area]`
// marker + the button's stable testID.
const MAP_POPUP_CSS_ID = 'metravel-map-search-area-hide-on-popup'
const MAP_POPUP_CSS =
  // Fix 1: hide the search-area button while a popup is open.
  '[data-map-area="true"]:has(.leaflet-popup) [data-testid="map-search-this-area-desktop"]' +
  '{display:none !important;}' +
  // Fix 3 (desktop popup): cap the popup content height with an internal scroll so
  // expanding «Ещё» scrolls the caption/actions INSIDE the popup instead of growing
  // it off-screen (the map no longer re-pans vertically — see useMapPopupAutoPan).
  '.metravel-place-popup .leaflet-popup-content{max-height:calc(100dvh - 120px) !important;' +
  'overflow-y:auto !important;-webkit-overflow-scrolling:touch !important;' +
  'overscroll-behavior:contain !important;}'

function useMapPopupCss() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return
    if (document.getElementById(MAP_POPUP_CSS_ID)) return
    const style = document.createElement('style')
    style.id = MAP_POPUP_CSS_ID
    style.textContent = MAP_POPUP_CSS
    document.head.appendChild(style)
  }, [])
}

type MapCanvasProps = {
  styles: any
  themedColors: any
  isWeb: boolean
  isMobile: boolean
  showProgress: boolean
  mapReady: boolean
  mapPanelProps: any
  enabledOverlays?: Record<string, boolean> | null
  currentRadius: any
  shouldShowFloatingRadiusPill: boolean
  showGeoBanner: boolean
  locationState: MapLocationState
  coordinatesSource: CoordinatesSource
  dismissGeoBanner: () => void
  retryLocation: () => void
  openLocationSettings: () => void
  startManualRoute: () => void
  handleSelectSearchTab: () => void
  openRightPanel: () => void
  canSearchThisArea?: boolean
  onSearchThisArea?: () => void
}

export function MapCanvas({
  styles,
  themedColors,
  isWeb,
  isMobile,
  showProgress,
  mapReady,
  mapPanelProps,
  enabledOverlays,
  currentRadius,
  shouldShowFloatingRadiusPill,
  showGeoBanner,
  locationState,
  coordinatesSource,
  dismissGeoBanner,
  retryLocation,
  openLocationSettings,
  startManualRoute,
  handleSelectSearchTab,
  openRightPanel,
  canSearchThisArea,
  onSearchThisArea,
}: MapCanvasProps) {
  useMapPopupCss()
  const [locationClock, setLocationClock] = useState(() => Date.now())
  const currentLocationTimestamp = locationState.status === 'current' ? locationState.timestamp : null
  useEffect(() => {
    if (locationState.status !== 'current') return
    setLocationClock(Date.now())
    const interval = setInterval(() => setLocationClock(Date.now()), 15_000)
    return () => clearInterval(interval)
  }, [currentLocationTimestamp, locationState.status])

  const hasCachedViewport = coordinatesSource === 'cache' && locationState.status !== 'current'
  const canRetryLocation =
    locationState.status === 'cached' ||
    locationState.status === 'error' ||
    (locationState.status === 'denied' && locationState.canAskAgain)
  const canOpenSettings =
    Platform.OS !== 'web' &&
    locationState.status === 'denied' &&
    !locationState.canAskAgain
  const geoBannerMessage = hasCachedViewport
    ? i18nT('map:components.MapPage.MapCanvas.poslednee_izvestnoe_mestopolozhenie_ne_tekuschee_5c56a128')
    : Platform.OS === 'web'
      ? i18nT('map:components.MapPage.MapCanvas.geolokatsiya_nedostupna_razreshite_dostup_v__ee671e92')
      : i18nT('map:components.MapPage.MapCanvas.geolokatsiya_nedostupna_razreshite_dostup_v__f8c836df')
  const locationQuality = locationState.status === 'current'
    ? locationState.isRefreshing
      ? 'refreshing'
      : typeof locationState.accuracy === 'number' && locationState.accuracy > LOCATION_LOW_ACCURACY_METERS
        ? 'lowAccuracy'
        : locationClock - locationState.timestamp > LOCATION_STALE_AFTER_MS
          ? 'stale'
          : null
    : null
  const locationQualityMessage = locationQuality === 'refreshing'
    ? i18nT('map:components.MapPage.MapCanvas.mestopolozhenie_obnovlyaetsya_live_1')
    : locationQuality === 'lowAccuracy'
      ? i18nT('map:components.MapPage.MapCanvas.nizkaya_tochnost_geolokatsii_live_2')
      : locationQuality === 'stale'
        ? i18nT('map:components.MapPage.MapCanvas.mestopolozhenie_davno_ne_obnovlyalos_live_3')
        : null

  return (
    <View
      style={styles.mapArea}
      {...(Platform.OS === 'web' ? ({ dataSet: { mapArea: 'true' } } as any) : null)}
    >
      <MapLoadingBar visible={showProgress} />
      {isWeb && !isMobile && canSearchThisArea && !!onSearchThisArea && (
        <Pressable
          style={({ pressed }) => [
            styles.desktopSearchAreaButton,
            pressed && { opacity: 0.9 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={i18nT('map:components.MapPage.MapCanvas.iskat_v_etoy_oblasti_80b413e4')}
          testID="map-search-this-area-desktop"
          onPress={onSearchThisArea}
          hitSlop={8}
        >
          <Feather name="refresh-cw" size={15} color={themedColors.textOnPrimary} />
          <Text style={styles.desktopSearchAreaButtonText} numberOfLines={1}>
            {i18nT('map:components.MapPage.MapCanvas.iskat_v_etoy_oblasti_80b413e4')}</Text>
        </Pressable>
      )}
      {mapReady ? (
        <MapPanel {...mapPanelProps} hideFloatingControls={isMobile} />
      ) : (
        MAP_PANEL_PLACEHOLDER
      )}
      {isWeb && (
        <WeatherLegend enabledOverlays={enabledOverlays} />
      )}
      {shouldShowFloatingRadiusPill && (
        <Pressable
          style={styles.radiusPill}
          accessibilityRole="button"
          accessibilityLabel={i18nT('map:components.MapPage.MapCanvas.radius_poiska_value1_km_nazhmite_chtoby_izme_d6b055e9', { value1: currentRadius })}
          testID="map-radius-pill"
          onPress={() => {
            handleSelectSearchTab()
            openRightPanel()
          }}
          hitSlop={8}
        >
          <Feather name="radio" size={12} color={themedColors.primary} />
          <Text style={styles.radiusPillText}>{formatRadiusLabel(currentRadius)}</Text>
          <Feather name="chevron-down" size={11} color={themedColors.textMuted} />
        </Pressable>
      )}
      {!!locationQualityMessage && (
        <View
          style={styles.locationQualityPill}
          testID="map-location-quality"
          accessibilityLiveRegion="polite"
        >
          <Feather
            name={locationQuality === 'refreshing' ? 'refresh-cw' : 'crosshair'}
            size={13}
            color={themedColors.warning}
          />
          <Text style={styles.locationQualityText} numberOfLines={2}>
            {locationQualityMessage}
          </Text>
        </View>
      )}
      {showGeoBanner && (
        <View style={styles.geoBanner} testID="map-geo-banner">
          <Feather name="map-pin" size={13} color={themedColors.warning} />
          <View style={styles.geoBannerBody}>
            <Text style={styles.geoBannerText} numberOfLines={2}>
              {geoBannerMessage}
            </Text>
            <View style={styles.geoBannerActions}>
              {canRetryLocation && (
                <Pressable
                  testID="map-geo-retry"
                  onPress={retryLocation}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.geoBannerActionPrimary,
                    pressed && PRESSED_OPACITY_06,
                  ]}
                >
                  <Text style={styles.geoBannerActionPrimaryText} numberOfLines={1}>
                    {locationState.status === 'denied'
                      ? i18nT('map:components.MapPage.MapCanvas.razreshit_dostup_28ec6443')
                      : i18nT('map:components.MapPage.MapCanvas.povtorit_66ddcbbc')}
                  </Text>
                </Pressable>
              )}
              {canOpenSettings && (
                <Pressable
                  testID="map-geo-open-settings"
                  onPress={openLocationSettings}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.geoBannerActionPrimary,
                    pressed && PRESSED_OPACITY_06,
                  ]}
                >
                  <Text style={styles.geoBannerActionPrimaryText} numberOfLines={1}>
                    {i18nT('map:components.MapPage.MapCanvas.otkryt_nastroyki_ecb067f5')}
                  </Text>
                </Pressable>
              )}
              <Pressable
                testID="map-geo-manual-start"
                onPress={startManualRoute}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.geoBannerActionSecondary,
                  pressed && PRESSED_OPACITY_06,
                ]}
              >
                <Text style={styles.geoBannerActionSecondaryText} numberOfLines={1}>
                  {i18nT('map:components.MapPage.MapCanvas.ukazat_start_vruchnuyu_84e450cb')}
                </Text>
              </Pressable>
            </View>
          </View>
          <Pressable
            onPress={dismissGeoBanner}
            accessibilityRole="button"
            accessibilityLabel={i18nT('map:components.MapPage.MapCanvas.zakryt_uvedomlenie_ae069cb3')}
            hitSlop={11}
            style={({ pressed }) => [styles.geoBannerClose, pressed && PRESSED_OPACITY_06]}
          >
            <Feather name="x" size={12} color={themedColors.textMuted} />
          </Pressable>
        </View>
      )}
    </View>
  )
}
