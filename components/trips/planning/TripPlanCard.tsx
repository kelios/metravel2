// components/trips/planning/TripPlanCard.tsx
// Компактная текстовая карточка запланированной поездки (Sprint 13 / блок D).
// У поездок нет обложки — это утилитарный list-итем, фото намеренно не добавляем.
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';

import type { PlannedTrip } from '@/api/plannedTrips';
import {
  PLAN_STATUS_LABEL,
  TRANSPORT_ICON_NAME,
  TRANSPORT_LABEL,
  formatTripDateTime,
  planStatusColor,
  routeSummaryLine,
} from '@/components/trips/planning/tripPlanFormatting';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

interface Props {
  trip: PlannedTrip;
}

function TripPlanCard({ trip }: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const statusBg = planStatusColor(trip.status, colors);
  const participantsCount = trip.participants.length;
  const goingCount = trip.participants.filter((p) => p.rsvp === 'going').length;

  return (
    <Pressable
      onPress={() => router.push(`/trips/plan/${trip.id}`)}
      style={styles.card}
      testID={`trip-plan-card-${trip.id}`}
    >
      <View style={styles.headerRow}>
        <View style={[styles.badge, { backgroundColor: statusBg }]}>
          <Text style={styles.badgeText}>{PLAN_STATUS_LABEL[trip.status]}</Text>
        </View>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {trip.title}
      </Text>

      <View style={styles.metaRow}>
        <Feather
          name={TRANSPORT_ICON_NAME[trip.transport] as never}
          size={13}
          color={colors.textSecondary}
        />
        <Text style={styles.meta} numberOfLines={1}>
          {TRANSPORT_LABEL[trip.transport]}
        </Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {formatTripDateTime(trip.startDate, trip.startTime)}
        </Text>
      </View>

      <Text style={styles.route} numberOfLines={1}>
        {routeSummaryLine(trip.routeSummary)}
      </Text>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {participantsCount} участников · {goingCount} едут
        </Text>
      </View>
    </Pressable>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      backgroundColor: colors.surface,
      padding: 14,
      gap: 6,
    },
    headerRow: { flexDirection: 'row' },
    badge: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      alignSelf: 'flex-start',
    },
    badgeText: { fontSize: 12, fontWeight: '700', color: colors.textOnDark },
    title: { fontSize: 16, fontWeight: '700', color: colors.text },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    meta: { fontSize: 13, color: colors.textSecondary },
    metaDot: { fontSize: 13, color: colors.textMuted },
    route: { fontSize: 13, color: colors.textMuted },
    footer: {
      marginTop: 4,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    footerText: { fontSize: 13, fontWeight: '600', color: colors.text },
  });

export default React.memo(TripPlanCard);
