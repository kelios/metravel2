import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import type { RouteGeometry, RoutingState, RoutePoint, RouteSummary, TripTransport } from '@/api/plannedTrips';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import {
  type MapFocusIndices,
  type MapFocusPoint,
  type RoutePointMove,
  type RouteReplacementToken,
} from '@/components/trips/planning/tripPlanRouteMap.types';
import { FitRouteBounds, FocusRouteIndices, FocusRoutePoint } from '@/components/trips/planning/TripPlanMapFocus';
import TripPlanRouteMapHeader, { TripPlanMapTrackLegend } from '@/components/trips/planning/TripPlanRouteMapHeader';
import TripPlanRouteMarkers from '@/components/trips/planning/TripPlanRouteMarkers';
import { isDrawableCoordinatePair, isRouteApproximate } from '@/components/trips/planning/tripPlanFormatting';
import { useBreakpoints } from '@/hooks/useResponsive';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { ensureLeafletCss } from '@/utils/ensureLeafletCss';
import { MapCanvas } from '@/components/MapPage/Map/MapCanvas';
import { useMapInstance } from '@/components/MapPage/Map/useMapInstance';
import { useMapApi } from '@/components/MapPage/Map/useMapApi';
import { MapMobileLayersPopover } from '@/components/MapPage/MapMobile/MapMobileLayersPopover';
import WeatherLegend from '@/components/MapPage/WeatherLegend';
import { useMapOverlays } from '@/hooks/map/useMapOverlays';
import type { MapUiApi } from '@/types/mapUi';
import type { ReactLeafletCoreRuntime } from '@/utils/loadLeafletRuntime';
import { translate as i18nT } from '@/i18n'
import { hasUsableRouteGeometry } from './tripRoutePreview';


