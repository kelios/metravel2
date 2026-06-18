import { Pressable, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { MapPageSkeleton } from '@/components/MapPage/MapPageSkeleton'
import MapPanel from '@/components/MapPage/MapPanel'
import { MapLoadingBar } from '@/components/MapPage/MapLoadingBar'
import WeatherLegend from '@/components/MapPage/WeatherLegend'

const PRESSED_OPACITY_06 = { opacity: 0.6 } as const

const MAP_PANEL_PLACEHOLDER = <MapPageSkeleton inline />

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
}: MapCanvasProps) {
  return (
    <View style={styles.mapArea}>
      <MapLoadingBar visible={showProgress} />
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
          <Text style={styles.radiusPillText}>{currentRadius} км</Text>
          <Feather name="chevron-down" size={11} color={themedColors.textMuted} />
        </Pressable>
      )}
      {showGeoBanner && (
        <View style={styles.geoBanner} testID="map-geo-banner">
          <Feather name="map-pin" size={13} color={themedColors.warning} />
          <Text style={styles.geoBannerText}>
            Геолокация недоступна — разрешите доступ в настройках браузера
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
