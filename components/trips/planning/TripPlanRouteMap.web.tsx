import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import type { RouteGeometry, RoutingState, RoutePoint, RouteSummary, TripTransport } from '@/api/plannedTrips';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import {
  FOCUS_POINT_ZOOM,
  type MapFocusPoint,
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
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { ensureLeafletCss } from '@/utils/ensureLeafletCss';
import { MapCanvas } from '@/components/MapPage/Map/MapCanvas';
import { useMapInstance } from '@/components/MapPage/Map/useMapInstance';
import { useMapApi } from '@/components/MapPage/Map/useMapApi';
import { MapMobileLayersPopover } from '@/components/MapPage/MapMobile/MapMobileLayersPopover';
import WeatherLegend from '@/components/MapPage/WeatherLegend';
import { useMapOverlays } from '@/hooks/map/useMapOverlays';
import type { MapUiApi } from '@/types/mapUi';
import { buildDropMarkerHtml } from '@/utils/markerSvg';
import { translate as i18nT } from '@/i18n'
import { hasUsableRouteGeometry } from './tripRoutePreview';


type LeafletNS = typeof import('leaflet');
type ReactLeafletNS = typeof import('react-leaflet');
type MapClickEvent = { latlng: { lat: number; lng: number } };

interface Props {
  route: RoutePoint[];
  routeGeometry?: RouteGeometry | null;
  routingState?: RoutingState | null;
  activeIndex?: number | null;
  summary?: RouteSummary | null;
  transport?: TripTransport;
  readonly?: boolean;
  /** #1496: исходный импортированный трек поверх построенного маршрута. */
  originalTrack?: RouteGeometry | null;
  /**
   * #1495: карта растягивается на всю родительскую сцену и отдаёт ей заголовок —
   * в map-first раскладке подписи живут в чипах поверх карты.
   */
  fill?: boolean;
  focusPoint?: MapFocusPoint | null;
  onEditPoint?: (index: number) => void;
  onAddPointFromMap?: (coords: { lat: number; lng: number }) => void;
}

const DEFAULT_CENTER: [number, number] = [53.9, 27.5667];

// Карточка «Слои» стоит под своей кнопкой в правом верхнем углу карты.
const LAYERS_POPOVER_TOP = 62;
const LAYERS_POPOVER_RIGHT = 10;
const LAYERS_POPOVER_MIN_WIDTH = 250;
const LAYERS_POPOVER_MAX_WIDTH = 300;
// Встроенная карта — 320px с `overflow: hidden`: список слоёв обязан уместиться
// под кнопкой, иначе нижние секции просто обрезаются краем карты.
const LAYERS_SCROLL_MAX_HEIGHT_INLINE = 196;
const LAYERS_SCROLL_MAX_HEIGHT_FULLSCREEN = 420;

// Стабильные ссылки: `useMapApi` пересобирает api на новый массив, а api уезжает
// в состояние — свежий литерал на каждый рендер дал бы бесконечный цикл.
const EMPTY_ROUTE_POINTS: Array<[number, number]> = [];
const EMPTY_TRAVEL_DATA: Array<{ coord: string; address: string }> = [];

type WebPortal = (node: React.ReactNode, container: Element) => React.ReactNode;

const webCreatePortal: WebPortal | null = (() => {
  try {
    return (require('react-dom') as { createPortal?: WebPortal })?.createPortal ?? null;
  } catch {
    return null;
  }
})();

// #1683: линия и подгонка кадра уходят в Leaflet теми же парами, что и маркеры,
// поэтому битая пара роняла бы карту и здесь — фильтр общий с форматтером.
const lngLatPositions = (
  coordinates: Array<[number, number] | null | undefined>,
): Array<[number, number]> =>
  coordinates
    .filter(isDrawableCoordinatePair)
    .map(([lng, lat]) => [lat, lng]);

const routePositions = (route: RoutePoint[]): Array<[number, number]> =>
  lngLatPositions(route.map((point) => point.coordinates));

// `fittedTokenRef` живёт в родителе и переживает пересборку карты (#1301: разворот
// на весь экран переносит карту порталом, то есть MapContainer монтируется заново).
// Без него подгонка под маршрут срабатывала бы на каждом развороте и отменяла
// восстановленные центр и зум.
function FitRouteBounds({
  L,
  positions,
  useMap,
  fitToken,
  fittedTokenRef,
}: {
  L: LeafletNS;
  positions: Array<[number, number]>;
  useMap: ReactLeafletNS['useMap'];
  fitToken: string;
  fittedTokenRef: React.MutableRefObject<string | null>;
}) {
  const map = useMap();

  // MapContainer removes the Leaflet instance from a passive effect. Stop any
  // pending pan/zoom in the earlier layout cleanup, including remounted maps
  // whose bounds token was already fitted (fullscreen restores their view).
  useLayoutEffect(() => {
    return () => {
      map.stop();
    };
  }, [map]);

  useEffect(() => {
    if (!positions.length) return;
    if (fittedTokenRef.current === fitToken) return;
    fittedTokenRef.current = fitToken;
    if (positions.length === 1) {
      map.setView(positions[0], 12);
      return;
    }
    const bounds = L.latLngBounds(positions);
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 13 });
  }, [L, fitToken, fittedTokenRef, map, positions]);

  return null;
}