type LeafletNS = typeof import('leaflet');
type ReactLeafletNS = typeof import('react-leaflet');
type MapClickEvent = {
  latlng: { lat: number; lng: number };
  originalEvent?: { target?: EventTarget | null };
};

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
  /** #2058: подогнать кадр под эти точки (день списка), см. `FocusRouteIndices`. */
  focusIndices?: MapFocusIndices | null;
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
// #2059, макет §4: на desktop ≥ 1280 карта занимает экран за вычетом шапки
// страницы и вкладок, но не ниже 420 и не выше 760 px. Значение — CSS для
// DOM-обёртки карты, поэтому `dvh`/`clamp` здесь законны.
const TALL_MAP_HEIGHT = 'clamp(420px, calc(100dvh - 180px), 760px)';
const TALL_MAP_SHELL: React.CSSProperties = { height: TALL_MAP_HEIGHT, minHeight: 420 };

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
    const target = event.originalEvent?.target;
    if (
      target instanceof Element &&
      target.closest('.leaflet-marker-icon, .metravel-trip-plan-marker, .leaflet-popup')
    ) {
      return;
    }
    onAddPointFromMap?.({ lat: event.latlng.lat, lng: event.latlng.lng });
  };

  useMapEvents({
    click: handleClick,
  });

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
  originalTrackSegments,
  fill = false,
  focusPoint,
  focusIndices,
  routeReplacementToken,
  onEditPoint,
  onMovePoint,
  onDeletePoint,
  onAddPointFromMap,
}: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const reactId = useId();
  const mapKeyRef = useRef(`trip-plan-route-map-${reactId.replace(/:/g, '')}`);
  const [L, setL] = useState<LeafletNS | null>(null);
  const [RL, setRL] = useState<ReactLeafletNS | null>(null);
  const [RLCore, setRLCore] = useState<ReactLeafletCoreRuntime | undefined>(undefined);
  // Только ширина: высота (адресная строка mobile web) не должна перерисовывать
  // карту с её 61 маркером.
  const { isDesktop } = useBreakpoints();
  const tall = !fill && isDesktop;
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
  // #1781: ставится первым же перетаскиванием маркера — дальше кадром управляет
  // пользователь, а не форма маршрута. Снимается только сигналом оптовой замены
  // маршрута (#1820), см. `FitRouteBounds`.
  const fitLockedRef = useRef(false);
  // #1820: значение счётчика замен, на котором подгонка уже отработала. Живёт
  // рядом с `fittedTokenRef` — по той же причине: разворот на весь экран
  // пересобирает MapContainer, и счётчик, живущий внутри, снимал бы защёлку на
  // каждом развороте.
  const appliedReplacementTokenRef = useRef<RouteReplacementToken | undefined>(routeReplacementToken);
  const appliedFocusIndicesTokenRef = useRef<number | null>(null);
  // Тот же leaflet-инстанс, но состоянием: слои и MapUiApi монтируются хуками
  // /map, а им нужен ререндер после готовности карты (ref его не даёт).
  const [mapInstance, setMapInstance] = useState<unknown>(null);
  const [layersOpen, setLayersOpen] = useState(false);

  const handleMapRef = useCallback((map: unknown) => {
    mapRef.current = map as { getCenter: () => { lat: number; lng: number }; getZoom: () => number };
    setMapInstance((previous: unknown) => (previous === map ? previous : map));
  }, []);

  // Кадр снимается перед КАЖДЫМ переключением контейнера: портал пересобирает
  // MapContainer, и без снимка инлайн-карта вернулась бы к виду на момент
  // разворота, а не к тому, что человек только что смотрел (#1928).
  const snapshotView = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    try {
      const center = map.getCenter();
      restoredViewRef.current = { center: [center.lat, center.lng], zoom: map.getZoom() };
    } catch {
      // Карта ещё не готова — оставим предыдущий снимок или расчётный центр.
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    snapshotView();
    setFullscreen((value) => !value);
  }, [snapshotView]);

  const exitFullscreen = useCallback(() => {
    snapshotView();
    setFullscreen(false);
  }, [snapshotView]);

  // Редактор точки живёт в панели под картой, а развёрнутая карта уходит порталом
  // в body и перекрывает её целиком — из полноэкранного режима до редактора не
  // добраться, и кнопка выглядит неработающей (#1911). Поэтому «Изменить»
  // сначала сворачивает карту, как уже сделано на native (`editPointFromMap` в
  // `TripPlanRouteMap.tsx`, #1897). Свернуть уже свёрнутую карту безвредно:
  // тем же значением состояния React ререндер не запускает.
  const editPointFromMap = useCallback(
    (index: number) => {
      exitFullscreen();
      onEditPoint?.(index);
    },
    [exitFullscreen, onEditPoint],
  );

  useEffect(() => {
    if (!fullscreen) return;
    if (typeof document === 'undefined') return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') exitFullscreen();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [exitFullscreen, fullscreen]);

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
        setRLCore(loaded.RLCore);
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
  // #1847: каждый трек файла — своя линия. Сегмент, от которого после фильтра
  // битых пар осталась одна точка, отбрасывается: нарисовать его нечем.
  const originalTrackSegmentPositions = useMemo(
    () => (originalTrackSegments ?? [])
      .map((segment) => lngLatPositions(segment ?? []))
      .filter((positions) => positions.length > 1),
    [originalTrackSegments],
  );
  const hasOriginalTrack = originalTrackSegmentPositions.length > 0;
  const center = trackPositions[0] ?? markerPositions[0] ?? DEFAULT_CENTER;
  // Токен считается по содержимому, а не по ссылке: перезапрос маршрута даёт
  // новый массив с теми же точками, и подгонка не должна срабатывать заново.
  // Мемо обязательно: у routed-геометрии тысячи координат, а компонент
  // перерисовывается на каждый ввод в панели конструктора.
  // Подгонка охватывает и оригинальный трек: он может выходить за пределы
  // упрощённых точек, и без него часть настоящей формы осталась бы за кадром.
  const fitPositions = useMemo(
    () => (originalTrackSegmentPositions.length
      ? [...trackPositions, ...originalTrackSegmentPositions.flat()]
      : trackPositions),
    [originalTrackSegmentPositions, trackPositions],
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

  // #1781: перетаскивание маркера. Карта не владеет маршрутом — она отдаёт
  // индекс и координаты дропа, а `RouteBuilder` решает, что с ними делать.
  const draggableMarkers = !readonly && typeof onMovePoint === 'function';
  const handleMarkerDragEnd = useCallback(
    (index: number) => (event: { target?: { getLatLng?: () => { lat: number; lng: number } } }) => {
      const position = event?.target?.getLatLng?.();
      if (!position) return;
      const { lat, lng } = position;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      fitLockedRef.current = true;
      onMovePoint?.({ index, lat, lng });
    },
    [onMovePoint],
  );

  if (!L || !RL) {
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
          ...(tall ? TALL_MAP_SHELL : null),
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
        {hasOriginalTrack ? <TripPlanMapTrackLegend placement={fill ? 'top' : 'bottom'} /> : null}
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

  const Polyline = RL.Polyline as any;
  const useMap = RL.useMap;
  const useMapEvents = RL.useMapEvents;

  return (
    <View
      style={[styles.wrap, fill && styles.wrapFill]}
      testID="trip-plan-route-map"
      // #2059: подсказка про жест над маркером больше не висит строкой в шапке.
      accessibilityHint={draggableMarkers ? i18nT('tripsStatic:plan.map.markerHint') : undefined}
    >
      {fill ? null : (
        <TripPlanRouteMapHeader
          pointCount={markerPositions.length}
          lineVisible={trackPositions.length >= 2}
          approximate={approximate}
          routingState={truthfulRoutingState}
          transport={transport}
          summary={summary}
          readonly={readonly}
        />
      )}

      {fullscreen ? (
        <div style={{ ...(styles.mapShellPlaceholder as React.CSSProperties), ...(tall ? TALL_MAP_SHELL : null) }} />
      ) : null}
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
              lockedRef={fitLockedRef}
              replacementToken={routeReplacementToken}
              appliedReplacementTokenRef={appliedReplacementTokenRef}
            />
          ) : null}
          {/* После подгонки под маршрут: в одном коммите кадр остаётся за днём. */}
          <FocusRouteIndices
            L={L}
            route={route}
            focusIndices={focusIndices}
            appliedTokenRef={appliedFocusIndicesTokenRef}
            useMap={useMap}
          />
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
          {originalTrackSegmentPositions.map((positions, index) => (
            <Polyline
              // Порядок сегментов задан файлом и стабилен между рендерами:
              // ключ по индексу здесь не переставляет линии местами.
              key={`original-track-segment-${index}`}
              positions={positions}
              pathOptions={{
                color: colors.accentDark,
                weight: 3,
                opacity: 0.95,
              }}
            />
          ))}
          <TripPlanRouteMarkers
            L={L}
            RL={RL}
            RLCore={RLCore}
            route={route}
            activeIndex={activeIndex}
            readonly={readonly}
            draggable={draggableMarkers}
            colors={colors}
            onDragEnd={handleMarkerDragEnd}
            onEditPoint={editPointFromMap}
            onDeletePoint={onDeletePoint}
          />
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
    hint: { fontSize: 13, lineHeight: 18, color: colors.textMuted },
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
  });
