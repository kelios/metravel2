import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import TripPlanCard from '@/components/trips/planning/TripPlanCard';
import { useMyPlannedTrips } from '@/hooks/usePlannedTripsApi';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

function MyCreatedTripsList() {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data, isLoading, isError } = useMyPlannedTrips();
  const createdTrips = useMemo(
    () => (data ?? []).filter((trip) => trip.isOwner),
    [data],
  );

  if (isLoading) {
    return (
      <View style={styles.state} testID="my-created-trips-loading">
        <ActivityIndicator color={colors.primaryDark} />
      </View>
    );
  }

  if (isError) {
    return (
      <Text style={styles.error} testID="my-created-trips-error">
        Не удалось загрузить созданные поездки.
      </Text>
    );
  }

  if (createdTrips.length === 0) {
    return (
      <Text style={styles.empty} testID="my-created-trips-empty">
        Вы пока не создавали поездки.
      </Text>
    );
  }

  return (
    <View style={styles.list} testID="my-created-trips-list">
      {createdTrips.map((trip) => (
        <TripPlanCard key={trip.id} trip={trip} />
      ))}
    </View>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    list: { gap: 10 },
    state: { paddingVertical: 18, alignItems: 'center' },
    empty: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
    error: { fontSize: 14, lineHeight: 20, color: colors.danger, fontWeight: '600' },
  });

export default React.memo(MyCreatedTripsList);