function ClickToAdd({
  disabled,
  onAddPointFromMap,
  useMapEvents,
}: {
  disabled: boolean;
  onAddPointFromMap?: (coords: { lat: number; lng: number }) => void;
  useMapEvents: ReactLeafletNS['useMapEvents'];
}) {
  const handleClick = (event: MapClickEvent) => {
    if (disabled) return;
    onAddPointFromMap?.({ lat: event.latlng.lat, lng: event.latlng.lng });
  };

  useMapEvents({
    click: handleClick,
  });

  return null;
}

/**
 * #1495: центрирование карты на точке, выбранной в списке шторки. Живёт внутри
 * MapContainer, потому что доступ к leaflet-инстансу даёт только `useMap`.
 */
function FocusRoutePoint({
  focusPoint,
  useMap,
}: {
  focusPoint: MapFocusPoint | null | undefined;
  useMap: ReactLeafletNS['useMap'];
}) {
  const map = useMap();
  const appliedTokenRef = useRef<number | null>(null);

  useEffect(() => {
    if (!focusPoint) return;
    // #1683: запрос фокуса приходит из списка точек, а он отпускает точку по
    // наличию пары (`RouteBuilder.handleFocusPoint`), не по её пригодности.
    // `setView` с нефинитным LatLng бросает уже внутри эффекта — маркерный гард
    // такую точку не спасает. На /map тот же вызов закрыт проверкой координат
    // (`components/MapPage/Map.web.tsx`), здесь — общим предикатом карты плана.
    if (!isDrawableCoordinatePair([focusPoint.lng, focusPoint.lat])) return;
    if (appliedTokenRef.current === focusPoint.token) return;
    appliedTokenRef.current = focusPoint.token;
    map.setView(
      [focusPoint.lat, focusPoint.lng],
      Math.max(map.getZoom() ?? FOCUS_POINT_ZOOM, FOCUS_POINT_ZOOM),
    );
  }, [focusPoint, map]);

  return null;
}

