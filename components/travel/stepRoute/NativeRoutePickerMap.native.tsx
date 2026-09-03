import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { WebView } from 'react-native-webview'
import Feather from '@expo/vector-icons/Feather'

import { buildBirdMarkerHtml } from '@/components/MapPage/Map/mapMarkerStyles'
import { DEFAULT_CENTER } from '@/components/MapPage/Map/travelMapGeometry'
import { OSM_ATTRIBUTION_URL } from '@/config/mapWebTileContract'
import { DESIGN_COLORS, DESIGN_TOKENS } from '@/constants/designSystem'
import { loadExpoLocation } from '@/hooks/map/expoLocationLoader'
import { useThemedColors } from '@/hooks/useTheme'
import type { MarkerData } from '@/types/types'
import { openExternalUrl } from '@/utils/externalLinks'
import { showToastMessage } from '@/utils/toast'
import { translate as i18nT } from '@/i18n'

import { resolveRoutePickerMapHeight } from './helpers'
import { buildRoutePickerNativeHtml } from './routePickerNativeHtml'

const BIRD_MARKER_HTML = buildBirdMarkerHtml()

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
 * #1722 — то же действие «Добавить точку» нужно и списку точек под картой:
 * докрутив до списка, пользователь уже не видит шапку карты. Отдаём его
 * императивно, чтобы обе кнопки вели в один и тот же путь POINT_ADD.
 */
export interface NativeRoutePickerMapHandle {
  addPointAtCenter: () => void
}

/**
 * #1040 — Интерактивная карта выбора точек маршрута для native (Android; с
 * #1722 приёмка распространена и на iOS). Раньше здесь была статичная заглушка
 * «Карта доступна в браузере», из-за чего с телефона нельзя было поставить
 * точку на карте.
 *
 * HTML строится ОДИН раз (центр фиксируется на первом рендере), а точки
 * доставляются в WebView через injectJavaScript — иначе пересборка html
 * перезагружала бы WebView и сбрасывала позицию/зум после каждой правки.
 */
export const NativeRoutePickerMap = React.memo(
  React.forwardRef<NativeRoutePickerMapHandle, NativeRoutePickerMapProps>(function NativeRoutePickerMap({
  markers,
  onAddPoint,
  onMovePoint,
  onSelectPoint,
}: NativeRoutePickerMapProps, ref) {
  const colors = useThemedColors()
  const { height: windowHeight } = useWindowDimensions()
  const mapHeight = useMemo(() => resolveRoutePickerMapHeight(windowHeight), [windowHeight])
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
        if (parsed?.type === 'OPEN_URL' && parsed.url === OSM_ATTRIBUTION_URL) {
          void openExternalUrl(parsed.url, { allowedProtocols: ['https:'] })
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

  // #1722 — «Добавить точку» ставит точку в текущий центр полотна. Координаты
  // берёт сам WebView и присылает обычным POINT_ADD, поэтому обратный геокодер,
  // нумерация и автосейв у кнопки и у тапа по карте общие.
  const addPointAtCenter = useCallback(() => {
    webViewRef.current?.injectJavaScript('window.__mtRouteAddCenterPoint();true;')
  }, [])

  useImperativeHandle(ref, () => ({ addPointAtCenter }), [addPointAtCenter])

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
      {/* #1722 — подсказка и действия ВЫШЕ полотна. Пока они были подвалом под
          картой в 380 пт, на 375×812 в видимую полосу шага не попадал ни один
          способ добавить точку: экран показывал только карту. */}
      <View style={styles.controls} testID="travel-wizard.step-route.native-map-controls">
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {i18nT('travel:components.travel.stepRoute.NativeRoutePickerMap.hint')}
        </Text>
        <View style={styles.actionsRow}>
          <Pressable
            onPress={addPointAtCenter}
            style={({ pressed }) => [
              styles.addButton,
              { backgroundColor: colors.primary },
              pressed && { opacity: 0.8 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={i18nT('travel:components.travel.stepRoute.NativeRoutePickerMap.addPoint')}
            accessibilityHint={i18nT('travel:components.travel.stepRoute.NativeRoutePickerMap.addPointHint')}
            testID="travel-wizard.step-route.add-point"
          >
            <Feather name="plus" size={16} color={colors.textOnPrimary} />
            <Text style={[styles.addLabel, { color: colors.textOnPrimary }]} numberOfLines={1}>
              {i18nT('travel:components.travel.stepRoute.NativeRoutePickerMap.addPoint')}
            </Text>
          </Pressable>
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
              <Feather name="crosshair" size={18} color={colors.primaryDark} />
            )}
          </Pressable>
        </View>
      </View>

      <View style={[styles.mapBox, { height: mapHeight }]} testID="travel-wizard.step-route.native-map-canvas">
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
    </View>
  )
}),
)

export default NativeRoutePickerMap

const styles = StyleSheet.create({
  container: {
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  mapBox: {
    // Высота приходит из `resolveRoutePickerMapHeight` — она зависит от окна.
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
  controls: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
  },
  hint: {
    width: '100%',
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    lineHeight: 18,
  },
  // Действия в один ряд: подпись несёт только основное «Добавить точку», а
  // геолокация ужата до иконки — два ряда кнопок по 48 пт снова вытолкнули бы
  // карту из видимой полосы шага, ради чего всё и переносилось (#1722).
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    minHeight: DESIGN_TOKENS.touchTarget.minHeight,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
  },
  addLabel: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '700',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: DESIGN_TOKENS.touchTarget.minHeight,
    minHeight: DESIGN_TOKENS.touchTarget.minHeight,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
  },
})
