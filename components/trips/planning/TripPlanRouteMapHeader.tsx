// components/trips/planning/TripPlanRouteMapHeader.tsx
// #2059: шапка карты конструктора и легенда оригинального трека — общие для
// web (`TripPlanRouteMap.web.tsx`) и native (`TripPlanRouteMap.tsx`). Раньше
// обе платформы собирали шапку копиями из шести независимых строк; макет
// `docs/features/trips-plan-route-tab-mock.md` §4 оставляет три:
//   1. заголовок и счётчик с подписью («61 точка»);
//   2. способ, цифры и чип статуса;
//   3. причина приблизительного маршрута (#2057) или подсказка пустой карты.
// Подсказка про перетаскивание маркера ушла в `accessibilityHint` карты,
// легенда трека — внутрь карты (`TripPlanMapTrackLegend`).
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { RouteSummary, RoutingState, TripTransport } from '@/api/plannedTrips';
import MapIcon from '@/components/MapPage/MapIcon';
import SavedRouteRetryButton from '@/components/trips/planning/SavedRouteRetryButton';
import type { SavedRouteRetryState } from '@/components/trips/planning/useSavedRouteRetry';
import {
  TRANSPORT_ICON_NAME,
  TRANSPORT_LABEL,
  routeMetricsLine,
  routingStateHint,
  routingStateLabel,
} from '@/components/trips/planning/tripPlanFormatting';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { translate as i18nT, translatePlural } from '@/i18n';

type HeaderProps = {
  /** Точки с пригодными координатами — ровно те, что стоят на карте маркерами. */
  pointCount: number;
  /** На карте есть линия (две точки и больше): только у неё бывает статус. */
  lineVisible: boolean;
  approximate: boolean;
  /** Состояние построения, которому можно верить (см. `truthfulRoutingState` карт). */
  routingState: RoutingState | null | undefined;
  transport?: TripTransport;
  summary?: RouteSummary | null;
  readonly: boolean;
  /** #2065: «Повторить» для сохранённого приблизительного маршрута (владелец, временная причина). */
  retry?: SavedRouteRetryState | null;
};

export default function TripPlanRouteMapHeader({
  pointCount,
  lineVisible,
  approximate,
  routingState,
  transport,
  summary,
  readonly,
  retry,
}: HeaderProps) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const statusLabel = lineVisible && routingState ? routingStateLabel(routingState) : null;
  const reason = approximate
    ? routingStateHint(routingState, transport)
      ?? i18nT('trips:components.trips.planning.TripPlanRouteMap.liniya_priblizitelnaya_proverte_dorogu_ili_t_9fb768f4')
    : null;
  // Пустая карта (меньше двух точек) — единственное место постоянной подсказки.
  const emptyHint = !reason && !lineVisible
    ? readonly
      ? i18nT('trips:components.trips.planning.TripPlanRouteMap.tochki_marshruta_pokazany_na_karte_14e6732e')
      : i18nT('trips:components.trips.planning.TripPlanRouteMap.nazhmite_na_kartu_chtoby_dobavit_tochku_posl_52845bf6')
    : null;

  return (
    <View style={styles.header} testID="trip-plan-map-header">
      <View style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={1}>
          {i18nT('trips:components.trips.planning.TripPlanRouteMap.karta_marshruta_8fbc6a38')}
        </Text>
        <Text style={styles.counter} numberOfLines={1} testID="trip-plan-map-point-count">
          {translatePlural('tripsStatic:plan.map.pointCount', pointCount)}
        </Text>
      </View>
      {transport || summary || statusLabel ? (
        <View style={styles.modeRow} testID="trip-plan-map-route-mode">
          {transport ? (
            <View style={styles.modeLabel}>
              <MapIcon name={TRANSPORT_ICON_NAME[transport]} size={14} color={colors.primaryDark} />
              <Text style={styles.modeText} numberOfLines={1}>{TRANSPORT_LABEL[transport]}</Text>
            </View>
          ) : null}
          {summary ? <Text style={styles.modeMeta} numberOfLines={1}>{routeMetricsLine(summary)}</Text> : null}
          {statusLabel ? (
            <Text
              style={[styles.statusChip, approximate && styles.statusChipWarning]}
              numberOfLines={1}
              testID="trip-plan-map-route-status"
            >
              {statusLabel}
            </Text>
          ) : null}
        </View>
      ) : null}
      {reason ? (
        <View style={styles.warningRow}>
          <Text style={styles.warning} testID="trip-plan-map-route-reason">{reason}</Text>
          <SavedRouteRetryButton retry={retry} testID="trip-plan-map-route-retry" />
        </View>
      ) : emptyHint ? (
        <Text style={styles.hint} testID="trip-plan-map-empty-hint">{emptyHint}</Text>
      ) : null}
    </View>
  );
}

/**
 * Легенда оригинального трека внутри карты (#1496). В map-first раскладке —
 * сверху слева, как раньше; во встроенной карте верхний левый угол занят
 * зумом Leaflet, поэтому легенда стоит снизу слева.
 */
export function TripPlanMapTrackLegend({ placement }: { placement: 'top' | 'bottom' }) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View
      style={[styles.legend, placement === 'top' ? styles.legendTop : styles.legendBottom]}
      pointerEvents="none"
      testID="trip-plan-map-original-track-legend"
    >
      <View style={[styles.legendLine, { backgroundColor: colors.accentDark }]} />
      <Text style={styles.legendText} numberOfLines={1}>{i18nT('tripsStatic:plan.map.originalTrack')}</Text>
    </View>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    header: { gap: 4 },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    title: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: '700', color: colors.text },
    counter: {
      flexShrink: 0,
      borderRadius: 999,
      overflow: 'hidden',
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: colors.surfaceMuted,
      color: colors.text,
      fontSize: 13,
      fontWeight: '800',
    },
    modeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      columnGap: 8,
      rowGap: 4,
    },
    modeLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    modeText: { fontSize: 13, fontWeight: '800', color: colors.text },
    modeMeta: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
    statusChip: {
      borderRadius: 999,
      overflow: 'hidden',
      paddingHorizontal: 8,
      paddingVertical: 2,
      backgroundColor: colors.primarySoft,
      color: colors.primaryDark,
      fontSize: 12,
      fontWeight: '700',
    },
    statusChipWarning: {
      backgroundColor: colors.warningSoft,
      color: colors.warningDark,
    },
    hint: { fontSize: 13, lineHeight: 18, color: colors.textMuted },
    warningRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      columnGap: 10,
      rowGap: 6,
    },
    warning: { flexShrink: 1, minWidth: 160, fontSize: 12, lineHeight: 16, color: colors.warningDark, fontWeight: '700' },
    legend: {
      position: 'absolute',
      left: 12,
      zIndex: 3,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: colors.surface,
    },
    legendTop: { top: 12 },
    legendBottom: { bottom: 12 },
    legendLine: { width: 22, height: 3, borderRadius: 999 },
    legendText: { fontSize: 12, color: colors.textSecondary, fontWeight: '700' },
  });
