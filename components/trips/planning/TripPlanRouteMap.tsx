// Карта конструктора маршрута на native (#1345).
//
// Раньше здесь была текстовая карточка «на web можно добавлять точки кликом по
// карте»: в приложении маршрут на карте не показывался вообще. Теперь экран
// использует тот же WebView+Leaflet стек, что и /map (`components/MapPage/Map` →
// `Map.ios`, который ре-экспортирует `Map.android`), поэтому маршрут, точки и
// контрол «Слои» (#1306) совпадают с mobile web по составу и поведению.
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import type { RouteGeometry, RoutingState, RoutePoint, RouteSummary, TripTransport } from '@/api/plannedTrips';
import MapComponent from '@/components/MapPage/Map';
import { MapMobileLayersPopover } from '@/components/MapPage/MapMobile/MapMobileLayersPopover';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import {
  TRANSPORT_ICON_NAME,
  TRANSPORT_LABEL,
  formatDistance,
  formatDuration,
  isRouteApproximate,
  routingStateLabel,
} from '@/components/trips/planning/tripPlanFormatting';
import { useMapOverlays } from '@/hooks/map/useMapOverlays';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import type { MapUiApi } from '@/types/mapUi';
import { translate as i18nT } from '@/i18n'


interface Props {
  route: RoutePoint[];
  routeGeometry?: RouteGeometry | null;
  routingState?: RoutingState | null;
  activeIndex?: number | null;
  summary?: RouteSummary | null;
  transport?: TripTransport;
  readonly?: boolean;
  onEditPoint?: (index: number) => void;
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
  mode: 'route';
  pointsOnly?: boolean;
  onMapClick?: (lng: number, lat: number) => void;
  onMapUiApiReady?: (api: unknown) => void;
};

const NativeMap = MapComponent as unknown as React.ComponentType<NativeRouteMapProps>;

const lngLatPairs = (coordinates: Array<[number, number] | null | undefined>): Array<[number, number]> =>
  coordinates.filter((pair): pair is [number, number] => Array.isArray(pair) && pair.length >= 2);

export default function TripPlanRouteMap({
  route,
  routeGeometry,
  routingState,
  summary,
  transport,
  readonly = false,
  onAddPointFromMap,
}: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [layersOpen, setLayersOpen] = useState(false);
  const [mapUiApi, setMapUiApi] = useState<MapUiApi | null>(null);

  // Native-карта ждёт пары [lng, lat] — ровно так их хранит RoutePoint.
  const routePoints = useMemo(
    () => lngLatPairs(route.map((point) => point.coordinates)),
    [route],
  );
  const routeLine = useMemo(
    () => (routeGeometry?.length ? lngLatPairs(routeGeometry) : routePoints),
    [routeGeometry, routePoints],
  );
  const center = useMemo(() => {
    const first = routeLine[0] ?? routePoints[0];
    if (!first) return DEFAULT_CENTER;
    return { latitude: first[1], longitude: first[0] };
  }, [routeLine, routePoints]);

  const approximate = isRouteApproximate(routingState);

  const { enabledOverlays, handleOverlayToggle, overlayOptions } = useMapOverlays(mapUiApi);

  const handleMapUiApiReady = useCallback((api: unknown) => {
    setMapUiApi((api as MapUiApi | null) ?? null);
  }, []);

  const handleMapClick = useCallback(
    (lng: number, lat: number) => {
      if (readonly) return;
      onAddPointFromMap?.({ lat, lng });
    },
    [onAddPointFromMap, readonly],
  );

  const toggleLayers = useCallback(() => setLayersOpen((value) => !value), []);
  const closeLayers = useCallback(() => setLayersOpen(false), []);

  const layersLabel = i18nT('tripsStatic:plan.map.layers');

  return (
    <View style={styles.wrap} testID="trip-plan-route-map">
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
            {routeLine.length >= 2 && routeGeometry?.length
              ? routingStateLabel(routingState)
              : readonly
                ? i18nT('trips:components.trips.planning.TripPlanRouteMap.tochki_marshruta_pokazany_na_karte_14e6732e')
                : i18nT('trips:components.trips.planning.TripPlanRouteMap.nazhmite_na_kartu_chtoby_dobavit_tochku_posl_52845bf6')}
          </Text>
          {approximate ? (
            <Text style={styles.warning}>{i18nT('trips:components.trips.planning.TripPlanRouteMap.liniya_priblizitelnaya_proverte_dorogu_ili_t_9fb768f4')}</Text>
          ) : null}
        </View>
        <Text style={styles.counter}>{routePoints.length}</Text>
      </View>

      <View style={styles.mapShell}>
        <NativeMap
          travel={EMPTY_TRAVEL}
          coordinates={center}
          routePoints={routePoints}
          fullRouteCoords={routeLine}
          mode="route"
          pointsOnly
          onMapClick={handleMapClick}
          onMapUiApiReady={handleMapUiApiReady}
        />

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

        {layersOpen ? (
          <MapMobileLayersPopover
            colors={colors}
            top={LAYERS_POPOVER_TOP}
            right={LAYERS_POPOVER_RIGHT}
            minWidth={LAYERS_POPOVER_MIN_WIDTH}
            maxWidth={LAYERS_POPOVER_MAX_WIDTH}
            scrollMaxHeight={LAYERS_SCROLL_MAX_HEIGHT}
            mapUiApi={mapUiApi}
            showBaseLayer={false}
            showMapControls={false}
            overlayOptions={overlayOptions}
            enabledOverlays={enabledOverlays}
            onOverlayToggle={handleOverlayToggle}
            onRequestClose={closeLayers}
          />
        ) : null}
      </View>
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
      height: MAP_HEIGHT,
      width: '100%',
      overflow: 'hidden',
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
    },
    layersToggle: {
      position: 'absolute',
      top: 10,
      right: 10,
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
  });
