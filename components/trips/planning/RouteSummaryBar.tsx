// components/trips/planning/RouteSummaryBar.tsx
// Сводка маршрута (Sprint 13 / блок D): дистанция / время / набор высоты /
// остановки в виде стат-чипов. Питается RouteSummary из estimateRouteSummary
// (мгновенный предпросмотр) или routeSummary поездки с бэка.
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import type { RouteSummary } from '@/api/plannedTrips';
import {
  formatDistance,
  formatDuration,
  formatElevation,
} from '@/components/trips/planning/tripPlanFormatting';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

interface Props {
  summary: RouteSummary | null;
}

interface Chip {
  icon: string;
  value: string;
  label: string;
}

function RouteSummaryBar({ summary }: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!summary) {
    return (
      <View style={styles.wrap} testID="route-summary">
        <Text style={styles.hint}>Маршрут не построен</Text>
      </View>
    );
  }

  const chips: Chip[] = [
    { icon: 'map', value: formatDistance(summary.distanceKm), label: 'Дистанция' },
    { icon: 'clock', value: formatDuration(summary.durationMin), label: 'В пути' },
    { icon: 'trending-up', value: formatElevation(summary.elevationGainM), label: 'Набор' },
    { icon: 'map-pin', value: String(summary.stopsCount), label: 'Остановки' },
  ];

  return (
    <View style={styles.wrap} testID="route-summary">
      {chips.map((chip) => (
        <View key={chip.label} style={styles.chip}>
          <View style={styles.chipValueRow}>
            <Feather name={chip.icon as never} size={14} color={colors.primary} />
            <Text style={styles.chipValue}>{chip.value}</Text>
          </View>
          <Text style={styles.chipLabel}>{chip.label}</Text>
        </View>
      ))}
    </View>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      alignItems: 'center',
    },
    chip: {
      flexGrow: 1,
      flexBasis: 80,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.surfaceMuted,
      gap: 2,
    },
    chipValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    chipValue: { fontSize: 15, fontWeight: '700', color: colors.text },
    chipLabel: { fontSize: 11, color: colors.textMuted },
    hint: { fontSize: 13, color: colors.textMuted },
  });

export default React.memo(RouteSummaryBar);
