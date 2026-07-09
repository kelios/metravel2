// components/trips/PublicTripFilters.tsx
// Фильтры каталога публичных поездок (#411): регион / тип / статус. Значения
// собираются из текущего набора поездок, чтобы не хардкодить справочники до BE.
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type {
  PublicTrip,
  PublicTripStatus,
  PublicTripsFilters,
} from '@/api/publicTrips';
import { TRIP_STATUS_LABEL } from '@/components/trips/tripFormatting';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

interface Props {
  trips: PublicTrip[];
  value: PublicTripsFilters;
  onChange: (next: PublicTripsFilters) => void;
  hasActive?: boolean;
  onReset?: () => void;
}

const STATUS_ORDER: PublicTripStatus[] = ['open', 'full', 'completed'];

function uniq(values: (string | null)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v)));
}

function PublicTripFilters({ trips, value, onChange, hasActive, onReset }: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const regions = useMemo(() => uniq(trips.map((t) => t.region)), [trips]);
  const types = useMemo(() => uniq(trips.map((t) => t.tripType)), [trips]);

  const toggle = (key: keyof PublicTripsFilters, v: string) => {
    onChange({ ...value, [key]: value[key] === v ? undefined : v });
  };

  const Chip = ({
    label,
    active,
    onPress,
    testID,
  }: {
    label: string;
    active: boolean;
    onPress: () => void;
    testID?: string;
  }) => (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      testID={testID}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={styles.wrap} testID="trip-filters">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {hasActive && onReset ? (
          <Chip
            label="Сбросить"
            active={false}
            onPress={onReset}
            testID="trip-filter-reset"
          />
        ) : null}
        {STATUS_ORDER.map((s) => (
          <Chip
            key={`status-${s}`}
            label={TRIP_STATUS_LABEL[s]}
            active={value.status === s}
            onPress={() => toggle('status', s)}
            testID={`trip-filter-status-${s}`}
          />
        ))}
        {regions.map((r) => (
          <Chip
            key={`region-${r}`}
            label={r}
            active={value.region === r}
            onPress={() => toggle('region', r)}
          />
        ))}
        {types.map((t) => (
          <Chip
            key={`type-${t}`}
            label={t}
            active={value.tripType === t}
            onPress={() => toggle('tripType', t)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    wrap: { marginBottom: 8 },
    row: { gap: 8, paddingVertical: 4, paddingHorizontal: 2 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
    chipTextActive: { color: colors.textOnPrimary },
  });

export default React.memo(PublicTripFilters);
