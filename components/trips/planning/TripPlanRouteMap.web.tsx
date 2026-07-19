import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import type { RouteGeometry, RoutingState, RoutePoint, RouteSummary, TripTransport } from '@/api/plannedTrips';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import {
  TRANSPORT_ICON_NAME,
  TRANSPORT_LABEL,
  formatDistance,
  formatDuration,
  isRouteApproximate,
  routingStateLabel,
} from '@/components/trips/planning/tripPlanFormatting';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { ensureLeafletCss } from '@/utils/ensureLeafletCss';
import { MapCanvas } from '@/components/MapPage/Map/MapCanvas';
import { buildDropMarkerHtml } from '@/utils/markerSvg';
import { translate as i18nT } from '@/i18n'


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
  onEditPoint?: (index: number) => void;
  onAddPointFromMap?: (coords: { lat: number; lng: number }) => void;
}

const DEFAULT_CENTER: [number, number] = [53.9, 27.5667];

const lngLatPositions = (coordinates: Array<[number, number]>): Array<[number, number]> =>
  coordinates
    .filter((coords): coords is [number, number] => Array.isArray(coords))
    .map(([lng, lat]) => [lat, lng]);

const routePositions = (route: RoutePoint[]): Array<[number, number]> =>
  lngLatPositions(route.map((point) => point.coordinates).filter(Boolean) as Array<[number, number]>);

function FitRouteBounds({
  L,
  positions,
  useMap,
}: {
  L: LeafletNS;
  positions: Array<[number, number]>;
  useMap: ReactLeafletNS['useMap'];
}) {
  const map = useMap();

  useEffect(() => {
    if (!positions.length) return;
    if (positions.length === 1) {
      map.setView(positions[0], 12);
      return;
    }
    const bounds = L.latLngBounds(positions);
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 13 });
  }, [L, map, positions]);

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

export default function TripPlanRouteMap({
  route,
  routeGeometry,
  routingState,
  activeIndex,
  summary,
  transport,
  readonly = false,
  onEditPoint,
  onAddPointFromMap,
}: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const reactId = useId();
  const mapKeyRef = useRef(`trip-plan-route-map-${reactId.replace(/:/g, '')}`);
  const [L, setL] = useState<LeafletNS | null>(null);
  const [RL, setRL] = useState<ReactLeafletNS | null>(null);

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
  const trackPositions = useMemo(() => (
    routeGeometry?.length ? lngLatPositions(routeGeometry) : markerPositions
  ), [markerPositions, routeGeometry]);
  const center = trackPositions[0] ?? markerPositions[0] ?? DEFAULT_CENTER;
  const approximate = isRouteApproximate(routingState);
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

  if (!L || !RL || !markerIcon || !activeMarkerIcon) {
    return (
      <View style={styles.loadingWrap} testID="trip-plan-route-map">
        <ActivityIndicator color={colors.primaryDark} />
        <Text style={styles.hint}>{i18nT('trips:components.trips.planning.TripPlanRouteMap.zagruzka_karty_marshruta_5f48efc0')}</Text>
      </View>
    );
  }

  const Marker = RL.Marker as any;
  const Popup = RL.Popup as any;
  const Polyline = RL.Polyline as any;
  const useMap = RL.useMap;
  const useMapEvents = RL.useMapEvents;

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
            {trackPositions.length >= 2 && routeGeometry?.length
              ? routingStateLabel(routingState)
              : readonly
                ? i18nT('trips:components.trips.planning.TripPlanRouteMap.tochki_marshruta_pokazany_na_karte_14e6732e')
                : i18nT('trips:components.trips.planning.TripPlanRouteMap.nazhmite_na_kartu_chtoby_dobavit_tochku_posl_52845bf6')}
          </Text>
          {approximate ? (
            <Text style={styles.warning}>{i18nT('trips:components.trips.planning.TripPlanRouteMap.liniya_priblizitelnaya_proverte_dorogu_ili_t_9fb768f4')}</Text>
          ) : null}
        </View>
        <Text style={styles.counter}>{markerPositions.length}</Text>
      </View>

      <div style={styles.mapShell as React.CSSProperties}>
        <MapCanvas
          engine={{ L, RL }}
          center={center}
          zoom={trackPositions.length ? 10 : 5}
          keyboard={false}
          containerKey={mapKeyRef.current}
          mapStyle={styles.map as React.CSSProperties}
        >
          {() => (<>
          <ClickToAdd
            disabled={readonly}
            onAddPointFromMap={onAddPointFromMap}
            useMapEvents={useMapEvents}
          />
          {trackPositions.length ? <FitRouteBounds L={L} positions={trackPositions} useMap={useMap} /> : null}
          {trackPositions.length > 1 ? (
            <Polyline
              positions={trackPositions}
              pathOptions={{
                color: approximate ? colors.warningDark : colors.primaryDark,
                weight: routeGeometry?.length ? 5 : 4,
                opacity: routeGeometry?.length ? 0.86 : 0.58,
                dashArray: approximate ? '8 8' : undefined,
              }}
            />
          ) : null}
          {route.map((point, index) => {
            if (!point.coordinates) return null;
            const [lng, lat] = point.coordinates;
            return (
              <Marker
                key={`${point.id}-${index}-${lat}-${lng}`}
                position={[lat, lng]}
                icon={activeIndex === index ? activeMarkerIcon : markerIcon}
              >
                <Popup>
                  <div style={styles.popup as React.CSSProperties}>
                    <div style={styles.popupTitle as React.CSSProperties}>{point.name}</div>
                    <div style={styles.popupMeta as React.CSSProperties}>
                      {lat.toFixed(5)}, {lng.toFixed(5)}
                    </div>
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
        </MapCanvas>
      </div>
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
      height: 320,
      minHeight: 320,
      width: '100%',
      overflow: 'hidden',
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: colors.border,
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
