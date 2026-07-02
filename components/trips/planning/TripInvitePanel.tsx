// components/trips/planning/TripInvitePanel.tsx
// Панель приглашения и шаринга запланированной поездки (Sprint 13 / блок D):
// мульти-выбор подписчиков для инвайта и шаринг ссылки на поездку. Только владелец.
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import Button from '@/components/ui/Button';
import type { PlannedTrip } from '@/api/plannedTrips';
import type { UserProfileDto } from '@/api/user';
import { useInviteParticipants } from '@/hooks/usePlannedTripsApi';
import { useSubscriptionsData } from '@/hooks/useSubscriptionsData';
import { openExternalUrl } from '@/utils/externalLinks';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

interface Props {
  trip: PlannedTrip;
}

const subscriberUserId = (profile: UserProfileDto): number => profile.user ?? profile.id;

const subscriberName = (profile: UserProfileDto): string => {
  const first = String(profile.first_name ?? '').trim();
  const last = String(profile.last_name ?? '').trim();
  return `${first} ${last}`.trim() || 'Без имени';
};

function TripInvitePanel({ trip }: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { subscribers, subscribersLoading } = useSubscriptionsData();
  const invite = useInviteParticipants();

  const [selected, setSelected] = useState<number[]>([]);
  const [invitedCount, setInvitedCount] = useState<number | null>(null);

  if (!trip.isOwner) return null;

  const tripUrl = `https://metravel.by/trips/plan/${trip.slug || trip.id}`;

  const toggle = (userId: number) => {
    setInvitedCount(null);
    setSelected((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const handleInvite = () => {
    if (!selected.length) return;
    invite.mutate(
      { tripId: trip.id, userIds: selected },
      {
        onSuccess: (res) => {
          setInvitedCount(res.invited);
          setSelected([]);
        },
      },
    );
  };

  const handleShare = () => {
    void openExternalUrl(`https://t.me/share/url?url=${encodeURIComponent(tripUrl)}`);
  };

  return (
    <View style={styles.wrap} testID="trip-invite">
      <Text style={styles.heading}>Пригласить и поделиться</Text>

      <Text style={styles.label}>Подписчики</Text>
      {subscribersLoading ? (
        <ActivityIndicator color={colors.primaryDark} />
      ) : subscribers.length ? (
        <>
          <View style={styles.chips}>
            {subscribers.map((profile) => {
              const userId = subscriberUserId(profile);
              const active = selected.includes(userId);
              return (
                <Pressable
                  key={userId}
                  accessibilityRole="button"
                  onPress={() => toggle(userId)}
                  style={[styles.chip, active && styles.chipActive]}
                  testID={`trip-invite-subscriber-${userId}`}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {subscriberName(profile)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Button
            label={`Пригласить выбранных (${selected.length})`}
            onPress={handleInvite}
            loading={invite.isPending}
            disabled={invite.isPending || selected.length === 0}
            fullWidth
            testID="trip-invite-submit"
          />
          {invitedCount != null ? (
            <Text style={styles.success}>Приглашено: {invitedCount}</Text>
          ) : null}
        </>
      ) : (
        <Text style={styles.hint}>
          У вас пока нет подписчиков — поделитесь ссылкой ниже.
        </Text>
      )}

      <Text style={styles.label}>Поделиться</Text>
      <Button
        label="Поделиться в Telegram"
        onPress={handleShare}
        variant="outline"
        fullWidth
        testID="trip-invite-share"
      />
      <Text style={styles.url} selectable testID="trip-invite-url">
        {tripUrl}
      </Text>
    </View>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    wrap: { gap: 10 },
    heading: { fontSize: 18, fontWeight: '700', color: colors.text },
    label: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 4 },
    hint: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.surface,
    },
    chipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.surfaceMuted,
    },
    chipText: { fontSize: 13, color: colors.textSecondary },
    chipTextActive: { color: colors.primaryText, fontWeight: '600' },
    success: { fontSize: 13, fontWeight: '600', color: colors.success },
    url: { fontSize: 13, color: colors.textMuted },
  });

export default React.memo(TripInvitePanel);
