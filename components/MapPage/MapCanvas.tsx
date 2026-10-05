import { useEffect, useState } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { MapPageSkeleton } from '@/components/MapPage/MapPageSkeleton'
import MapPanel from '@/components/MapPage/MapPanel'
import { MapOverlayLayer } from '@/components/MapPage/MapOverlayLayer'
import { MapLoadingBar } from '@/components/MapPage/MapLoadingBar'
import WeatherLegend from '@/components/MapPage/WeatherLegend'
import { translate as i18nT } from '@/i18n'
import type { CoordinatesSource, MapLocationState } from '@/hooks/map/useMapCoordinates'
import { getLiveUserPositionFixAt } from '@/hooks/map/liveUserPosition'
import { DESKTOP_MAP_LEFT_COLUMN_TOP } from '@/screens/tabs/mapDesktopCorner'
import { webTitleRef } from '@/utils/webProps'


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
  showGeoBanner: boolean
  /**
   * На сколько опустить гео-баннер, чтобы он встал ПОД ряд чипов активных
   * фильтров. Ряд живёт в overlay-слое (MapMobileTopOverlay), баннер — в слое
   * карты: разные поддеревья, общий вертикальный поток невозможен, поэтому
   * сдвиг передаётся явно. 0 на десктопе и когда чипов нет.
   */
  geoBannerStackOffset?: number
  /** #1812 — сдвиг пилюли качества под плашку «нет сети», см. getMapTopStackOffsets. */
  locationQualityStackOffset?: number
  locationState: MapLocationState
  coordinatesSource: CoordinatesSource
  dismissGeoBanner: () => void
  retryLocation: () => void
  openLocationSettings: () => void
  startManualRoute: () => void
  canSearchThisArea?: boolean
  onSearchThisArea?: () => void
  /**
   * #2219 — «Моё местоположение» на планшетной ширине приложения. На web ту же
   * кнопку рисует Leaflet-колонка `MapControls` внутри карты (движок), в
   * WebView-карте плавающих контролов нет — их рисует этот слой. Обязателен:
   * потеря проводки ловится `tsc`, а не пустым местом на iPad.
   */
  onCenterUser: () => void
}

// Та же точка, что у web-колонки `MapControls` на desktop: левый край карты,
// под полосой шеврона панели (`mapDesktopCorner.ts`, #2220).
const NATIVE_DESKTOP_LOCATE_LEFT = 16
const NATIVE_DESKTOP_CONTROL_SIZE = 44

