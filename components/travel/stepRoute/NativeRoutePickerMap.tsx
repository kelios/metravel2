import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { WebView } from 'react-native-webview'
import Feather from '@expo/vector-icons/Feather'

import { buildBirdMarkerHtml } from '@/components/MapPage/Map/mapMarkerStyles'
import { DEFAULT_CENTER } from '@/components/MapPage/Map/travelMapGeometry'
import { DESIGN_COLORS, DESIGN_TOKENS } from '@/constants/designSystem'
import { loadExpoLocation } from '@/hooks/map/expoLocationLoader'
import { useThemedColors } from '@/hooks/useTheme'
import type { MarkerData } from '@/types/types'
import { showToastMessage } from '@/utils/toast'
import { translate as i18nT } from '@/i18n'

import { buildRoutePickerNativeHtml } from './routePickerNativeHtml'

const BIRD_MARKER_HTML = buildBirdMarkerHtml()
const MAP_HEIGHT = 380

interface NativeRoutePickerMapProps {
  markers: MarkerData[]
  /** Тап по пустой карте — создать точку в этих координатах. */
  onAddPoint: (lat: number, lng: number) => void
  /** Перетаскивание маркера — обновить координаты точки. */
  onMovePoint: (index: number, lat: number, lng: number) => void
  /** Тап по маркеру — открыть редактор точки. */
  onSelectPoint: (index: number) => void
}

/**
 * #1040 — Интерактивная карта выбора точек маршрута для native (Android).
 * Раньше здесь была статичная заглушка «Карта доступна в браузере», из-за чего
 * с телефона нельзя было поставить точку на карте.
 *
 * HTML строится ОДИН раз (центр фиксируется на первом рендере), а точки
 * доставляются в WebView через injectJavaScript — иначе пересборка html
 * перезагружала бы WebView и сбрасывала позицию/зум после каждой правки.
 */
