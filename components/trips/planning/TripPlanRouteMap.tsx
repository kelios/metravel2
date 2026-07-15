import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import type { RouteGeometry, RoutingState, RoutePoint, RouteSummary, TripTransport } from '@/api/plannedTrips';
import {
  TRANSPORT_ICON_NAME,
  TRANSPORT_LABEL,
  formatDistance,
  formatDuration,
  isRouteApproximate,
  routingStateLabel,
} from '@/components/trips/planning/tripPlanFormatting';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
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

export default function TripPlanRouteMap({
  route,
  routeGeometry,
  routingState,
  summary,
  transport,
  readonly,
}: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const pointsWithCoordinates = route.filter((point) => point.coordinates).length;
  const routedPoints = routeGeometry?.length ?? 0;
  const approximate = isRouteApproximate(routingState);

  return (
    <View style={styles.wrap} testID="trip-plan-route-map">
      <View style={styles.iconBox}>
        <Feather name="map" size={18} color={colors.primaryDark} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{i18nT('trips:components.trips.planning.TripPlanRouteMap.karta_marshruta_ef7b0875')}</Text>
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
        <Text style={styles.text}>
          {routedPoints >= 2
            ? i18nT('trips:components.trips.planning.TripPlanRouteMap.value1_value2_tochek_treka_value3_ostanovok_4c79114f', { value1: routingStateLabel(routingState), value2: routedPoints, value3: pointsWithCoordinates })
            : readonly
              ? i18nT('trips:components.trips.planning.TripPlanRouteMap.v_marshrute_value1_tochek_s_koordinatami_c7d03940', { value1: pointsWithCoordinates })
              : i18nT('trips:components.trips.planning.TripPlanRouteMap.na_web_mozhno_dobavlyat_tochki_klikom_po_kar_ad88da15')}
        </Text>
        {approximate ? (
          <Text style={styles.warning}>{i18nT('trips:components.trips.planning.TripPlanRouteMap.liniya_pokazana_priblizitelno_proverte_marsh_f60c9d6e')}</Text>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    wrap: {
      minHeight: 124,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      backgroundColor: colors.surfaceMuted,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    iconBox: {
      width: 38,
      height: 38,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    copy: { flex: 1, gap: 4 },
    title: { fontSize: 15, fontWeight: '700', color: colors.text },
    routeMode: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 2,
    },
    routeModeText: { fontSize: 13, fontWeight: '800', color: colors.text },
    routeModeMeta: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
    text: { fontSize: 13, lineHeight: 18, color: colors.textSecondary },
    warning: { fontSize: 12, lineHeight: 16, color: colors.warningDark, fontWeight: '600' },
  });