export default function TripPlanRouteMap({
  route,
  routeGeometry,
  routingState,
  activeIndex,
  summary,
  transport,
  readonly = false,
  originalTrack,
  fill = false,
  focusPoint,
  onEditPoint,
  onAddPointFromMap,
}: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const reactId = useId();
  const mapKeyRef = useRef(`trip-plan-route-map-${reactId.replace(/:/g, '')}`);
  const [L, setL] = useState<LeafletNS | null>(null);
  const [RL, setRL] = useState<ReactLeafletNS | null>(null);
  // #1301: карту конструктора можно развернуть на весь экран. `position: fixed`
  // здесь не работает: ScrollView RN-Web ставит себе `transform: matrix(1,0,0,1,0,0)`
  // и становится containing block — развёрнутая карта получалась 1250x782 в углу
  // (0,118) вместо вьюпорта. Поэтому разворот — портал в document.body. Портал
  // пересобирает MapContainer, поэтому центр и зум снимаются перед переключением
  // и возвращаются новой карте, а подгонку под маршрут держит `fittedTokenRef`.
  const [fullscreen, setFullscreen] = useState(false);
  const mapRef = useRef<{ getCenter: () => { lat: number; lng: number }; getZoom: () => number } | null>(null);
  const restoredViewRef = useRef<{ center: [number, number]; zoom: number } | null>(null);
  const fittedTokenRef = useRef<string | null>(null);
  // Тот же leaflet-инстанс, но состоянием: слои и MapUiApi монтируются хуками
  // /map, а им нужен ререндер после готовности карты (ref его не даёт).
  const [mapInstance, setMapInstance] = useState<unknown>(null);
  const [layersOpen, setLayersOpen] = useState(false);

  const handleMapRef = useCallback((map: unknown) => {
    mapRef.current = map as { getCenter: () => { lat: number; lng: number }; getZoom: () => number };
    setMapInstance((previous: unknown) => (previous === map ? previous : map));
  }, []);

  const toggleFullscreen = useCallback(() => {
    const map = mapRef.current;
    if (map) {
      try {
        const center = map.getCenter();
        restoredViewRef.current = { center: [center.lat, center.lng], zoom: map.getZoom() };
      } catch {
        // Карта ещё не готова — вернёмся к расчётному центру.
      }
    }
    setFullscreen((value) => !value);
  }, []);

  useEffect(() => {
    if (!fullscreen) return;
    if (typeof document === 'undefined') return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [fullscreen]);

  useEffect(() => {
    let cancelled = false;

    const loadMap = async () => {
      try {
        ensureLeafletCss();
        const runtime = await import('@/utils/loadLeafletRuntime');
        const loaded = await runtime.loadLeafletRuntime();
        if (cancelled) return;
        setL(loaded.L);
        setRL(loaded.RL);
      } catch {
        if (cancelled) return;
        setL(null);
        setRL(null);
      }
    };

    void loadMap();
    return () => {
      cancelled = true;
    };
  }, []);

  const markerPositions = useMemo(() => routePositions(route), [route]);
  const routedGeometry = useMemo(
    () => (hasUsableRouteGeometry(routeGeometry) ? routeGeometry : null),
    [routeGeometry],
  );
  const hasRoutedGeometry = routedGeometry !== null;
  const trackPositions = useMemo(() => (
    routedGeometry ? lngLatPositions(routedGeometry) : markerPositions
  ), [markerPositions, routedGeometry]);
  const originalTrackPositions = useMemo(
    () => (originalTrack?.length ? lngLatPositions(originalTrack) : []),
    [originalTrack],
  );
  const center = trackPositions[0] ?? markerPositions[0] ?? DEFAULT_CENTER;
  // Токен считается по содержимому, а не по ссылке: перезапрос маршрута даёт
  // новый массив с теми же точками, и подгонка не должна срабатывать заново.
  // Мемо обязательно: у routed-геометрии тысячи координат, а компонент
  // перерисовывается на каждый ввод в панели конструктора.
  // Подгонка охватывает и оригинальный трек: он может выходить за пределы
  // упрощённых точек, и без него часть настоящей формы осталась бы за кадром.
  const fitPositions = useMemo(
    () => (originalTrackPositions.length >= 2
      ? [...trackPositions, ...originalTrackPositions]
      : trackPositions),
    [originalTrackPositions, trackPositions],
  );
  const fitToken = useMemo(
    () => fitPositions.map((position) => position.join(',')).join('|'),
    [fitPositions],
  );
  const usesWaypointFallback = !hasRoutedGeometry && markerPositions.length >= 2;
  const approximate = usesWaypointFallback || isRouteApproximate(routingState);
  // Fail closed even if another caller passes the inconsistent server tuple:
  // a healthy label requires actual routed geometry, never marker fallback.
  const truthfulRoutingState =
    hasRoutedGeometry || isRouteApproximate(routingState) ? routingState : null;
  const markerIcon = useMemo(() => {
    if (!L) return null;
    return L.divIcon({
      className: 'metravel-trip-plan-marker',
      html: buildDropMarkerHtml({
        size: 34,
        fill: colors.primary,
        stroke: colors.primaryDark,
        innerColor: colors.textOnPrimary,
        innerRadius: 3.2,
      }),
      iconSize: [34, 34],
      iconAnchor: [17, 34],
      popupAnchor: [0, -32],
    });
  }, [L, colors.primary, colors.primaryDark, colors.textOnPrimary]);

  const activeMarkerIcon = useMemo(() => {
    if (!L) return null;
    return L.divIcon({
      className: 'metravel-trip-plan-marker metravel-trip-plan-marker-active',
      html: buildDropMarkerHtml({
        size: 38,
        fill: colors.warning,
        stroke: colors.primaryDark,
        innerColor: colors.textOnPrimary,
        innerRadius: 3.4,
      }),
      iconSize: [38, 38],
      iconAnchor: [19, 38],
      popupAnchor: [0, -36],
    });
  }, [L, colors.warning, colors.primaryDark, colors.textOnPrimary]);

  // Слои карты — ровно те же, что на /map: определения и контроллеры берём из
  // общей механики (`useMapInstance` создаёт слои, `useMapApi` их переключает),
  // а выбор слоёв — общий persisted store (#1306). Оверлеи создаются «холодными»:
  // запросы overpass/OWM уходят только когда слой включён.
  const { leafletBaseLayerRef, leafletOverlayLayersRef, leafletControlRef } = useMapInstance({
    map: mapInstance,
    L,
    // Подложку рисует сам MapCanvas — хук нужен только ради оверлеев.
    manageBaseLayer: false,
  });

  const [mapUiApi, setMapUiApi] = useState<MapUiApi | null>(null);

  // Карта конструктора берёт из api только переключение слоёв: точки и маршрут
  // рисует сама, а панель слоёв идёт без ряда действий карты (showMapControls).
  useMapApi({
    map: mapInstance,
    L,
    onMapUiApiReady: setMapUiApi,
    travelData: EMPTY_TRAVEL_DATA,
    userLocation: null,
    routePoints: EMPTY_ROUTE_POINTS,
    leafletBaseLayerRef,
    leafletOverlayLayersRef,
    leafletControlRef,
  });

  const { enabledOverlays, handleOverlayToggle, overlayOptions } = useMapOverlays(mapUiApi);

  const closeLayers = useCallback(() => setLayersOpen(false), []);

  if (!L || !RL || !markerIcon || !activeMarkerIcon) {
    return (
      <View style={[styles.loadingWrap, fill && styles.loadingWrapFill]} testID="trip-plan-route-map">
        <ActivityIndicator color={colors.primaryDark} />
        <Text style={styles.hint}>{i18nT('trips:components.trips.planning.TripPlanRouteMap.zagruzka_karty_marshruta_5f48efc0')}</Text>
      </View>
    );
  }

  const fullscreenLabel = fullscreen
    ? i18nT('tripsStatic:plan.map.collapse')
    : i18nT('tripsStatic:plan.map.expand');
  const layersLabel = i18nT('tripsStatic:plan.map.layers');

  // Развёрнутая карта уходит порталом в body: внутри ScrollView `position: fixed`
  // зажимается его же трансформом. На месте карты остаётся заглушка той же высоты,
  // иначе страница под оверлеем схлопывается и после выхода скролл уезжает.
  const renderMapShell = (canvas: React.ReactNode) => {
    const shell = (
      <div
        style={{
          ...(styles.mapShell as React.CSSProperties),
          ...(fill ? (styles.mapShellFill as React.CSSProperties) : null),
          ...(fullscreen ? (styles.mapShellFullscreen as React.CSSProperties) : null),
        }}
      >
        <button
          type="button"
          onClick={() => setLayersOpen((value) => !value)}
          aria-label={layersLabel}
          aria-expanded={layersOpen}
          title={layersLabel}
          data-testid="trip-plan-map-layers"
          style={{
            ...(styles.mapToggleButton as React.CSSProperties),
            ...(styles.layersToggle as React.CSSProperties),
            ...(layersOpen ? (styles.mapToggleButtonActive as React.CSSProperties) : null),
          }}
        >
          <Feather name="layers" size={18} color={layersOpen ? colors.primaryDark : colors.text} />
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={fullscreenLabel}
          title={fullscreenLabel}
          data-testid="trip-plan-map-fullscreen"
          style={{
            ...(styles.mapToggleButton as React.CSSProperties),
            ...(styles.fullscreenToggle as React.CSSProperties),
          }}
        >
          <Feather name={fullscreen ? 'minimize-2' : 'maximize-2'} size={18} color={colors.text} />
        </button>
        {canvas}
        {fill && originalTrackPositions.length > 1 ? (
          <View style={styles.legendOverlay} testID="trip-plan-map-original-track-legend">
            <View style={[styles.legendLine, { backgroundColor: colors.accentDark }]} />
            <Text style={styles.legendText}>{i18nT('tripsStatic:plan.map.originalTrack')}</Text>
          </View>
        ) : null}
        <WeatherLegend enabledOverlays={enabledOverlays} />
        {layersOpen ? (
          <View style={styles.layersPopoverLayer} pointerEvents="box-none">
            <MapMobileLayersPopover
              colors={colors}
              top={LAYERS_POPOVER_TOP}
              right={LAYERS_POPOVER_RIGHT}
              minWidth={LAYERS_POPOVER_MIN_WIDTH}
              maxWidth={LAYERS_POPOVER_MAX_WIDTH}
              scrollMaxHeight={
                fullscreen ? LAYERS_SCROLL_MAX_HEIGHT_FULLSCREEN : LAYERS_SCROLL_MAX_HEIGHT_INLINE
              }
              mapUiApi={mapUiApi}
              showBaseLayer={false}
              showMapControls={false}
              overlayOptions={overlayOptions}
              enabledOverlays={enabledOverlays}
              onOverlayToggle={handleOverlayToggle}
              onRequestClose={closeLayers}
            />
          </View>
        ) : null}
      </div>
    );

    if (fullscreen && webCreatePortal && typeof document !== 'undefined') {
      return webCreatePortal(shell, document.body);
    }
    return shell;
  };

  const Marker = RL.Marker as any;
  const Popup = RL.Popup as any;
  const Polyline = RL.Polyline as any;
  const useMap = RL.useMap;
  const useMapEvents = RL.useMapEvents;

  return (
    <View style={[styles.wrap, fill && styles.wrapFill]} testID="trip-plan-route-map">
      {fill ? null : (
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{i18nT('trips:components.trips.planning.TripPlanRouteMap.karta_marshruta_8fbc6a38')}</Text>
          {transport ? (
            <View style={styles.routeMode}>
              <Feather name={TRANSPORT_ICON_NAME[transport] as never} size={14} color={colors.primaryDark} />
              <Text style={styles.routeModeText}>{TRANSPORT_LABEL[transport]}</Text>
              {summary ? (
                <Text style={styles.routeModeMeta}>
                  {formatDistance(summary.distanceKm)} · {formatDuration(summary.durationMin)}
                </Text>
              ) : null}
            </View>
          ) : null}
          <Text style={styles.hint}>
            {trackPositions.length >= 2 && truthfulRoutingState
              ? routingStateLabel(truthfulRoutingState)
              : readonly
                ? i18nT('trips:components.trips.planning.TripPlanRouteMap.tochki_marshruta_pokazany_na_karte_14e6732e')
                : i18nT('trips:components.trips.planning.TripPlanRouteMap.nazhmite_na_kartu_chtoby_dobavit_tochku_posl_52845bf6')}
          </Text>
          {originalTrackPositions.length > 1 ? (
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
        <Text style={styles.counter}>{markerPositions.length}</Text>
      </View>
      )}

      {fullscreen ? <div style={styles.mapShellPlaceholder as React.CSSProperties} /> : null}
      {renderMapShell(
        <MapCanvas
          engine={{ L, RL }}
          center={restoredViewRef.current?.center ?? center}
          zoom={restoredViewRef.current?.zoom ?? (trackPositions.length ? 10 : 5)}
          keyboard={false}
          containerKey={`${mapKeyRef.current}-${fullscreen ? 'fs' : 'inline'}`}
          mapStyle={styles.map as React.CSSProperties}
          onMapRef={handleMapRef}
        >
          {() => (<>
          <ClickToAdd
            disabled={readonly}
            onAddPointFromMap={onAddPointFromMap}
            useMapEvents={useMapEvents}
          />
          <FocusRoutePoint focusPoint={focusPoint} useMap={useMap} />
          {fitPositions.length ? (
            <FitRouteBounds
              L={L}
              positions={fitPositions}
              useMap={useMap}
              fitToken={fitToken}
              fittedTokenRef={fittedTokenRef}
            />
          ) : null}
          {trackPositions.length > 1 ? (
            <Polyline
              positions={trackPositions}
              pathOptions={{
                color: approximate ? colors.warningDark : colors.primaryDark,
                weight: hasRoutedGeometry ? 5 : 4,
                opacity: hasRoutedGeometry ? 0.86 : 0.58,
                dashArray: approximate ? '8 8' : undefined,
              }}
            />
          ) : null}
          {originalTrackPositions.length > 1 ? (
            <Polyline
              positions={originalTrackPositions}
              pathOptions={{
                color: colors.accentDark,
                weight: 3,
                opacity: 0.95,
              }}
            />
          ) : null}
          {route.map((point, index) => {
            // #1683: не «есть пара», а «пара пригодна к отрисовке» — на
            // невалидном LatLng `L.marker` бросает и уносит всю карту.
            if (!isDrawableCoordinatePair(point.coordinates)) return null;
            const [lng, lat] = point.coordinates;
            const coordinatesLabel = formatRoutePointCoordinates(point.coordinates);
            return (
              <Marker
                key={`${point.id}-${index}-${lat}-${lng}`}
                position={[lat, lng]}
                icon={activeIndex === index ? activeMarkerIcon : markerIcon}
              >
                <Popup>
                  <div style={styles.popup as React.CSSProperties}>
                    <div style={styles.popupTitle as React.CSSProperties}>{point.name}</div>
                    {coordinatesLabel ? (
                      <div style={styles.popupMeta as React.CSSProperties}>{coordinatesLabel}</div>
                    ) : null}
                    {!readonly ? (
                      <button
                        type="button"
                        onClick={() => onEditPoint?.(index)}
                        style={styles.popupButton as React.CSSProperties}
                      >
                        {i18nT('trips:components.trips.planning.TripPlanRouteMap.redaktirovat_0c9026cb')}</button>
                    ) : null}
                  </div>
                </Popup>
              </Marker>
            );
          })}
          </>)}
        </MapCanvas>,
      )}
    </View>
  );
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
    wrapFill: {
      flex: 1,
      minHeight: 0,
      gap: 0,
      padding: 0,
      borderWidth: 0,
      borderRadius: 0,
      backgroundColor: 'transparent',
    },
    loadingWrap: {
      minHeight: 260,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    loadingWrapFill: {
      flex: 1,
      minHeight: 0,
      borderWidth: 0,
      borderRadius: 0,
      backgroundColor: 'transparent',
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
    mapShell: {
      position: 'relative',
      height: 320,
      minHeight: 320,
      width: '100%',
      overflow: 'hidden',
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: colors.border,
    },
    // Держит высоту секции, пока карта живёт в портале: без заглушки страница
    // под оверлеем схлопывается и после выхода скролл оказывается не там.
    mapShellPlaceholder: {
      height: 320,
      minHeight: 320,
      width: '100%',
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.surfaceMuted,
    },
    // Map-first сцена (#1495) задаёт высоту сама: карта тянется на всю сцену,
    // а не держит собственные 320px.
    mapShellFill: {
      flex: 1,
      height: '100%',
      minHeight: 0,
      borderRadius: 0,
      borderWidth: 0,
    },
    mapShellFullscreen: {
      position: 'fixed',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      height: '100%',
      minHeight: '100%',
      width: '100%',
      borderRadius: 0,
      borderWidth: 0,
      zIndex: 99990,
      backgroundColor: colors.surface,
    },
    mapToggleButton: {
      position: 'absolute',
      top: 10,
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      display: 'flex',
      borderRadius: DESIGN_TOKENS.radii.full,
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: colors.border,
      backgroundColor: colors.surface,
      color: colors.text,
      cursor: 'pointer',
      // Выше leaflet-контролов (у них z-index до 1000).
      zIndex: 1200,
    },
    mapToggleButtonActive: {
      borderColor: colors.primaryDark,
      backgroundColor: colors.surfaceMuted,
    },
    fullscreenToggle: { right: 10 },
    layersToggle: { right: 62 },
    // Карточка слоёв должна перекрывать кнопки карты, иначе её край уходит под них.
    layersPopoverLayer: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      zIndex: 1300,
    },
    map: {
      width: '100%',
      height: '100%',
      minHeight: 320,
    },
    popup: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      minWidth: 160,
      color: colors.text,
    },
    popupTitle: {
      fontWeight: '700',
      fontSize: 14,
      lineHeight: 18,
      color: colors.text,
    },
    popupMeta: {
      fontSize: 12,
      lineHeight: 16,
      color: colors.textMuted,
    },
    popupButton: {
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: colors.border,
      borderRadius: DESIGN_TOKENS.radii.sm,
      paddingTop: 7,
      paddingRight: 10,
      paddingBottom: 7,
      paddingLeft: 10,
      backgroundColor: colors.surface,
      color: colors.text,
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: '700',
    },
  });