export const NativeRoutePickerMap = React.memo(function NativeRoutePickerMap({
  markers,
  onAddPoint,
  onMovePoint,
  onSelectPoint,
}: NativeRoutePickerMapProps) {
  const colors = useThemedColors()
  const webViewRef = useRef<WebView>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLocating, setIsLocating] = useState(false)
  const isMapReadyRef = useRef(false)
  const hasFittedRef = useRef(false)

  // Стартовый вид фиксируем на первом рендере: он не должен менять html (иначе
  // WebView перезагрузится и потеряет позицию карты при каждом добавлении точки).
  const [initialView] = useState<{ center: [number, number]; zoom: number }>(() => {
    const first = markers.find((m) => Number.isFinite(m?.lat) && Number.isFinite(m?.lng))
    return first
      ? { center: [Number(first.lat), Number(first.lng)], zoom: 12 }
      : { center: DEFAULT_CENTER, zoom: 6 }
  })

  const html = useMemo(
    () =>
      buildRoutePickerNativeHtml({
        center: initialView.center,
        initialZoom: initialView.zoom,
        birdMarkerHtml: BIRD_MARKER_HTML,
        routeColor: DESIGN_COLORS.routeLine,
      }),
    [initialView],
  )

  const pushPoints = useCallback(
    (shouldFit: boolean) => {
      if (!isMapReadyRef.current) return
      const payload = markers
        .filter((m) => Number.isFinite(m?.lat) && Number.isFinite(m?.lng))
        .map((m) => ({ lat: Number(m.lat), lng: Number(m.lng) }))
      webViewRef.current?.injectJavaScript(
        `window.__mtRouteSetPoints(${JSON.stringify(JSON.stringify(payload))}, ${shouldFit ? 'true' : 'false'});true;`,
      )
    },
    [markers],
  )

  useEffect(() => {
    const shouldFit = !hasFittedRef.current && markers.length > 0
    pushPoints(shouldFit)
    if (shouldFit) hasFittedRef.current = true
  }, [markers, pushPoints])

  const handleMessage = useCallback(
    (event: { nativeEvent?: { data?: string } }) => {
      const raw = String(event?.nativeEvent?.data ?? '')
      if (!raw) return
      try {
        const parsed = JSON.parse(raw)
        if (parsed?.type === 'MAP_READY') {
          isMapReadyRef.current = true
          const shouldFit = markers.length > 0
          pushPoints(shouldFit)
          if (shouldFit) hasFittedRef.current = true
          return
        }
        if (parsed?.type === 'POINT_ADD') {
          const lat = Number(parsed.lat)
          const lng = Number(parsed.lng)
          if (Number.isFinite(lat) && Number.isFinite(lng)) onAddPoint(lat, lng)
          return
        }
        if (parsed?.type === 'POINT_MOVE') {
          const index = Number(parsed.index)
          const lat = Number(parsed.lat)
          const lng = Number(parsed.lng)
          if (Number.isInteger(index) && Number.isFinite(lat) && Number.isFinite(lng)) {
            onMovePoint(index, lat, lng)
          }
          return
        }
        if (parsed?.type === 'POINT_SELECT') {
          const index = Number(parsed.index)
          if (Number.isInteger(index)) onSelectPoint(index)
        }
      } catch {
        // noop
      }
    },
    [markers.length, onAddPoint, onMovePoint, onSelectPoint, pushPoints],
  )

  const handleMyLocation = useCallback(async () => {
    if (isLocating) return
    setIsLocating(true)
    try {
      const Location = await loadExpoLocation()
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        await showToastMessage({
          type: 'error',
          text1: i18nT('travel:components.travel.stepRoute.NativeRoutePickerMap.locationDeniedTitle'),
          text2: i18nT('travel:components.travel.stepRoute.NativeRoutePickerMap.locationDeniedBody'),
        })
        return
      }
      const position = await Location.getCurrentPositionAsync({})
      const lat = Number(position?.coords?.latitude)
      const lng = Number(position?.coords?.longitude)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return

      webViewRef.current?.injectJavaScript(`window.__mtRouteFlyTo(${lat}, ${lng}, 15);true;`)
      onAddPoint(lat, lng)
    } catch {
      await showToastMessage({
        type: 'error',
        text1: i18nT('travel:components.travel.stepRoute.NativeRoutePickerMap.locationFailedTitle'),
      })
    } finally {
      setIsLocating(false)
    }
  }, [isLocating, onAddPoint])

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.mapBox}>
        {isLoading && (
          <View style={[styles.loader, { backgroundColor: colors.backgroundSecondary }]}>
            <ActivityIndicator size="large" color={colors.primaryDark} />
          </View>
        )}
        <WebView
          ref={webViewRef}
          source={{ html }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
          onLoadEnd={() => setIsLoading(false)}
          onMessage={handleMessage}
          // Карта живёт внутри вертикального ScrollView шага: без этого жесты
          // панорамирования/зума перехватывались бы скроллом страницы.
          nestedScrollEnabled
          scrollEnabled={false}
          testID="travel-wizard.step-route.native-map"
        />
      </View>

      <View style={styles.footer}>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {i18nT('travel:components.travel.stepRoute.NativeRoutePickerMap.hint')}
        </Text>
        <Pressable
          onPress={handleMyLocation}
          disabled={isLocating}
          style={({ pressed }) => [
            styles.locationButton,
            { borderColor: colors.border, backgroundColor: colors.background },
            pressed && { opacity: 0.7 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={i18nT('travel:components.travel.stepRoute.NativeRoutePickerMap.myLocation')}
          testID="travel-wizard.step-route.my-location"
        >
          {isLocating ? (
            <ActivityIndicator size="small" color={colors.primaryDark} />
          ) : (
            <Feather name="crosshair" size={16} color={colors.primaryDark} />
          )}
          <Text style={[styles.locationLabel, { color: colors.primaryDark }]} numberOfLines={1}>
            {i18nT('travel:components.travel.stepRoute.NativeRoutePickerMap.myLocation')}
          </Text>
        </Pressable>
      </View>
    </View>
  )
})

export default NativeRoutePickerMap

const styles = StyleSheet.create({
  container: {
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  mapBox: {
    height: MAP_HEIGHT,
    width: '100%',
    position: 'relative',
  },
  webview: {
    flex: 1,
    width: '100%',
    backgroundColor: 'transparent',
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
  },
  hint: {
    flex: 1,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    lineHeight: 18,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    minHeight: DESIGN_TOKENS.touchTarget.minHeight,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
  },
  locationLabel: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600',
  },
})
