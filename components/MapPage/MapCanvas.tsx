import { useEffect } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { formatRadiusLabel } from '@/constants/mapConfig'
import { MapPageSkeleton } from '@/components/MapPage/MapPageSkeleton'
import MapPanel from '@/components/MapPage/MapPanel'
import { MapLoadingBar } from '@/components/MapPage/MapLoadingBar'
import WeatherLegend from '@/components/MapPage/WeatherLegend'

const PRESSED_OPACITY_06 = { opacity: 0.6 } as const

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
  dismissGeoBanner: () => void
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
  dismissGeoBanner,
  handleSelectSearchTab,
  openRightPanel,
  canSearchThisArea,
  onSearchThisArea,
}: MapCanvasProps) {
  useMapPopupCss()
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
          accessibilityLabel="Искать в этой области"
          testID="map-search-this-area-desktop"
          onPress={onSearchThisArea}
          hitSlop={8}
        >
          <Feather name="refresh-cw" size={15} color={themedColors.textOnPrimary} />
          <Text style={styles.desktopSearchAreaButtonText} numberOfLines={1}>
            Искать в этой области
          </Text>
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
          accessibilityLabel={`Радиус поиска: ${currentRadius} км. Нажмите, чтобы изменить`}
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
      {showGeoBanner && (
        <View style={styles.geoBanner} testID="map-geo-banner">
          <Feather name="map-pin" size={13} color={themedColors.warning} />
          <Text style={styles.geoBannerText}>
            {Platform.OS === 'web'
              ? 'Геолокация недоступна — разрешите доступ в настройках браузера'
              : 'Геолокация недоступна — разрешите доступ в настройках устройства'}
          </Text>
          <Pressable
            onPress={dismissGeoBanner}
            accessibilityRole="button"
            accessibilityLabel="Закрыть уведомление"
            hitSlop={10}
            style={({ pressed }) => [styles.geoBannerClose, pressed && PRESSED_OPACITY_06]}
          >
            <Feather name="x" size={12} color={themedColors.textMuted} />
          </Pressable>
        </View>
      )}
    </View>
  )
}
