// Карта конструктора маршрута на native (#1345).
//
// Раньше здесь была текстовая карточка «на web можно добавлять точки кликом по
// карте»: в приложении маршрут на карте не показывался вообще. Теперь экран
// использует тот же WebView+Leaflet стек, что и /map (`components/MapPage/Map` →
// `Map.ios`, который ре-экспортирует `Map.android`), поэтому маршрут, точки и
// контрол «Слои» (#1306) совпадают с mobile web по составу и поведению.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RouteGeometry, RoutingState, RoutePoint, RouteSummary, TripTransport } from '@/api/plannedTrips';
import MapComponent from '@/components/MapPage/Map';
import MapIcon from '@/components/MapPage/MapIcon';
import { MapMobileLayersPopover } from '@/components/MapPage/MapMobile/MapMobileLayersPopover';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import {
  FOCUS_POINT_ZOOM,
  type MapFocusPoint,
  type RoutePointMove,
  type RouteReplacementToken,
} from '@/components/trips/planning/tripPlanRouteMap.types';
import {
  TRANSPORT_ICON_NAME,
  TRANSPORT_LABEL,
  formatDistance,
  formatDuration,
  formatRoutePointCoordinates,
  isDrawableCoordinatePair,
  isRouteApproximate,
  routingStateHint,
  routingStateLabel,
} from '@/components/trips/planning/tripPlanFormatting';
import { useMapOverlays } from '@/hooks/map/useMapOverlays';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import type { MapUiApi } from '@/types/mapUi';
import { translate as i18nT } from '@/i18n'
import { hasUsableRouteGeometry } from './tripRoutePreview';


interface Props {
  route: RoutePoint[];
  routeGeometry?: RouteGeometry | null;
  routingState?: RoutingState | null;
  activeIndex?: number | null;
  summary?: RouteSummary | null;
  transport?: TripTransport;
  readonly?: boolean;
  /**
   * #1496: исходный импортированный трек поверх построенного маршрута.
   * #1847: по сегменту на каждый `<trk>`/`<LineString>` файла — соседние треки
   * не соединяются, иначе между ними появляется прямая, которой в файле нет.
   */
  originalTrackSegments?: RouteGeometry[] | null;
  /**
   * #1495: карта растягивается на всю родительскую сцену и отдаёт ей заголовок —
   * в map-first раскладке подписи живут в чипах поверх карты.
   */
  fill?: boolean;
  focusPoint?: MapFocusPoint | null;
  /**
   * #1820: счётчик оптовых замен маршрута (шаблон, импорт трека). Его рост —
   * единственный признак «маршрут заменили целиком»: снимает защёлку кадра и
   * заставляет карту показать получившийся маршрут.
   */
  routeReplacementToken?: RouteReplacementToken;
  onEditPoint?: (index: number) => void;
  /** #1781: маркер отпущен в новом месте — координаты точки нужно обновить. */
  onMovePoint?: (move: RoutePointMove) => void;
  onDeletePoint?: (index: number) => void;
  onAddPointFromMap?: (coords: { lat: number; lng: number }) => void;
}

const DEFAULT_CENTER = { latitude: 53.9, longitude: 27.5667 };

// Те же величины, что у web-карты конструктора: карточка слоёв стоит под своей
// кнопкой и обязана уместиться во встроенную карту 320dp.
const MAP_HEIGHT = 320;
const LAYERS_POPOVER_TOP = 62;
const LAYERS_POPOVER_RIGHT = 10;
const LAYERS_POPOVER_MIN_WIDTH = 250;
const LAYERS_POPOVER_MAX_WIDTH = 300;
const LAYERS_SCROLL_MAX_HEIGHT = 196;
// В полноэкранном режиме карточке слоёв не мешает высота встроенной карты.
const LAYERS_SCROLL_MAX_HEIGHT_FULLSCREEN = 420;

const EMPTY_TRAVEL = { data: [] as never[] };

/**
 * Пропы native-карты (`Map.ios` ← ре-экспорт `Map.android`). Приведение нужно
 * потому, что TypeScript для `@/components/MapPage/Map` разрешает web-вариант
 * платформенного файла, а исполняется здесь всегда native — тип фиксирует ровно
 * тот контракт, которым пользуется этот экран.
 */
