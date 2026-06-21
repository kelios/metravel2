// components/trips/planning/TripParticipantsList.tsx
// Список участников запланированной поездки (Sprint 13 / блок D): аватар/инициалы,
// имя, роль и RSVP-бейдж. Презентационный компонент, данные приходят из trip.
import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import type { PlannedTrip, TripParticipant } from '@/api/plannedTrips';
import { RSVP_LABEL, rsvpColor } from '@/components/trips/planning/tripPlanFormatting';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

interface Props {
  trip: PlannedTrip;
}

const initialsOf = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';

function TripParticipantsList({ trip }: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const participants = trip.participants;
  const goingCount = participants.filter((p) => p.rsvp === 'going').length;

  const renderRow = (p: TripParticipant) => {
    const badgeColor = rsvpColor(p.rsvp, colors);
    return (
      <View key={p.id} style={styles.row}>
        {p.avatarUrl ? (
          <Image source={{ uri: p.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.initials}>{initialsOf(p.name)}</Text>
          </View>
        )}
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {p.name}
          </Text>
          <Text style={styles.role}>
            {p.role === 'organizer' ? 'Организатор' : 'Участник'}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: badgeColor }]}>
          <Text style={styles.badgeText}>{RSVP_LABEL[p.rsvp]}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.wrap} testID="trip-participants">
      <Text style={styles.heading}>Участники</Text>

      {participants.length ? (
        <>
          <Text style={styles.summary}>
            {participants.length} участников · {goingCount} едут
          </Text>
          <View style={styles.list}>{participants.map(renderRow)}</View>
        </>
      ) : (
        <Text style={styles.hint}>Пока никто не присоединился.</Text>
      )}
    </View>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    wrap: { gap: 10 },
    heading: { fontSize: 18, fontWeight: '700', color: colors.text },
    summary: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    hint: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
    list: { gap: 8 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 10,
      backgroundColor: colors.surface,
    },
    avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceMuted },
    avatarFallback: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
    },
    initials: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
    body: { flex: 1, gap: 2 },
    name: { fontSize: 15, fontWeight: '600', color: colors.text },
    role: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
    badge: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    badgeText: { fontSize: 12, fontWeight: '700', color: colors.textOnDark },
  });

export default React.memo(TripParticipantsList);
