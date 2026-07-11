// components/trips/communication/TripTelegramGroupCard.tsx
// Карточка Telegram-группы поездки (Sprint 15 / блок 6, FE-423).
// Владелец без группы видит «Создать Telegram-группу» только когда backend
// реально доступен. Если endpoint/invite ещё не готовы, карточка показывает
// disabled fallback и не открывает fake t.me links.
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import Button from '@/components/ui/Button';
import { TELEGRAM_GROUP_UNAVAILABLE_REASON } from '@/api/tripTelegramGroup';
import {
  useCreateTripTelegramGroup,
  useFetchTripInviteLink,
  useTripTelegramGroup,
} from '@/hooks/useTripTelegramGroupApi';
import { openExternalUrl } from '@/utils/externalLinks';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

interface Props {
  tripId: number;
  isOwner: boolean;
}

export function TripTelegramGroupCard({ tripId, isOwner }: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: group, isLoading, isError } = useTripTelegramGroup(tripId);
  const create = useCreateTripTelegramGroup(tripId);
  const invite = useFetchTripInviteLink(tripId);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleCreate = () => {
    setActionError(null);
    create.mutate(undefined, {
      onSuccess: (nextGroup) => {
        if (!nextGroup.isAvailable) {
          setActionError(nextGroup.unavailableReason);
        }
      },
      onError: () =>
        setActionError('Не удалось создать группу. Попробуйте ещё раз позже.'),
    });
  };

  const handleInvite = () => {
    setActionError(null);
    invite.mutate(undefined, {
      onSuccess: (link) => {
        if (!link.isAvailable || !link.url) {
          setActionError(link.unavailableReason);
          return;
        }
        void (async () => {
          const opened = await openExternalUrl(link.url);
          if (!opened) {
            setActionError('Не удалось открыть приглашение. Попробуйте позже.');
          }
        })();
      },
      onError: () =>
        setActionError('Не удалось получить ссылку-приглашение. Попробуйте позже.'),
    });
  };

  const handleOpenGroup = () => {
    if (!group?.groupUrl) return;
    void (async () => {
      const opened = await openExternalUrl(group.groupUrl as string);
      if (!opened) {
        setActionError('Не удалось открыть Telegram-группу. Попробуйте позже.');
      }
    })();
  };

  if (isLoading) {
    return (
      <View style={styles.card} testID="trip-telegram-loading">
        <ActivityIndicator color={colors.primaryDark} />
      </View>
    );
  }

  const enabled = group?.enabled ?? false;
  const unavailable = isError || !group || group.isAvailable === false;

  if (unavailable) {
    return (
      <View style={styles.card} testID="trip-telegram-unavailable">
        <View style={styles.header}>
          <Feather name="send" size={16} color={colors.primaryDark} />
          <Text style={styles.title}>Telegram-группа поездки</Text>
        </View>
        <Text style={styles.hint}>
          {group?.unavailableReason ?? TELEGRAM_GROUP_UNAVAILABLE_REASON}
        </Text>
        <Button
          label="Скоро будет доступно"
          disabled
          fullWidth
          testID="trip-telegram-disabled"
        />
        {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
      </View>
    );
  }

  // Группы нет: владельцу — кнопка создания, остальным — ничего не показываем.
  if (!enabled) {
    if (!isOwner) return null;
    return (
      <View style={styles.card} testID="trip-telegram-card">
        <View style={styles.header}>
          <Feather name="send" size={16} color={colors.primaryDark} />
          <Text style={styles.title}>Telegram-группа поездки</Text>
        </View>
        <Text style={styles.hint}>
          Создайте чат для участников, чтобы согласовать детали встречи.
        </Text>
        <Button
          label="Создать Telegram-группу"
          onPress={handleCreate}
          loading={create.isPending}
          disabled={create.isPending}
          fullWidth
          testID="trip-telegram-create"
        />
        {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.card} testID="trip-telegram-card">
      <View style={styles.header}>
        <Feather name="send" size={16} color={colors.primaryDark} />
        <Text style={styles.title}>Telegram-группа поездки</Text>
      </View>
      <Text style={styles.hint}>
        Группа создана. Пригласите участников или откройте чат.
      </Text>
      <View style={styles.actions}>
        <Button
          label="Пригласить в Telegram"
          onPress={handleInvite}
          loading={invite.isPending}
          disabled={invite.isPending}
          icon={<Feather name="user-plus" size={15} color={colors.textOnPrimary} />}
          fullWidth
          testID="trip-telegram-invite"
        />
        {group?.groupUrl ? (
          <Button
            label="Открыть группу"
            variant="outline"
            onPress={handleOpenGroup}
            icon={<Feather name="external-link" size={15} color={colors.primaryDark} />}
            fullWidth
            testID="trip-telegram-open"
          />
        ) : null}
      </View>
      {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
    </View>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    card: {
      gap: 10,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { fontSize: 15, fontWeight: '700', color: colors.text },
    hint: { fontSize: 13, lineHeight: 18, color: colors.textSecondary },
    actions: { gap: 8 },
    error: { fontSize: 13, fontWeight: '600', color: colors.danger },
  });

export default React.memo(TripTelegramGroupCard);