type NativeRouteMapProps = {
  travel: { data: never[] };
  coordinates: { latitude: number; longitude: number };
  routePoints: Array<[number, number]>;
  fullRouteCoords: Array<[number, number]>;
  routeLineVisible?: boolean;
  routeLineApproximate?: boolean;
  originalTrackSegments?: Array<Array<[number, number]>>;
  mode: 'route';
  pointsOnly?: boolean;
  routePointsInteractive?: boolean;
  routeReplacementToken?: RouteReplacementToken;
  onRoutePointMove?: (index: number, lat: number, lng: number) => void;
  onRoutePointPress?: (index: number) => void;
  onMapClick?: (lng: number, lat: number) => void;
  onMapUiApiReady?: (api: unknown) => void;
};

const NativeMap = MapComponent as unknown as React.ComponentType<NativeRouteMapProps>;

// #1683: наличия пары мало. Сам WebView до падения не доходит — `Map.ios`
// прогоняет точки через `normalizeRoutePoint`, а центр отсекается в
// `nativeMapHtml`. Но битая пара, дожив до этого слоя, врала счётчиком точек в
// шапке и признаком приблизительной линии: карта её не рисует, а планировщик
// считал. Предикат общий с web, чтобы «есть пара» и «в паре числа» не
// разъезжались между платформами.
const lngLatPairs = (coordinates: Array<[number, number] | null | undefined>): Array<[number, number]> =>
  coordinates.filter(isDrawableCoordinatePair);

