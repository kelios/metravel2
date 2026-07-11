// components/trips/planning/TripInvitePanel.tsx
// Панель приглашения и шаринга запланированной поездки (Sprint 13 / блок D):
// мульти-выбор подписчиков для инвайта и шаринг ссылки на поездку. Только владелец.
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import Button from '@/components/ui/Button';
import type { PlannedTrip } from '@/api/plannedTrips';
import type { UserProfileDto } from '@/api/user';
import { useInviteParticipants } from '@/hooks/usePlannedTripsApi';
import { useSubscriptionsData } from '@/hooks/useSubscriptionsData';
import { openExternalUrl } from '@/utils/externalLinks';
import { buildTripPlanUrl, buildTripTelegramShareUrl } from '@/utils/tripPlanLinks';
import { shareTripPlan } from '@/utils/shareTripPlan';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

interface Props {
  trip: PlannedTrip;
}

const subscriberUserId = (profile: UserProfileDto): number => profile.user ?? profile.id;

type InviteSubscriberProfile = UserProfileDto & {
  display_name?: string | null;
  full_name?: string | null;
  name?: string | null;
  username?: string | null;
  email?: string | null;
};

export const getTripInviteSubscriberName = (profile: InviteSubscriberProfile): string => {
  const first = String(profile.first_name ?? '').trim();
  const last = String(profile.last_name ?? '').trim();
  const firstLast = `${first} ${last}`.trim();
  const fallbackId = subscriberUserId(profile);
  const candidates = [
    profile.display_name,
    profile.full_name,
    profile.name,
    firstLast,
    profile.username,
    profile.email,
  ];
  const name = candidates
    .map((value) => String(value ?? '').trim())
    .find((value) => value.length > 0);

  return name || (fallbackId ? `Пользователь #${fallbackId}` : 'Пользователь');
};

function TripInvitePanel({ trip }: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { subscribers, subscribersLoading } = useSubscriptionsData();
  const invite = useInviteParticipants();

  const [selected, setSelected] = useState<number[]>([]);
  const [invitedCount, setInvitedCount] = useState<number | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [systemSharePending, setSystemSharePending] = useState(false);

  const selectedNames = useMemo(() => {
    if (!selected.length) return [];
    const byUserId = new Map(subscribers.map((profile) => [subscriberUserId(profile), profile]));
    return selected
      .map((userId) => byUserId.get(userId))
      .filter((profile): profile is UserProfileDto => Boolean(profile))
      .map((profile) => getTripInviteSubscriberName(profile));
  }, [selected, subscribers]);

  if (!trip.isOwner) return null;

  const tripUrl = buildTripPlanUrl(trip);
  const telegramShareUrl = buildTripTelegramShareUrl(trip);

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

  const handleSystemShare = () => {
    setShareError(null);
    setSystemSharePending(true);
    void shareTripPlan(trip)
      .then((result) => {
        if (result === 'unavailable') {
          setShareError('Не удалось открыть меню «Поделиться». Попробуйте ещё раз.');
        }
      })
      .finally(() => setSystemSharePending(false));
  };

  const handleTelegramShare = () => {
    setShareError(null);
    if (!telegramShareUrl) {
      setShareError('Не удалось сформировать ссылку на поездку.');
      return;
    }
    void (async () => {
      const opened = await openExternalUrl(telegramShareUrl);
      if (!opened) {
        setShareError('Не удалось открыть Telegram. Ссылка на поездку доступна ниже.');
      }
    })();
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
                  <Text
                    style={[styles.chipText, active && styles.chipTextActive]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {getTripInviteSubscriberName(profile)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {selectedNames.length ? (
            <Text style={styles.selectedNames} numberOfLines={2} testID="trip-invite-selected-names">
              Выбрано: {selectedNames.join(', ')}
            </Text>
          ) : null}
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
        label="Поделиться"
        onPress={handleSystemShare}
        loading={systemSharePending}
        disabled={systemSharePending || !tripUrl}
        icon={<Feather name="share-2" size={15} color={colors.textOnPrimary} />}
        fullWidth
        testID="trip-invite-share-system"
      />
      <Button
        label="Поделиться в Telegram"
        onPress={handleTelegramShare}
        variant="outline"
        disabled={!telegramShareUrl}
        fullWidth
        testID="trip-invite-share"
      />
      {shareError ? <Text style={styles.error}>{shareError}</Text> : null}
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
      maxWidth: '100%',
      alignSelf: 'flex-start',
    },
    chipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.surfaceMuted,
    },
    chipText: { fontSize: 13, color: colors.textSecondary, flexShrink: 1, maxWidth: '100%' },
    chipTextActive: { color: colors.primaryText, fontWeight: '600' },
    selectedNames: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
    success: { fontSize: 13, fontWeight: '600', color: colors.success },
    error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
    url: { fontSize: 13, color: colors.textMuted },
  });

export default React.memo(TripInvitePanel);
