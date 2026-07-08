/**
 * MapMobileTopOverlay — compact icon toolbar floating on top of the map.
 *
 * Renders a left location button plus right-side rows of round icon buttons:
 *  - left: ⌖ Локация (crosshair) — tap → recenters the map on the user.
 *  - right/top: ≡ Фильтры, ◎ Радиус, ⧉ Слои, ≣ Список.
 *  - right/bottom: route-building controls grouped together.
 *
 * The radius/layers popovers are mobile-only inline actions, so those quick
 * controls no longer need to open the 70% sheet. The sheet now hosts only
 * place-name search + categories.
 *
 * No persistent panel — this overlay floats above a full-screen map.
 */
import React, { useEffect, useState } from 'react'
import { Platform, Pressable, Text as RNText, useWindowDimensions, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import type { ThemedColors } from '@/hooks/useTheme'
import type { MapUiApi } from '@/types/mapUi'
import MapIcon from '../MapIcon'
import {
  TRANSPORT_ICON,
  TRANSPORT_LABEL,
  TRANSPORT_SPEED_KMH,
  type TransportMode,
} from '../transportModes'
import { getMapMobileTopOverlayStyles } from './MapMobileTopOverlay.styles'
import { MapMobileRadiusPopover } from './MapMobileRadiusPopover'
import { MapMobileLayersPopover } from './MapMobileLayersPopover'
import { MapMobileTransportPopover } from './MapMobileTransportPopover'

type ActivePopover = 'radius' | 'layers' | 'transport' | null

const BUTTON_SIZE = 44
const TOOLBAR_EDGE_OFFSET = 12
const TOOLBAR_GAP = 8
const BUTTON_STEP = BUTTON_SIZE + TOOLBAR_GAP
const RADIUS_POPOVER_RIGHT = TOOLBAR_EDGE_OFFSET + BUTTON_STEP * 2
const LAYERS_POPOVER_RIGHT = TOOLBAR_EDGE_OFFSET + BUTTON_STEP
const TRANSPORT_POPOVER_RIGHT = TOOLBAR_EDGE_OFFSET + BUTTON_STEP
const LAYERS_POPOVER_MIN_WIDTH = 272
const TRANSPORT_POPOVER_WIDTH = 204
/** How long the «tap to build» hint stays visible after entering route mode. */
const ROUTE_HINT_TIMEOUT_MS = 6000
const ROUTE_SUMMARY_POPOVER_OFFSET = 88

function formatRouteDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return ''
  if (meters < 1000) return `${Math.round(meters)} м`
  return `${(meters / 1000).toFixed(1)} км`
}

function estimateRouteDurationSeconds(meters: number, mode: TransportMode): number {
  if (!Number.isFinite(meters) || meters <= 0) return 0
  const speed = TRANSPORT_SPEED_KMH[mode] ?? TRANSPORT_SPEED_KMH.car
  return Math.round((meters / 1000 / speed) * 3600)
}

function formatRouteDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return ''
  const totalMinutes = Math.max(1, Math.round(seconds / 60))
  if (totalMinutes < 60) return `${totalMinutes} мин`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (minutes === 0) return `${hours} ч`
  return `${hours} ч ${minutes} мин`
}