export default function TripPlanRouteMap({
  route,
  routeGeometry,
  routingState,
  summary,
  transport,
  readonly = false,
  originalTrackSegments,
  fill = false,
  focusPoint,
  routeReplacementToken,
  onEditPoint,
  onMovePoint,
  onDeletePoint,
  onAddPointFromMap,
}: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [layersOpen, setLayersOpen] = useState(false);
  const [mapUiApi, setMapUiApi] = useState<MapUiApi | null>(null);
  // #1897: паритет с web-кнопкой «развернуть карту». На native карта живёт в
  // WebView, и `position: fixed`/портала нет — разворот идёт через `Modal`, а
  // Escape заменяет явная кнопка `minimize-2` и системный «назад» на Android
  // (`onRequestClose`). Карта одна: пока модалка открыта, встроенный слот стоит
  // пустой заглушкой, а WebView монтируется в модалке — два одновременных
  // Leaflet-WebView на слабом Android ни к чему. Точки, линия и состояние
  // построения приходят пропсами от `RouteBuilder`, поэтому переезд карты между
  // слотами их не трогает; кадр после переезда снова ставит fitBounds внутри
  // WebView (nativeMapHtml), как и на web, где портал пересобирает MapContainer.
  const [fullscreen, setFullscreen] = useState(false);
  // Двухфазное закрытие, как у карты квеста (#809): синхронный unmount WebView
  // посреди жеста оставляет touch-responder залоченным. Сначала снимаем
  // pointerEvents с карты, размонтируем модалку следующим кадром.
  const [fullscreenClosing, setFullscreenClosing] = useState(false);
  const closeFrameRef = useRef<number | null>(null);
  /**
   * #1781: точка, по маркеру которой открыты действия «Изменить/Удалить».
   * Индекса мало: список точек умеет переупорядочиваться (#1303), и открытая
   * карточка молча начала бы указывать на соседнюю точку. Поэтому рядом с
   * индексом держится id, и при расхождении карточка закрывается.
   */
  const [actions, setActions] = useState<{ index: number; id: string } | null>(null);

  // Native-карта ждёт пары [lng, lat] — ровно так их хранит RoutePoint.
  const routePoints = useMemo(
    () => lngLatPairs(route.map((point) => point.coordinates)),
    [route],
  );
  const hasRoutedGeometry = hasUsableRouteGeometry(routeGeometry);
  const usesWaypointFallback = !hasRoutedGeometry && routePoints.length >= 2;
  const approximate = usesWaypointFallback || isRouteApproximate(routingState);
  // A persisted healthy label cannot survive without routed geometry. The
  // fallback segment remains useful for orientation, but it is presented as
  // approximate until the preview engine supplies the complete routed tuple.
  const truthfulRoutingState =
    hasRoutedGeometry || isRouteApproximate(routingState) ? routingState : null;
  const routeLine = useMemo(
    () => (hasRoutedGeometry
      ? lngLatPairs(routeGeometry ?? [])
      : routePoints),
    [hasRoutedGeometry, routeGeometry, routePoints],
  );
  // #1847: каждый трек файла уезжает в WebView своей линией. Сегмент, от
  // которого после фильтра битых пар осталась одна точка, отбрасывается:
  // нарисовать его нечем, а карта всё равно рисует только линии от двух точек.
  const originalTrackLines = useMemo(
    () => (originalTrackSegments ?? [])
      .map((segment) => lngLatPairs(segment ?? []))
      .filter((line) => line.length > 1),
    [originalTrackSegments],
  );
  const hasOriginalTrack = originalTrackLines.length > 0;
  const center = useMemo(() => {
    // #1851: файл трека грузят раньше, чем расставляют точки маршрута. Видимый
    // кадр в этом случае ставит уже не center, а fitBounds по границам трека в
    // самом WebView (nativeMapHtml.ts:558) — center на native доезжает только до
    // map.__userCenter, а его читают ветки, в которые route-режим не заходит
    // (nativeMapHtml.ts:695,702). Третий кандидат остаётся страховкой ровно этих
    // веток: до #1851 такая поездка проваливалась в них и центровалась на
    // дефолтном Минске.
    const first = routeLine[0] ?? routePoints[0] ?? originalTrackLines[0]?.[0];
    if (!first) return DEFAULT_CENTER;
    return { latitude: first[1], longitude: first[0] };
  }, [originalTrackLines, routeLine, routePoints]);

  const { enabledOverlays, handleOverlayToggle, overlayOptions } = useMapOverlays(mapUiApi);

  const handleMapUiApiReady = useCallback((api: unknown) => {
    setMapUiApi((api as MapUiApi | null) ?? null);
  }, []);

  // #1495: центрирование на точке из списка. Native-карта живёт в WebView, и
  // единственный доступ к ней — MapUiApi (`focusOnCoord`), тот же, которым
  // пользуется список точек пользователя.
  const focusedTokenRef = useRef<number | null>(null);
  useEffect(() => {
    if (!focusPoint || !mapUiApi?.focusOnCoord) return;
    if (focusedTokenRef.current === focusPoint.token) return;
    focusedTokenRef.current = focusPoint.token;
    mapUiApi.focusOnCoord(`${focusPoint.lat},${focusPoint.lng}`, { zoom: FOCUS_POINT_ZOOM });
  }, [focusPoint, mapUiApi]);

  const handleMapClick = useCallback(
    (lng: number, lat: number) => {
      if (readonly) return;
      setActions(null);
      onAddPointFromMap?.({ lat, lng });
    },
    [onAddPointFromMap, readonly],
  );

  // #1781: точки маршрута правятся прямо с карты. WebView отдаёт только индекс —
  // маршрутом по-прежнему владеет `RouteBuilder`, карта ничего не мутирует сама.
  const interactiveRoutePoints = !readonly && (Boolean(onMovePoint) || Boolean(onDeletePoint) || Boolean(onEditPoint));
  const handleRoutePointMove = useCallback(
    (index: number, lat: number, lng: number) => {
      if (readonly) return;
      onMovePoint?.({ index, lat, lng });
    },
    [onMovePoint, readonly],
  );
  const routeRef = useRef(route);
  routeRef.current = route;
  const handleRoutePointPress = useCallback(
    (index: number) => {
      if (readonly) return;
      const point = routeRef.current[index];
      if (!point) return;
      setActions((current) => (current?.index === index ? null : { index, id: String(point.id) }));
    },
    [readonly],
  );
  const closeActions = useCallback(() => setActions(null), []);
  // Точка могла уехать вместе с удалением, переупорядочиванием или сохранением
  // маршрута — карточка действий не должна пережить свою точку.
  const actionsPoint = actions && route[actions.index]?.id === actions.id
    ? route[actions.index]
    : null;
  useEffect(() => {
    if (actions && !actionsPoint) setActions(null);
  }, [actions, actionsPoint]);

  const toggleLayers = useCallback(() => setLayersOpen((value) => !value), []);
  const closeLayers = useCallback(() => setLayersOpen(false), []);

  const openFullscreen = useCallback(() => {
    setLayersOpen(false);
    setActions(null);
    setFullscreen(true);
  }, []);
  const closeFullscreen = useCallback(() => {
    if (closeFrameRef.current != null) return;
    setLayersOpen(false);
    setActions(null);
    setFullscreenClosing(true);
    closeFrameRef.current = requestAnimationFrame(() => {
      closeFrameRef.current = null;
      setFullscreen(false);
      setFullscreenClosing(false);
    });
  }, []);
  useEffect(() => () => {
    if (closeFrameRef.current != null) cancelAnimationFrame(closeFrameRef.current);
  }, []);
  // Редактор точки живёт в панели под картой — из полноэкранного режима к нему
  // не добраться, поэтому «Изменить» сначала сворачивает карту.
  const editPointFromMap = useCallback(
    (index: number) => {
      if (fullscreen) closeFullscreen();
      onEditPoint?.(index);
    },
    [closeFullscreen, fullscreen, onEditPoint],
  );

  const layersLabel = i18nT('tripsStatic:plan.map.layers');
  const fullscreenLabel = fullscreen
    ? i18nT('tripsStatic:plan.map.collapse')
    : i18nT('tripsStatic:plan.map.expand');

  return (
    <View style={[styles.wrap, fill && styles.wrapFill]} testID="trip-plan-route-map">
      {fill ? null : (
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{i18nT('trips:components.trips.planning.TripPlanRouteMap.karta_marshruta_8fbc6a38')}</Text>
          {transport ? (
            <View style={styles.routeMode}>
              <MapIcon name={TRANSPORT_ICON_NAME[transport]} size={14} color={colors.primaryDark} />
              <Text style={styles.routeModeText}>{TRANSPORT_LABEL[transport]}</Text>
              {summary ? (
                <Text style={styles.routeModeMeta}>
                  {formatDistance(summary.distanceKm)} · {formatDuration(summary.durationMin)}
                </Text>
              ) : null}
            </View>
          ) : null}
          <Text style={styles.hint}>
            {routeLine.length >= 2 && truthfulRoutingState
              ? routingStateLabel(truthfulRoutingState)
              : readonly
                ? i18nT('trips:components.trips.planning.TripPlanRouteMap.tochki_marshruta_pokazany_na_karte_14e6732e')
                : i18nT('trips:components.trips.planning.TripPlanRouteMap.nazhmite_na_kartu_chtoby_dobavit_tochku_posl_52845bf6')}
          </Text>
          {interactiveRoutePoints ? (
            <Text style={styles.hint} testID="trip-plan-map-marker-hint">
              {i18nT('tripsStatic:plan.map.markerHint')}
            </Text>
          ) : null}
          {hasOriginalTrack ? (
            <View style={styles.legendItem} testID="trip-plan-map-original-track-legend">
              <View style={[styles.legendLine, { backgroundColor: colors.accentDark }]} />
              <Text style={styles.legendText}>{i18nT('tripsStatic:plan.map.originalTrack')}</Text>
            </View>
          ) : null}
          {approximate ? (
            <Text style={styles.warning}>
              {routingStateHint(truthfulRoutingState)
                ?? i18nT('trips:components.trips.planning.TripPlanRouteMap.liniya_priblizitelnaya_proverte_dorogu_ili_t_9fb768f4')}
            </Text>
          ) : null}
        </View>
        <Text style={styles.counter}>{routePoints.length}</Text>
      </View>
      )}

      <View style={[styles.mapShell, fill && styles.mapShellFill]}>
        {fullscreen ? (
          <View style={styles.mapPlaceholder} testID="trip-plan-map-fullscreen-placeholder" />
        ) : renderMapContent()}
      </View>

      {fullscreen ? (
        <Modal
          visible
          transparent={false}
          animationType="fade"
          statusBarTranslucent
          onRequestClose={closeFullscreen}
        >
          <View
            style={[styles.fullscreenModal, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
            testID="trip-plan-map-fullscreen-modal"
          >
            <View style={styles.fullscreenMapShell} pointerEvents={fullscreenClosing ? 'none' : 'auto'}>
              {renderMapContent()}
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );

  function renderMapContent() {
    return (
      <>
        <NativeMap
          travel={EMPTY_TRAVEL}
          coordinates={center}
          routePoints={routePoints}
          fullRouteCoords={routeLine}
          routeLineVisible={routeLine.length >= 2}
          routeLineApproximate={approximate}
          originalTrackSegments={originalTrackLines}
          mode="route"
          pointsOnly
          routePointsInteractive={interactiveRoutePoints}
          routeReplacementToken={routeReplacementToken}
          onRoutePointMove={handleRoutePointMove}
          onRoutePointPress={handleRoutePointPress}
          onMapClick={handleMapClick}
          onMapUiApiReady={handleMapUiApiReady}
        />
        {fill && hasOriginalTrack ? (
          <View style={styles.legendOverlay} testID="trip-plan-map-original-track-legend">
            <View style={[styles.legendLine, { backgroundColor: colors.accentDark }]} />
            <Text style={styles.legendText}>{i18nT('tripsStatic:plan.map.originalTrack')}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={toggleLayers}
          accessibilityRole="button"
          accessibilityLabel={layersLabel}
          accessibilityState={{ expanded: layersOpen }}
          testID="trip-plan-map-layers"
          style={({ pressed }) => [
            styles.layersToggle,
            layersOpen && styles.layersToggleActive,
            pressed && styles.layersTogglePressed,
          ]}
        >
          <Feather name="layers" size={18} color={layersOpen ? colors.primaryDark : colors.text} />
        </Pressable>
        <Pressable
          onPress={fullscreen ? closeFullscreen : openFullscreen}
          accessibilityRole="button"
          accessibilityLabel={fullscreenLabel}
          accessibilityState={{ expanded: fullscreen }}
          testID="trip-plan-map-fullscreen"
          style={({ pressed }) => [
            styles.layersToggle,
            styles.fullscreenToggle,
            pressed && styles.layersTogglePressed,
          ]}
        >
          <Feather name={fullscreen ? 'minimize-2' : 'maximize-2'} size={18} color={colors.text} />
        </Pressable>

        {layersOpen ? (
          <MapMobileLayersPopover
            colors={colors}
            top={LAYERS_POPOVER_TOP}
            right={LAYERS_POPOVER_RIGHT}
            minWidth={LAYERS_POPOVER_MIN_WIDTH}
            maxWidth={LAYERS_POPOVER_MAX_WIDTH}
            scrollMaxHeight={fullscreen ? LAYERS_SCROLL_MAX_HEIGHT_FULLSCREEN : LAYERS_SCROLL_MAX_HEIGHT}
            mapUiApi={mapUiApi}
            showBaseLayer={false}
            showMapControls={false}
            overlayOptions={overlayOptions}
            enabledOverlays={enabledOverlays}
            onOverlayToggle={handleOverlayToggle}
            onRequestClose={closeLayers}
          />
        ) : null}

        {actionsPoint ? (
          <View
            style={styles.pointActions}
            accessibilityLabel={i18nT('tripsStatic:plan.map.pointActions')}
            testID="trip-plan-map-point-actions"
          >
            <View style={styles.pointActionsText}>
              <Text style={styles.pointActionsTitle} numberOfLines={1}>{actionsPoint.name}</Text>
              {formatRoutePointCoordinates(actionsPoint.coordinates) ? (
                <Text style={styles.pointActionsMeta} numberOfLines={1}>
                  {formatRoutePointCoordinates(actionsPoint.coordinates)}
                </Text>
              ) : null}
            </View>
            <View style={styles.pointActionsButtons}>
              {onEditPoint ? (
                <Pressable
                  accessibilityRole="button"
                  testID="trip-plan-map-edit-point"
                  onPress={() => {
                    const index = actions?.index;
                    closeActions();
                    if (index != null) editPointFromMap(index);
                  }}
                  style={({ pressed }) => [styles.pointActionsButton, pressed && styles.pointActionsButtonPressed]}
                >
                  <Feather name="edit-2" size={14} color={colors.text} />
                  <Text style={styles.pointActionsButtonText}>
                    {i18nT('tripsStatic:plan.map.editPoint')}
                  </Text>
                </Pressable>
              ) : null}
              {onDeletePoint ? (
                <Pressable
                  accessibilityRole="button"
                  testID="trip-plan-map-delete-point"
                  onPress={() => {
                    const index = actions?.index;
                    closeActions();
                    if (index != null) onDeletePoint(index);
                  }}
                  style={({ pressed }) => [
                    styles.pointActionsButton,
                    styles.pointActionsButtonDanger,
                    pressed && styles.pointActionsButtonPressed,
                  ]}
                >
                  <Feather name="trash-2" size={14} color={colors.danger} />
                  <Text style={[styles.pointActionsButtonText, styles.pointActionsButtonTextDanger]}>
                    {i18nT('tripsStatic:plan.map.deletePoint')}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={i18nT('tripsStatic:plan.map.closePointActions')}
                testID="trip-plan-map-close-point-actions"
                onPress={closeActions}
                style={({ pressed }) => [styles.pointActionsClose, pressed && styles.pointActionsButtonPressed]}
              >
                <Feather name="x" size={16} color={colors.textMuted} />
              </Pressable>
            </View>
          </View>
        ) : null}
      </>
    );
  }
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    wrap: {
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      backgroundColor: colors.surface,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    headerText: { flex: 1, gap: 3 },
    title: { fontSize: 15, fontWeight: '700', color: colors.text },
    routeMode: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
    },
    routeModeText: { fontSize: 13, fontWeight: '800', color: colors.text },
    routeModeMeta: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
    hint: { fontSize: 13, lineHeight: 18, color: colors.textMuted },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendLine: { width: 22, height: 3, borderRadius: 999 },
    legendText: { fontSize: 12, color: colors.textSecondary, fontWeight: '700' },
    legendOverlay: {
      position: 'absolute', top: 12, left: 12, zIndex: 3,
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999,
      backgroundColor: colors.surface,
    },
    warning: { fontSize: 12, lineHeight: 16, color: colors.warningDark, fontWeight: '700' },
    // #1781 — действия точки маршрута. Карточка стоит внизу карты: у маркера
    // в WebView нет RN-якоря, а низ экрана в map-first раскладке ближе к пальцу.
    pointActions: {
      position: 'absolute',
      left: 12,
      right: 12,
      bottom: 12,
      zIndex: 4,
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    pointActionsText: { gap: 2 },
    pointActionsTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
    pointActionsMeta: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
    pointActionsButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pointActionsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 44,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    pointActionsButtonDanger: { borderColor: colors.danger },
    pointActionsButtonPressed: { opacity: 0.7 },
    pointActionsButtonText: { fontSize: 13, fontWeight: '700', color: colors.text },
    pointActionsButtonTextDanger: { color: colors.danger },
    pointActionsClose: {
      marginLeft: 'auto',
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
    },
    counter: {
      minWidth: 32,
      textAlign: 'center',
      borderRadius: 999,
      overflow: 'hidden',
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: colors.surfaceMuted,
      color: colors.text,
      fontSize: 13,
      fontWeight: '800',
    },
    wrapFill: {
      flex: 1,
      minHeight: 0,
      gap: 0,
      padding: 0,
      borderWidth: 0,
      borderRadius: 0,
      backgroundColor: 'transparent',
    },
    mapShell: {
      height: MAP_HEIGHT,
      width: '100%',
      overflow: 'hidden',
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
    },
    // Map-first сцена (#1495) задаёт высоту сама.
    mapShellFill: {
      flex: 1,
      height: '100%',
      minHeight: 0,
      borderWidth: 0,
      borderRadius: 0,
    },
    layersToggle: {
      position: 'absolute',
      top: 10,
      // Порядок кнопок карты тот же, что на mobile web (#1301,
      // TripPlanRouteMap.web.tsx:879): слои левее, «на весь экран» у самого края.
      right: 62,
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: DESIGN_TOKENS.radii.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      // Выше leaflet-контролов внутри WebView.
      zIndex: 1200,
    },
    layersToggleActive: {
      borderColor: colors.primaryDark,
      backgroundColor: colors.surfaceMuted,
    },
    layersTogglePressed: { opacity: 0.7 },
    // Справа от кнопки слоёв, тем же кругом 44dp.
    fullscreenToggle: { right: 10 },
    mapPlaceholder: { flex: 1, backgroundColor: colors.surfaceMuted },
    fullscreenModal: { flex: 1, backgroundColor: colors.background },
    fullscreenMapShell: { flex: 1, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  });
