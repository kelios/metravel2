import { Suspense, lazy } from 'react'
import { Pressable, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { MapPageSkeleton } from '@/components/MapPage/MapPageSkeleton'
import MapPanel from '@/components/MapPage/MapPanel'
import { MapLoadingBar } from '@/components/MapPage/MapLoadingBar'

const PRESSED_OPACITY_06 = { opacity: 0.6 } as const

const MAP_PANEL_PLACEHOLDER = <MapPageSkeleton inline />

const LazyMapQuickFilters = lazy(() =>
  import('@/components/MapPage/MapQuickFilters').then((mod) => ({ default: mod.MapQuickFilters })),
)

type QuickFiltersData = {
  selected: string[]
  radiusOptions: any
  categoryOptions: any
  overlayOptions: any
  enabledOverlays: any
  categoriesValue: string
  radiusValue: string
  overlaysValue: string
}

type QuickActionButton = {
  key: string
  label: string
  icon: 'crosshair' | 'plus' | 'minus'
  onPress: () => void
  testID: string
}

type MapCanvasProps = {
  styles: any
  themedColors: any
  isWeb: boolean
  isMobile: boolean
  isFetching: boolean
  isDebouncingFilters: boolean
  mapReady: boolean
  mapPanelProps: any
  travelsData: any[]
  quickFilters: QuickFiltersData
  mapQuickActionButtons: QuickActionButton[]
  currentRadius: any
  shouldShowFloatingRadiusPill: boolean
  onFilterChange?: (key: string, value: any) => void
  onOverlayToggle?: (id: string, enabled: boolean) => void
  onResetOverlays?: () => void
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
  isFetching,
  isDebouncingFilters,
  mapReady,
  mapPanelProps,
  travelsData,
  quickFilters,
  mapQuickActionButtons,
  currentRadius,
  shouldShowFloatingRadiusPill,
  onFilterChange,
  onOverlayToggle,
  onResetOverlays,
  showGeoBanner,
  dismissGeoBanner,
  handleSelectSearchTab,
  openRightPanel,
}: MapCanvasProps) {
  return (
    <View style={styles.mapArea}>
      <MapLoadingBar visible={isFetching || isDebouncingFilters} />
      {isWeb && !isMobile && (
        <Suspense fallback={null}>
          <LazyMapQuickFilters
            extraActions={mapQuickActionButtons}
            extraActionsPosition="inside-radius"
            radiusValue={quickFilters.radiusValue}
            categoriesValue={quickFilters.categoriesValue}
            overlaysValue={quickFilters.overlaysValue}
            radiusOptions={quickFilters.radiusOptions}
            radiusSelected={currentRadius}
            onChangeRadius={(next) => onFilterChange?.('radius', next)}
            categoriesOptions={quickFilters.categoryOptions}
            categoriesSelected={quickFilters.selected}
            onChangeCategories={(next) => onFilterChange?.('categoryTravelAddress', next)}
            overlayOptions={quickFilters.overlayOptions}
            enabledOverlays={quickFilters.enabledOverlays}
            onChangeOverlay={(id, enabled) => onOverlayToggle?.(id, enabled)}
            onResetOverlays={onResetOverlays}
            travelsData={travelsData}
          />
        </Suspense>
      )}
      {mapReady ? (
        <MapPanel {...mapPanelProps} hideFloatingControls={isMobile} />
      ) : (
        MAP_PANEL_PLACEHOLDER
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
