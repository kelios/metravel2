import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';

import type { PlannedTrip } from '@/api/plannedTrips';
import Button from '@/components/ui/Button';
import TripPlanCard from '@/components/trips/planning/TripPlanCard';
import { useDeletePlannedTrip, useMyPlannedTrips } from '@/hooks/usePlannedTripsApi';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { confirmAction } from '@/utils/confirmAction';
import { showToastMessage } from '@/utils/toast';

function MyCreatedTripsList() {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { data, isLoading, isError } = useMyPlannedTrips();
  const {
    mutate: deleteTrip,
    isPending: isDeletingTrip,
    variables: deletingTripId,
  } = useDeletePlannedTrip();
  const createdTrips = useMemo(
    () => (data ?? []).filter((trip) => trip.isOwner),
    [data],
  );
  const openTrip = useCallback(
    (tripId: number) => {
      router.push(`/trips/plan/${tripId}`);
    },
    [router],
  );
  const handleDeleteTrip = useCallback(
    async (trip: PlannedTrip) => {
      const confirmed = await confirmAction({
        title: 'Удалить поездку',
        message: `Удалить поездку «${trip.title}»? Действие нельзя отменить.`,
        confirmText: 'Удалить',
        cancelText: 'Отмена',
      });
      if (!confirmed) return;

      deleteTrip(trip.id, {
        onSuccess: () => {
          void showToastMessage({
            type: 'success',
            text1: 'Поездка удалена',
            text2: 'Список созданных поездок обновлён.',
          });
        },
        onError: (error) => {
          void showToastMessage({
            type: 'error',
            text1: 'Не удалось удалить поездку',
            text2: error instanceof Error ? error.message : 'Попробуйте ещё раз позже.',
            visibilityTime: 4000,
          });
        },
      });
    },
    [deleteTrip],
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
        <View key={trip.id} style={styles.item}>
          <TripPlanCard trip={trip} />
          <View style={styles.actions}>
            <Button
              label="Открыть"
              variant="secondary"
              size="sm"
              onPress={() => openTrip(trip.id)}
              icon={<Feather name="eye" size={15} color={colors.primaryDark} />}
              style={styles.actionButton}
              testID={`my-created-trip-open-${trip.id}`}
            />
            <Button
              label="Удалить"
              variant="danger"
              size="sm"
              onPress={() => void handleDeleteTrip(trip)}
              loading={isDeletingTrip && String(deletingTripId) === String(trip.id)}
              disabled={isDeletingTrip}
              icon={<Feather name="trash-2" size={15} color={colors.textOnPrimary} />}
              style={styles.actionButton}
              testID={`my-created-trip-delete-${trip.id}`}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    list: { gap: 10 },
    item: { gap: 8 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    actionButton: { flexGrow: 1, flexBasis: 136 },
    state: { paddingVertical: 18, alignItems: 'center' },
    empty: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
    error: { fontSize: 14, lineHeight: 20, color: colors.danger, fontWeight: '600' },
  });

export default React.memo(MyCreatedTripsList);