interface MapMobileTopOverlayProps {
  colors: ThemedColors
  topInset: number
  /** Short radius value shown as a badge on the radius button (e.g. "50"). */
  radiusBadge: string
  /** Which inline popover is currently open (radius/layers/transport) — or null. */
  activePopover: ActivePopover
  onToggleRadius: () => void
  onToggleLayers: () => void
  onClosePopover: () => void
  onOpenFilters: () => void
  /** True when category/search filters are active — reveals the quick reset button. */
  hasActiveFilters?: boolean
  /** Reset all filters (same canonical clear-all as the filters sheet). */
  onResetFilters?: () => void
  /** Recenter the map on the user's location. */
  onCenterOnUser: () => void
  /** Open the «Места рядом» list sheet. */
  onOpenList: () => void
  /** Count of nearby places shown as a badge on the list button (e.g. "12"). */
  listBadge: string
  // Route building (mode toggle + transport profile + clear) — same store
  // actions as the desktop filters sheet (routeStore via routingSlice).
  /** Current map mode; 'route' reveals the contextual transport/clear icons. */
  mode?: 'radius' | 'route'
  transportMode?: TransportMode
  /** Enter route mode (tap the map to drop start/end points). */
  onEnterRouteMode?: () => void
  onToggleTransport?: () => void
  onTransportSelect?: (mode: TransportMode) => void
  /** Clear the route and return to radius mode. */
  onClearRoute?: () => void
  /** Number of route points dropped so far — hint hides once 2 are set. */
  routePointCount?: number
  /** Built route distance in meters. */
  routeDistance?: number | null
  /** Built route duration in seconds. */
  routeDuration?: number | null
  routingLoading?: boolean
  routingError?: string | boolean | null
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
  hasActiveFilters,
  onResetFilters,
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
  mode = 'radius',
  transportMode = 'car',
  onEnterRouteMode,
  onToggleTransport,
  onTransportSelect,
  onClearRoute,
  routePointCount = 0,
  routeDistance,
  routeDuration,
  routingLoading,
  routingError,
}) => {
  const styles = getMapMobileTopOverlayStyles(colors)
  const { width: viewportWidth } = useWindowDimensions()
  const isRouteMode = mode === 'route'
  const routeProgressLabel = isRouteMode ? `${Math.min(routePointCount, 2)}/2` : ''
  const routeAccessibilityLabel = isRouteMode
    ? `Построить маршрут: выбрано ${Math.min(routePointCount, 2)} из 2 точек`
    : 'Построить маршрут'

  // Inline hint shown when entering route mode; auto-hides after a couple of
  // taps (2 points dropped) or a short timeout so it never blocks the map.
  const [hintVisible, setHintVisible] = useState(false)
  useEffect(() => {
    if (!isRouteMode) {
      setHintVisible(false)
      return
    }
    setHintVisible(true)
    const timer = setTimeout(() => setHintVisible(false), ROUTE_HINT_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [isRouteMode])
  useEffect(() => {
    if (routePointCount >= 2) setHintVisible(false)
  }, [routePointCount])

  const distanceMeters =
    typeof routeDistance === 'number' && Number.isFinite(routeDistance)
      ? routeDistance
      : 0
  const hasRouteDistance = isRouteMode && distanceMeters > 0
  const durationSeconds =
    typeof routeDuration === 'number' && Number.isFinite(routeDuration) && routeDuration > 0
      ? routeDuration
      : estimateRouteDurationSeconds(distanceMeters, transportMode)
  const routeSummaryKey = hasRouteDistance
    ? `${transportMode}:${Math.round(distanceMeters)}:${Math.round(durationSeconds)}`
    : ''
  const [dismissedRouteSummaryKey, setDismissedRouteSummaryKey] = useState('')
  const showRouteSummary =
    hasRouteDistance && dismissedRouteSummaryKey !== routeSummaryKey
  const routeDistanceText = formatRouteDistance(distanceMeters)
  const routeDurationText = formatRouteDuration(durationSeconds)
  const routeSummaryStatus =
    routingError === 'Using direct line'
      ? 'Прямая линия'
      : routingLoading
        ? 'Маршрут обновляется'
        : 'Маршрут готов'

  // R-1 — глобальной шапки на табе карты больше нет, поэтому overlay сам отвечает
  // за отступ под статус-бар/нотч. Берём safe-area top, но держим небольшой пол,
  // чтобы кнопки не прилипали к самому краю там, где safe-area == 0.
  const resolvedTopPadding = Math.max(topInset, 8) + 8
  // Поповеры открываются прямо под своим рядом иконок.
  const basePopoverTop = resolvedTopPadding + BUTTON_SIZE + 8
  const popoverTop = basePopoverTop + (showRouteSummary ? ROUTE_SUMMARY_POPOVER_OFFSET : 0)
  const routePopoverTop = popoverTop
  const layersPopoverRight = isRouteMode
    ? TOOLBAR_EDGE_OFFSET + BUTTON_STEP * 4
    : LAYERS_POPOVER_RIGHT
  const layersPopoverWidth = Math.min(
    360,
    Math.max(
      LAYERS_POPOVER_MIN_WIDTH,
      viewportWidth - layersPopoverRight - TOOLBAR_EDGE_OFFSET,
    ),
  )

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
        <Feather name="crosshair" size={20} color={colors.primaryDark} />
      </Pressable>

      <View style={styles.toolbarStack} pointerEvents="box-none">
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

          {!isRouteMode && (
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
          )}

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

          {hasActiveFilters && onResetFilters && (
            <Pressable
              testID="map-mobile-reset-filters"
              onPress={onResetFilters}
              accessibilityRole="button"
              accessibilityLabel="Сбросить фильтры"
              hitSlop={6}
              style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
            >
              <Feather name="rotate-ccw" size={20} color={colors.text} />
            </Pressable>
          )}

          <View
            style={styles.routeToolbar}
            pointerEvents="auto"
            testID="map-mobile-route-toolbar"
          >
            <Pressable
              testID="map-mobile-route-button"
              onPress={onEnterRouteMode}
              accessibilityRole="button"
              accessibilityState={{ selected: isRouteMode }}
              accessibilityLabel={routeAccessibilityLabel}
              hitSlop={6}
              style={({ pressed }) => [
                styles.iconButton,
                isRouteMode && styles.iconButtonActive,
                pressed && styles.iconButtonPressed,
              ]}
            >
              <Feather name="navigation" size={20} color={isRouteMode ? colors.primary : colors.text} />
              {!!routeProgressLabel && (
                <View style={styles.routeProgressBadge} pointerEvents="none">
                  <RNText style={styles.badgeText} numberOfLines={1}>
                    {routeProgressLabel}
                  </RNText>
                </View>
              )}
            </Pressable>

            {isRouteMode && (
              <Pressable
                testID="map-mobile-transport-button"
                onPress={onToggleTransport}
                accessibilityRole="button"
                accessibilityState={{ expanded: activePopover === 'transport' }}
                accessibilityLabel={`Тип передвижения: ${TRANSPORT_LABEL[transportMode]}`}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.iconButton,
                  activePopover === 'transport' && styles.iconButtonActive,
                  pressed && styles.iconButtonPressed,
                ]}
              >
                <MapIcon name={TRANSPORT_ICON[transportMode]} size={20} color={colors.text} />
              </Pressable>
            )}

            {isRouteMode && (
              <Pressable
                testID="map-mobile-route-clear-button"
                onPress={onClearRoute}
                accessibilityRole="button"
                accessibilityLabel="Очистить маршрут"
                hitSlop={6}
                style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
              >
                <Feather name="x" size={20} color={colors.text} />
              </Pressable>
            )}
          </View>
        </View>

        {showRouteSummary && (
          <View
            style={styles.routeSummaryCard}
            pointerEvents="auto"
            testID="map-mobile-route-summary"
            accessibilityLiveRegion="polite"
          >
            <View style={styles.routeSummaryHeader}>
              <View style={styles.routeSummaryTitleRow}>
                <Feather name="navigation" size={13} color={colors.primaryDark} />
                <RNText style={styles.routeSummaryTitle} numberOfLines={1}>
                  {routeSummaryStatus}
                </RNText>
              </View>
              <Pressable
                testID="map-mobile-route-summary-close"
                onPress={() => setDismissedRouteSummaryKey(routeSummaryKey)}
                accessibilityRole="button"
                accessibilityLabel="Скрыть сводку маршрута"
                hitSlop={8}
                style={({ pressed }) => [
                  styles.routeSummaryClose,
                  pressed && styles.routeSummaryClosePressed,
                ]}
              >
                <Feather name="x" size={15} color={colors.textMuted} />
              </Pressable>
            </View>
            <View style={styles.routeSummaryMetrics}>
              <View style={styles.routeSummaryMetric}>
                <Feather name="map" size={12} color={colors.primary} />
                <RNText style={styles.routeSummaryMetricText} numberOfLines={1}>
                  {routeDistanceText}
                </RNText>
              </View>
              {!!routeDurationText && (
                <View style={styles.routeSummaryMetric}>
                  <Feather name="clock" size={12} color={colors.primary} />
                  <RNText style={styles.routeSummaryMetricText} numberOfLines={1}>
                    {routeDurationText}
                  </RNText>
                </View>
              )}
              {routingError === 'Using direct line' && (
                <RNText style={styles.routeSummaryNote} numberOfLines={1}>
                  прямая линия
                </RNText>
              )}
            </View>
          </View>
        )}
      </View>

      {activePopover === 'radius' && (
        <MapMobileRadiusPopover
          colors={colors}
          top={basePopoverTop}
          right={RADIUS_POPOVER_RIGHT}
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
          right={layersPopoverRight}
          minWidth={layersPopoverWidth}
          maxWidth={layersPopoverWidth}
          mapUiApi={mapUiApi}
          overlayOptions={overlayOptions}
          enabledOverlays={enabledOverlays}
          onOverlayToggle={onOverlayToggle}
          onResetOverlays={onResetOverlays}
          onRequestClose={onClosePopover}
        />
      )}

      {isRouteMode && activePopover === 'transport' && onTransportSelect && (
        <MapMobileTransportPopover
          colors={colors}
          top={routePopoverTop}
          right={TRANSPORT_POPOVER_RIGHT}
          minWidth={TRANSPORT_POPOVER_WIDTH}
          maxWidth={TRANSPORT_POPOVER_WIDTH}
          currentValue={transportMode}
          onSelect={onTransportSelect}
          onRequestClose={onClosePopover}
        />
      )}

      {isRouteMode && hintVisible && !activePopover && (
        <View
          style={[styles.routeHint, { top: routePopoverTop }]}
          pointerEvents="none"
          testID="map-mobile-route-hint"
        >
          <Feather name="map-pin" size={13} color={colors.primaryDark} />
          <RNText style={styles.routeHintText} numberOfLines={2}>
            Коснитесь карты: 1-я точка — старт, 2-я — финиш
          </RNText>
        </View>
      )}
    </View>
  )
}

export const MapMobileTopOverlay = React.memo(MapMobileTopOverlayInner)

export const IS_TOP_OVERLAY_WEB = Platform.OS === 'web'
