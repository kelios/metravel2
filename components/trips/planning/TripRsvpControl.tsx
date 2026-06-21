// components/trips/planning/TripRsvpControl.tsx
// Управление RSVP участника запланированной поездки (Sprint 13 / блок D): три чипа
// Поеду/Думаю/Не смогу. Рендерится только для приглашённого участника (не владельца).
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PlannedTrip, TripRsvp } from '@/api/plannedTrips';
import { RSVP_LABEL } from '@/components/trips/planning/tripPlanFormatting';
import { useSetRsvp } from '@/hooks/usePlannedTripsApi';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

interface Props {
  trip: PlannedTrip;
}

// Бэкенд хранит planned-RSVP только в двух состояниях (accepted/declined),
// поэтому участнику предлагаем ровно два варианта — без «Думаю».
const RSVP_OPTIONS: Array<Extract<TripRsvp, 'going' | 'declined'>> = ['going', 'declined'];

const RSVP_TESTID: Record<'going' | 'declined', string> = {
  going: 'trip-rsvp-going',
  declined: 'trip-rsvp-declined',
};

function TripRsvpControl({ trip }: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const setRsvp = useSetRsvp();

  if (trip.isOwner || trip.myRsvp == null) return null;

  const handlePress = (rsvp: TripRsvp) => {
    setRsvp.mutate({ tripId: trip.id, rsvp });
  };

  return (
    <View style={styles.wrap} testID="trip-rsvp">
      <Text style={styles.heading}>Ваш ответ</Text>

      <View style={styles.chips}>
        {RSVP_OPTIONS.map((rsvp) => {
          const active = trip.myRsvp === rsvp;
          return (
            <Pressable
              key={rsvp}
              accessibilityRole="button"
              disabled={setRsvp.isPending}
              onPress={() => handlePress(rsvp)}
              style={[
                styles.chip,
                active && styles.chipActive,
                setRsvp.isPending && styles.chipDisabled,
              ]}
              testID={RSVP_TESTID[rsvp]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {RSVP_LABEL[rsvp]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {setRsvp.isError ? (
        <Text style={styles.error}>
          Не удалось сохранить ответ. Попробуйте ещё раз.
        </Text>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    wrap: { gap: 8 },
    heading: { fontSize: 18, fontWeight: '700', color: colors.text },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: colors.surface,
    },
    chipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.surfaceMuted,
    },
    chipDisabled: { opacity: 0.5 },
    chipText: { fontSize: 13, color: colors.textSecondary },
    chipTextActive: { color: colors.primary, fontWeight: '600' },
    error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  });

export default React.memo(TripRsvpControl);
