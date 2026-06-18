/**
 * MapMobileLayersPopover — compact layers/overlays panel under the ⧉ Слои icon.
 *
 * Reuses the existing FiltersPanelMapSettings body (base-layer chips + overlay
 * toggles, sourced from `config/mapWebLayers.ts`) — no duplicated layer logic.
 * It is driven by the same controlled overlay state the filters sheet uses
 * (`overlayOptions` / `enabledOverlays` / `onOverlayToggle` / `mapUiApi`).
 *
 * Tapping a toggle switches the layer in place; the popover stays open so the
 * user can flip several layers. Closing is via tap-outside (the popover backdrop)
 * or the close icon.
 */
import React, { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import FiltersPanelMapSettings from '@/components/MapPage/FiltersPanelMapSettings'
import getFiltersPanelStyles from '@/components/MapPage/filtersPanelStyles'
import type { ThemedColors } from '@/hooks/useTheme'
import type { MapUiApi } from '@/types/mapUi'

import { MapMobilePopover } from './MapMobilePopover'

interface OverlayOption {
  id: string
  title: string
  category?: string
  subtitle?: string
  badge?: string
}

interface MapMobileLayersPopoverProps {
  colors: ThemedColors
  top: number
  /** Card right-edge offset. Desktop floating icon anchors the card to itself. */
  right?: number
  /** Card max width. Desktop uses a slightly wider card than mobile. */
  maxWidth?: number
  mapUiApi?: MapUiApi | null
  overlayOptions?: ReadonlyArray<OverlayOption>
  enabledOverlays?: Record<string, boolean>
  onOverlayToggle?: (id: string, enabled: boolean) => void
  onResetOverlays?: () => void
  onRequestClose: () => void
}

const MapMobileLayersPopoverInner: React.FC<MapMobileLayersPopoverProps> = ({
  colors,
  top,
  right,
  maxWidth,
  mapUiApi,
  overlayOptions,
  enabledOverlays,
  onOverlayToggle,
  onResetOverlays,
  onRequestClose,
}) => {
  const { width } = useWindowDimensions()
  const panelStyles = useMemo(
    () => getFiltersPanelStyles(colors, true, width),
    [colors, width],
  )

  return (
    <MapMobilePopover
      colors={colors}
      top={top}
      right={right}
      maxWidth={maxWidth}
      onRequestClose={onRequestClose}
      testID="map-mobile-layers-popover"
    >
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          Слои карты
        </Text>
        <Pressable
          testID="map-mobile-layers-popover-close"
          onPress={onRequestClose}
          accessibilityRole="button"
          accessibilityLabel="Закрыть"
          hitSlop={13}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <Feather name="x" size={18} color={colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        <FiltersPanelMapSettings
          colors={colors}
          styles={panelStyles}
          isMobile
          mode="radius"
          mapUiApi={mapUiApi}
          overlayOptions={overlayOptions ? [...overlayOptions] : undefined}
          enabledOverlays={enabledOverlays}
          onOverlayToggle={onOverlayToggle}
          onResetOverlays={onResetOverlays}
          totalPoints={0}
          hasFilters={false}
          canBuildRoute={false}
          hideReset
          withContainer={false}
        />
      </ScrollView>
    </MapMobilePopover>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  scroll: {
    maxHeight: 420,
  },
  scrollContent: {
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
})

export const MapMobileLayersPopover = React.memo(MapMobileLayersPopoverInner)
