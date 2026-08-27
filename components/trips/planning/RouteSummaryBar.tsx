// components/trips/planning/RouteSummaryBar.tsx
// Сводка маршрута (Sprint 13 / блок D): дистанция / время / набор высоты /
// остановки в виде стат-чипов. Питается RouteSummary живого превью маршрута
// (движок /map, #1490) или routeSummary поездки с бэка.
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import type { RoutingState, RouteSummary, TripTransport } from '@/api/plannedTrips';
import {
  TRANSPORT_ICON_NAME,
  TRANSPORT_LABEL,
  formatDistance,
  formatDuration,
  formatElevation,
  isRouteApproximate,
  routingStateHint,
  routingStateLabel,
} from '@/components/trips/planning/tripPlanFormatting';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n'


interface Props {
  summary: RouteSummary | null;
  routingState?: RoutingState | null;
  transport?: TripTransport;
}

interface Chip {
  id: 'distance' | 'duration' | 'elevation' | 'stops';
  icon: string;
  value: string;
  label: string;
}

function RouteSummaryBar({ summary, routingState, transport }: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const approximate = isRouteApproximate(routingState);
  const statusLabel = routingState ? routingStateLabel(routingState) : null;
  const statusHint = routingStateHint(routingState);

  if (!summary) {
    return (
      <View style={styles.wrap} testID="route-summary">
        <Text style={styles.hint}>{i18nT('trips:components.trips.planning.RouteSummaryBar.marshrut_ne_postroen_91da795d')}</Text>
      </View>
    );
  }

  const chips: Chip[] = [
    { id: 'distance', icon: 'map', value: formatDistance(summary.distanceKm), label: i18nT('trips:components.trips.planning.RouteSummaryBar.distantsiya_5e3e6200') },
    { id: 'duration', icon: 'clock', value: formatDuration(summary.durationMin), label: i18nT('trips:components.trips.planning.RouteSummaryBar.v_puti_0359c071') },
    { id: 'elevation', icon: 'trending-up', value: formatElevation(summary.elevationGainM), label: i18nT('trips:components.trips.planning.RouteSummaryBar.nabor_304b67d6') },
    { id: 'stops', icon: 'map-pin', value: String(summary.stopsCount), label: i18nT('trips:components.trips.planning.RouteSummaryBar.ostanovki_e5a7f959') },
  ];

  return (
    <View style={styles.wrap} testID="route-summary">
      {statusLabel ? (
        <View style={styles.statusSection} testID="route-summary-status">
          <View
            style={[styles.status, approximate ? styles.statusWarning : styles.statusReady]}
            testID={approximate ? 'route-summary-approximate' : 'route-summary-routed'}
          >
            <Feather
              name={approximate ? 'alert-triangle' : 'navigation'}
              size={14}
              color={approximate ? colors.warningDark : colors.primaryDark}
            />
            <Text style={[styles.statusText, approximate && styles.statusTextWarning]}>
              {statusLabel}
            </Text>
          </View>
          {statusHint ? <Text style={styles.statusHint}>{statusHint}</Text> : null}
        </View>
      ) : null}
      {transport ? (
        <View style={styles.transportMeta} testID="route-summary-transport">
          <Feather name={TRANSPORT_ICON_NAME[transport] as never} size={14} color={colors.primaryDark} />
          <Text style={styles.transportLabel} numberOfLines={1}>
            {i18nT('trips:components.trips.planning.RouteSummaryBar.sposob_fc449610')}
          </Text>
          <Text style={styles.transportValue} numberOfLines={1}>
            {TRANSPORT_LABEL[transport]}
          </Text>
        </View>
      ) : null}
      <View style={styles.metrics} testID="route-summary-metrics">
        {chips.map((chip) => (
          <View
            key={chip.id}
            style={styles.metric}
            testID={`route-summary-metric-${chip.id}`}
          >
            <View style={styles.metricValueRow}>
              <Feather name={chip.icon as never} size={14} color={colors.primaryDark} />
              <Text
                style={styles.metricValue}
                numberOfLines={1}
                testID={`route-summary-metric-${chip.id}-value`}
              >
                {chip.value}
              </Text>
            </View>
            <Text
              style={styles.metricLabel}
              numberOfLines={1}
              testID={`route-summary-metric-${chip.id}-label`}
            >
              {chip.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    wrap: {
      gap: 8,
    },
    statusSection: { gap: 4 },
    status: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    statusReady: {
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    statusWarning: {
      borderColor: colors.warningLight,
      backgroundColor: colors.warningSoft,
    },
    statusText: { fontSize: 13, fontWeight: '700', color: colors.text },
    statusTextWarning: { color: colors.warningDark },
    statusHint: {
      fontSize: 12,
      lineHeight: 16,
      color: colors.textSecondary,
    },
    transportMeta: {
      alignSelf: 'flex-start',
      maxWidth: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor: colors.surfaceMuted,
    },
    transportLabel: { flexShrink: 1, fontSize: 11, color: colors.textMuted },
    transportValue: { flexShrink: 1, fontSize: 12, fontWeight: '700', color: colors.text },
    metrics: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    metric: {
      minWidth: 0,
      flexGrow: 1,
      flexBasis: '48%',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.surfaceMuted,
      gap: 2,
    },
    metricValueRow: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
    metricValue: { minWidth: 0, flexShrink: 1, fontSize: 15, fontWeight: '700', color: colors.text },
    metricLabel: { fontSize: 11, color: colors.textMuted },
    hint: { fontSize: 13, color: colors.textMuted },
  });

export default React.memo(RouteSummaryBar);