export function MapCanvas({
  styles,
  themedColors,
  isWeb,
  isMobile,
  showProgress,
  mapReady,
  mapPanelProps,
  enabledOverlays,
  showGeoBanner,
  geoBannerStackOffset = 0,
  locationQualityStackOffset = 0,
  locationState,
  coordinatesSource,
  dismissGeoBanner,
  retryLocation,
  openLocationSettings,
  startManualRoute,
  canSearchThisArea,
  onSearchThisArea,
  onCenterUser,
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
  const isRouteMode = mapPanelProps?.mode === 'route'
  // Пустой ряд действий не должен добавлять баннеру вторую строку и её gap.
  const hasGeoBannerActions = canRetryLocation || canOpenSettings || isRouteMode
  // Баннер держится минимальным: короткий статус + до двух действий («указать
  // старт вручную» осмысленно только внутри режима маршрута и живёт там). На
  // мобиле статус и действия разнесены по двум строкам (#1780) — инлайн они не
  // помещались и статус усекался до «Геолокация недос…»; на десктопе баннер
  // по-прежнему однострочный.
  const geoBannerMessage = hasCachedViewport
    ? i18nT('map:components.MapPage.MapCanvas.poslednee_izvestnoe_mesto_2b6f90c3')
    : i18nT('map:components.MapPage.MapCanvas.geolokatsiya_nedostupna_7c41d5e8')
  // Живые тики намеренно не обновляют locationState (иначе экран перерисовывается на
  // каждый GPS-фикс во время движения), поэтому свежесть считаем по внешнему каналу:
  // компонент и так тикает раз в 15 с своим locationClock. См. hooks/map/liveUserPosition.
  //
  // Берём именно ПУЛЬС приёма фиксов, а не время последней опубликованной точки:
  // публикация пропускает сдвиги меньше 12 м, поэтому у стоящего на месте
  // пользователя точка не обновлялась бы никогда и баннер загорался бы через 30 с
  // на ровном месте. По той же причине не годится и timestamp из ОС — первый фикс
  // Android нередко отдаёт из кэша уже «просроченным».
  const lastFixAt = locationState.status === 'current'
    ? Math.max(locationState.timestamp, getLiveUserPositionFixAt())
    : 0
  const locationQuality = locationState.status === 'current'
    ? locationState.isRefreshing
      ? 'refreshing'
      : typeof locationState.accuracy === 'number' && locationState.accuracy > LOCATION_LOW_ACCURACY_METERS
        ? 'lowAccuracy'
        : locationClock - lastFixAt > LOCATION_STALE_AFTER_MS
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

  const showSearchThisArea = !isMobile && !!canSearchThisArea && !!onSearchThisArea

  return (
    <View
      style={styles.mapArea}
      {...(Platform.OS === 'web' ? ({ dataSet: { mapArea: 'true' } } as any) : null)}
    >
      <MapLoadingBar visible={showProgress} />
      {mapReady ? (
        <MapPanel {...mapPanelProps} hideFloatingControls={isMobile} />
      ) : (
        MAP_PANEL_PLACEHOLDER
      )}
      {isWeb && (
        <WeatherLegend enabledOverlays={enabledOverlays} />
      )}
      {/* Everything over the map lives in one layer after it (#2219):
          see MapOverlayLayer for the Android touch-order invariant. */}
      <MapOverlayLayer>
        {/* The map's top row on the desktop branch (#2219, #2304): the
            quality pill and «Искать в этой области» share ONE flex row in the
            free band (`desktopSearchAreaBand`) — they cannot overlap; while the
            action shows, the quality pill folds to its icon. No hitSlop over
            the native map (#2236); own 44 box. */}
        {!isMobile && (showSearchThisArea || !!locationQualityMessage) && (
          <View style={styles.desktopSearchAreaBand} pointerEvents="box-none" testID="map-top-band">
            {!!locationQualityMessage && (
              <View
                style={[styles.desktopBandQualityPill, showSearchThisArea && styles.desktopBandQualityPillCompact]}
                testID="map-location-quality"
                accessible={showSearchThisArea || undefined}
                accessibilityLabel={showSearchThisArea ? locationQualityMessage : undefined}
                // Web: a role-less <div> exposes no name, so the folded icon is
                // an `img` named by the message; mouse users get it as the title.
                accessibilityRole={showSearchThisArea && isWeb ? 'image' : undefined}
                ref={webTitleRef<View>(showSearchThisArea ? locationQualityMessage : null)}
                accessibilityLiveRegion="polite"
              >
                <Feather
                  name={locationQuality === 'refreshing' ? 'refresh-cw' : 'crosshair'}
                  size={13}
                  color={themedColors.warning}
                />
                {!showSearchThisArea && (
                  <Text style={styles.locationQualityText} numberOfLines={2}>
                    {locationQualityMessage}
                  </Text>
                )}
              </View>
            )}
            {showSearchThisArea && (
              <View style={styles.desktopSearchAreaSlot} pointerEvents="box-none">
                <Pressable
                  style={({ pressed }) => [
                    styles.desktopSearchAreaButton,
                    pressed && { opacity: 0.9 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={i18nT('map:components.MapPage.MapCanvas.iskat_v_etoy_oblasti_80b413e4')}
                  testID="map-search-this-area-desktop"
                  onPress={onSearchThisArea}
                >
                  <Feather name="refresh-cw" size={15} color={themedColors.textOnPrimary} />
                  <Text style={styles.desktopSearchAreaButtonText} numberOfLines={1}>
                    {i18nT('map:components.MapPage.MapCanvas.iskat_v_etoy_oblasti_80b413e4')}</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
        {!isWeb && !isMobile && (
          <Pressable
            testID="map-desktop-locate-button"
            onPress={onCenterUser}
            accessibilityRole="button"
            accessibilityLabel={i18nT('map:components.MapPage.MapMobile.MapMobileTopOverlay.pokazat_moe_mestopolozhenie_e7418fde')}
            style={({ pressed }) => [
              {
                position: 'absolute',
                top: DESKTOP_MAP_LEFT_COLUMN_TOP,
                left: NATIVE_DESKTOP_LOCATE_LEFT,
                width: NATIVE_DESKTOP_CONTROL_SIZE,
                height: NATIVE_DESKTOP_CONTROL_SIZE,
                borderRadius: NATIVE_DESKTOP_CONTROL_SIZE / 2,
                backgroundColor: themedColors.surfaceMuted,
                borderWidth: 1,
                borderColor: themedColors.borderLight,
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1001,
                ...themedColors.shadows?.medium,
              },
              pressed && PRESSED_OPACITY_06,
            ]}
          >
            <Feather name="crosshair" size={20} color={themedColors.primaryDark} />
          </Pressable>
        )}
        {isMobile && !!locationQualityMessage && (
          <View
            // marginTop сдвигает absolute-пилюлю вниз тем же приёмом, что и
            // гео-баннер: её `top` собран в map.styles.ts из safe-area и высоты
            // тулбара, а ярусы над ней приходят снаружи.
            style={[
              styles.locationQualityPill,
              locationQualityStackOffset > 0 ? { marginTop: locationQualityStackOffset } : null,
            ]}
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
          // marginTop сдвигает absolute-баннер вниз, не дублируя расчёт его `top`
          // (он собран в map.styles.ts из safe-area + высоты тулбара).
          <View
            style={[
              styles.geoBanner,
              geoBannerStackOffset > 0 ? { marginTop: geoBannerStackOffset } : null,
            ]}
            testID="map-geo-banner"
          >
            <View style={styles.geoBannerMain}>
              <Feather name="map-pin" size={13} color={themedColors.warning} />
              {/* На мобиле статус занимает всю ширину баннера, поэтому
                  «Геолокация недоступна» помещается целиком: раньше инлайновая
                  кнопка съедала 135 pt из 355 и резала текст многоточием. */}
              <Text style={styles.geoBannerText} numberOfLines={2}>
                {geoBannerMessage}
              </Text>
            </View>
            {hasGeoBannerActions && (
              <View style={styles.geoBannerActions} testID="map-geo-banner-actions">
                {canRetryLocation && (
                  <Pressable
                    testID="map-geo-retry"
                    onPress={retryLocation}
                    accessibilityRole="button"
                    // Явный label: у Pressable с вложенным Text доступное имя на web не
                    // выводилось (кнопка «Разрешить» читалась как безымянная).
                    accessibilityLabel={
                      locationState.status === 'denied'
                        ? i18nT('map:components.MapPage.MapMobile.MapMobileTopOverlay.razreshit_b419aad0')
                        : i18nT('map:components.MapPage.MapCanvas.povtorit_66ddcbbc')
                    }
                    style={({ pressed }) => [
                      styles.geoBannerActionPrimary,
                      pressed && PRESSED_OPACITY_06,
                    ]}
                  >
                    <Text style={styles.geoBannerActionPrimaryText} numberOfLines={1}>
                      {locationState.status === 'denied'
                        ? i18nT('map:components.MapPage.MapMobile.MapMobileTopOverlay.razreshit_b419aad0')
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
                {/* Ручной старт — действие режима маршрута, а не общего гео-статуса.
                    В radius-режиме он вёл в маршрут из баннера про геолокацию. */}
                {isRouteMode && (
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
                      {i18nT('map:components.MapPage.MapMobile.MapMobileTopOverlay.ukazat_start_337c5937')}
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
            <Pressable
              onPress={dismissGeoBanner}
              accessibilityRole="button"
              accessibilityLabel={i18nT('map:components.MapPage.MapCanvas.zakryt_uvedomlenie_ae069cb3')}
              style={({ pressed }) => [styles.geoBannerClose, pressed && PRESSED_OPACITY_06]}
            >
              <View style={styles.geoBannerCloseShape}>
                <Feather name="x" size={12} color={themedColors.textMuted} />
              </View>
            </Pressable>
          </View>
        )}
      </MapOverlayLayer>
    </View>
  )
}
