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
  getTransportLabel,
  TRANSPORT_SPEED_KMH,
  type TransportMode,
} from '../transportModes'
import { getMapMobileTopOverlayStyles } from './MapMobileTopOverlay.styles'
import { MapMobileRadiusPopover } from './MapMobileRadiusPopover'
import { MapMobileLayersPopover } from './MapMobileLayersPopover'
import { MapMobileTransportPopover } from './MapMobileTransportPopover'
import { translate as i18nT } from '@/i18n'


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
  if (meters < 1000) return i18nT('map:components.MapPage.MapMobile.MapMobileTopOverlay.value1_m_5d0efb19', { value1: Math.round(meters) })
  return i18nT('map:components.MapPage.MapMobile.MapMobileTopOverlay.value1_km_6c6f740a', { value1: (meters / 1000).toFixed(1) })
}

function estimateRouteDurationSeconds(meters: number, mode: TransportMode): number {
  if (!Number.isFinite(meters) || meters <= 0) return 0
  const speed = TRANSPORT_SPEED_KMH[mode] ?? TRANSPORT_SPEED_KMH.car
  return Math.round((meters / 1000 / speed) * 3600)
}

function formatRouteDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return ''
  const totalMinutes = Math.max(1, Math.round(seconds / 60))
  if (totalMinutes < 60) return i18nT('map:components.MapPage.MapMobile.MapMobileTopOverlay.value1_min_b586289b', { value1: totalMinutes })
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (minutes === 0) return i18nT('map:components.MapPage.MapMobile.MapMobileTopOverlay.value1_ch_53da1ce7', { value1: hours })
  return i18nT('map:components.MapPage.MapMobile.MapMobileTopOverlay.value1_ch_value2_min_0833ca5d', { value1: hours, value2: minutes })
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
  /** True when category/search filters are active — highlights the «Показать всё» button. */
  hasActiveFilters?: boolean
  /** Recenter the map on the user's location. */
  onCenterOnUser: () => void
  /**
   * Always-visible «Показать всё»: reset filters + fit the map to ALL loaded
   * markers. Also the escape-hatch when the map is stuck on the Minsk fallback
   * (geolocation denied/timeout).
   */
  onShowAllPlaces?: () => void
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
  hasUserLocation?: boolean
  routeManualStartActive?: boolean
  onRequestLocation?: () => void
  onStartManualRoute?: () => void
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
  onShowAllPlaces,
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
  hasUserLocation = false,
  routeManualStartActive = false,
  onRequestLocation,
  onStartManualRoute,
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
  const needsRouteStartChoice =
    isRouteMode && routePointCount === 0 && !hasUserLocation && !routeManualStartActive
  const routeAccessibilityLabel = isRouteMode
    ? routePointCount === 1
      ? i18nT('map:components.MapPage.MapMobile.MapMobileTopOverlay.marshrut_ot_menya_vyberite_mesto_naznacheniy_ae2deeeb')
      : i18nT('map:components.MapPage.MapMobile.MapMobileTopOverlay.postroit_marshrut_vybrano_value1_iz_2_tochek_926447de', { value1: Math.min(routePointCount, 2) })
    : i18nT('map:components.MapPage.MapMobile.MapMobileTopOverlay.postroit_marshrut_da7efcc5')
  const routeHintText = routePointCount === 1
    ? i18nT('map:components.MapPage.MapMobile.MapMobileTopOverlay.start_zadan_moe_mestopolozhenie_vyberite_mes_0022783b')
    : needsRouteStartChoice
      ? i18nT('map:components.MapPage.MapMobile.MapMobileTopOverlay.tekuschee_polozhenie_ne_opredeleno_razreshit_7df55703')
      : i18nT('map:components.MapPage.MapMobile.MapMobileTopOverlay.kosnites_karty_1_ya_tochka_start_2_ya_finish_462b6762')

  // Inline hint shown when entering route mode; auto-hides after a couple of
  // taps (2 points dropped) or a short timeout so it never blocks the map.
  const [hintVisible, setHintVisible] = useState(false)
  useEffect(() => {
    if (!isRouteMode) {
      setHintVisible(false)
      return
    }
    setHintVisible(true)
    if (needsRouteStartChoice) return
    const timer = setTimeout(() => setHintVisible(false), ROUTE_HINT_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [isRouteMode, needsRouteStartChoice])
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
      ? i18nT('map:components.MapPage.MapMobile.MapMobileTopOverlay.pryamaya_liniya_79c7e056')
      : routingLoading
        ? i18nT('map:components.MapPage.MapMobile.MapMobileTopOverlay.marshrut_obnovlyaetsya_eab45ca3')
        : i18nT('map:components.MapPage.MapMobile.MapMobileTopOverlay.marshrut_gotov_e4454e9a')

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
        accessibilityLabel={i18nT('map:components.MapPage.MapMobile.MapMobileTopOverlay.pokazat_moe_mestopolozhenie_e7418fde')}
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
            accessibilityLabel={i18nT('map:components.MapPage.MapMobile.MapMobileTopOverlay.otkryt_filtry_2e8bb063')}
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
              accessibilityLabel={i18nT('map:components.MapPage.MapMobile.MapMobileTopOverlay.radius_value1_760a1afd', { value1: radiusBadge ? ` ${radiusBadge}` : '' })}
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
            accessibilityLabel={i18nT('map:components.MapPage.MapMobile.MapMobileTopOverlay.sloi_i_nastroyki_karty_603c618f')}
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
            accessibilityLabel={i18nT('map:components.MapPage.MapMobile.MapMobileTopOverlay.pokazat_spisok_ryadom_value1_1dee15c6', { value1: listBadge ? ` — ${listBadge}` : '' })}
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

          {/* «Показать всё»: сбрасывает фильтры И подгоняет карту под все точки.
              Всегда видима в radius-режиме — заодно escape-hatch, когда карта
              «застряла» на Минск-fallback (геолокация отклонена/таймаут). Отдельная
              кнопка «сбросить фильтры» больше не нужна: она была подмножеством этой. */}
          {!isRouteMode && onShowAllPlaces && (
            <Pressable
              testID="map-mobile-show-all"
              onPress={onShowAllPlaces}
              accessibilityRole="button"
              accessibilityLabel={i18nT('map:components.MapPage.MapMobile.MapMobileTopOverlay.pokazat_vse_mesta_na_karte_i_sbrosit_filtry_88e4aa0a')}
              hitSlop={6}
              style={({ pressed }) => [
                styles.iconButton,
                hasActiveFilters && styles.iconButtonActive,
                pressed && styles.iconButtonPressed,
              ]}
            >
              <Feather name="maximize" size={20} color={colors.text} />
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
                accessibilityLabel={i18nT('map:components.MapPage.MapMobile.MapMobileTopOverlay.tip_peredvizheniya_value1_d6bdfd68', { value1: getTransportLabel(transportMode) })}
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
                accessibilityLabel={i18nT('map:components.MapPage.MapMobile.MapMobileTopOverlay.ochistit_marshrut_3265b685')}
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
                accessibilityLabel={i18nT('map:components.MapPage.MapMobile.MapMobileTopOverlay.skryt_svodku_marshruta_9d781c25')}
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
                  {i18nT('map:components.MapPage.MapMobile.MapMobileTopOverlay.pryamaya_liniya_e561a708')}</RNText>
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
          pointerEvents={needsRouteStartChoice ? 'box-none' : 'none'}
          testID="map-mobile-route-hint"
        >
          <Feather name="map-pin" size={13} color={colors.primaryDark} />
          <RNText style={styles.routeHintText} numberOfLines={2}>
            {routeHintText}
          </RNText>
          {needsRouteStartChoice && (
            <View style={styles.routeHintActions} pointerEvents="auto">
              {!!onRequestLocation && (
                <Pressable
                  testID="map-mobile-route-request-location"
                  onPress={onRequestLocation}
                  accessibilityRole="button"
                  accessibilityLabel={i18nT('map:components.MapPage.MapMobile.MapMobileTopOverlay.razreshit_geolokatsiyu_dlya_marshruta_027a0102')}
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.routeHintActionPrimary,
                    pressed && styles.routeHintActionPressed,
                  ]}
                >
                  <RNText style={styles.routeHintActionPrimaryText} numberOfLines={1}>
                    {i18nT('map:components.MapPage.MapMobile.MapMobileTopOverlay.razreshit_b419aad0')}</RNText>
                </Pressable>
              )}
              {!!onStartManualRoute && (
                <Pressable
                  testID="map-mobile-route-manual-start"
                  onPress={onStartManualRoute}
                  accessibilityRole="button"
                  accessibilityLabel={i18nT('map:components.MapPage.MapMobile.MapMobileTopOverlay.ukazat_start_marshruta_vruchnuyu_d0723436')}
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.routeHintActionSecondary,
                    pressed && styles.routeHintActionPressed,
                  ]}
                >
                  <RNText style={styles.routeHintActionSecondaryText} numberOfLines={1}>
                    {i18nT('map:components.MapPage.MapMobile.MapMobileTopOverlay.ukazat_start_337c5937')}</RNText>
                </Pressable>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  )
}

export const MapMobileTopOverlay = React.memo(MapMobileTopOverlayInner)

export const IS_TOP_OVERLAY_WEB = Platform.OS === 'web'
