/**
 * MapMobileTopOverlay — compact icon toolbar floating on top of the map.
 *
 * Renders a left location button plus a right-side row of round icon buttons:
 *  - left: ⌖ Локация (crosshair) — tap → recenters the map on the user.
 *  - right: ≡ Фильтры, ◎ Радиус, ⧉ Слои, ≣ Список.
 *
 * The radius/layers popovers are mobile-only inline actions, so those quick
 * controls no longer need to open the 70% sheet. The sheet now hosts only
 * place-name search + categories.
 *
 * No persistent panel — this overlay floats above a full-screen map.
 */
import React from 'react'
import { Platform, Pressable, Text as RNText, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import type { ThemedColors } from '@/hooks/useTheme'
import type { MapUiApi } from '@/types/mapUi'
import { getMapMobileTopOverlayStyles } from './MapMobileTopOverlay.styles'
import { MapMobileRadiusPopover } from './MapMobileRadiusPopover'
import { MapMobileLayersPopover } from './MapMobileLayersPopover'

type ActivePopover = 'radius' | 'layers' | null

const BUTTON_SIZE = 44

interface MapMobileTopOverlayProps {
  colors: ThemedColors
  topInset: number
  /** Short radius value shown as a badge on the radius button (e.g. "50"). */
  radiusBadge: string
  /** Which inline popover is currently open (radius/layers) — or null. */
  activePopover: ActivePopover
  onToggleRadius: () => void
  onToggleLayers: () => void
  onClosePopover: () => void
  onOpenFilters: () => void
  /** Recenter the map on the user's location. */
  onCenterOnUser: () => void
  /** Open the «Места рядом» list sheet. */
  onOpenList: () => void
  /** Count of nearby places shown as a badge on the list button (e.g. "12"). */
  listBadge: string
  // Radius popover data (same source as FiltersPanelRadiusSection).
  radiusOptions: ReadonlyArray<{ id: string; name: string }>
  radiusValue: string
  onRadiusSelect: (id: string) => void
  // Layers popover data (same controlled overlay state as the filters sheet).
  mapUiApi?: MapUiApi | null
  overlayOptions?: ReadonlyArray<{ id: string; title: string; category?: string }>
  enabledOverlays?: Record<string, boolean>
  onOverlayToggle?: (id: string, enabled: boolean) => void
  onResetOverlays?: () => void
}

const MapMobileTopOverlayInner: React.FC<MapMobileTopOverlayProps> = ({
  colors,
  topInset,
  radiusBadge,
  activePopover,
  onToggleRadius,
  onToggleLayers,
  onClosePopover,
  onOpenFilters,
  onCenterOnUser,
  onOpenList,
  listBadge,
  radiusOptions,
  radiusValue,
  onRadiusSelect,
  mapUiApi,
  overlayOptions,
  enabledOverlays,
  onOverlayToggle,
  onResetOverlays,
}) => {
  const styles = getMapMobileTopOverlayStyles(colors)

  // R-1 — глобальной шапки на табе карты больше нет, поэтому overlay сам отвечает
  // за отступ под статус-бар/нотч. Берём safe-area top, но держим небольшой пол,
  // чтобы кнопки не прилипали к самому краю там, где safe-area == 0.
  const resolvedTopPadding = Math.max(topInset, 8) + 8
  // Поповеры открываются прямо под рядом иконок: верх иконок + высота кнопки + зазор.
  const popoverTop = resolvedTopPadding + BUTTON_SIZE + 8

  return (
    <View
      pointerEvents="box-none"
      style={[styles.root, { paddingTop: resolvedTopPadding }]}
      testID="map-mobile-top-overlay"
    >
      <Pressable
        testID="map-center-user-quick"
        onPress={onCenterOnUser}
        accessibilityRole="button"
        accessibilityLabel="Показать мое местоположение"
        hitSlop={6}
        style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
      >
        <Feather name="crosshair" size={20} color={colors.primary} />
      </Pressable>

      <View style={styles.toolbar} pointerEvents="auto">
        <Pressable
          testID="map-mobile-filters-button"
          onPress={onOpenFilters}
          accessibilityRole="button"
          accessibilityLabel="Открыть фильтры"
          hitSlop={6}
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
        >
          <Feather name="sliders" size={20} color={colors.text} />
        </Pressable>

        <Pressable
          testID="map-mobile-radius-button"
          onPress={onToggleRadius}
          accessibilityRole="button"
          accessibilityState={{ expanded: activePopover === 'radius' }}
          accessibilityLabel={`Радиус${radiusBadge ? ` ${radiusBadge}` : ''}`}
          hitSlop={6}
          style={({ pressed }) => [
            styles.iconButton,
            activePopover === 'radius' && styles.iconButtonActive,
            pressed && styles.iconButtonPressed,
          ]}
        >
          <Feather name="target" size={20} color={colors.text} />
          {!!radiusBadge && (
            <View style={styles.badge} pointerEvents="none">
              <RNText style={styles.badgeText} numberOfLines={1}>
                {radiusBadge}
              </RNText>
            </View>
          )}
        </Pressable>

        <Pressable
          testID="map-mobile-layers-button"
          onPress={onToggleLayers}
          accessibilityRole="button"
          accessibilityState={{ expanded: activePopover === 'layers' }}
          accessibilityLabel="Слои и настройки карты"
          hitSlop={6}
          style={({ pressed }) => [
            styles.iconButton,
            activePopover === 'layers' && styles.iconButtonActive,
            pressed && styles.iconButtonPressed,
          ]}
        >
          <Feather name="layers" size={20} color={colors.text} />
        </Pressable>

        <Pressable
          testID="map-mobile-open-list"
          onPress={onOpenList}
          accessibilityRole="button"
          accessibilityLabel={`Показать список рядом${listBadge ? ` — ${listBadge}` : ''}`}
          hitSlop={6}
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
        >
          <Feather name="list" size={20} color={colors.text} />
          {!!listBadge && (
            <View style={styles.badge} pointerEvents="none">
              <RNText style={styles.badgeText} numberOfLines={1}>
                {listBadge}
              </RNText>
            </View>
          )}
        </Pressable>
      </View>

      {activePopover === 'radius' && (
        <MapMobileRadiusPopover
          colors={colors}
          top={popoverTop}
          options={radiusOptions}
          currentValue={radiusValue}
          onSelect={onRadiusSelect}
          onRequestClose={onClosePopover}
        />
      )}

      {activePopover === 'layers' && (
        <MapMobileLayersPopover
          colors={colors}
          top={popoverTop}
          mapUiApi={mapUiApi}
          overlayOptions={overlayOptions}
          enabledOverlays={enabledOverlays}
          onOverlayToggle={onOverlayToggle}
          onResetOverlays={onResetOverlays}
          onRequestClose={onClosePopover}
        />
      )}
    </View>
  )
}

export const MapMobileTopOverlay = React.memo(MapMobileTopOverlayInner)

export const IS_TOP_OVERLAY_WEB = Platform.OS === 'web'
