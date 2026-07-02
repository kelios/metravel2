// components/trips/communication/TripTelegramGroupCard.tsx
// Карточка Telegram-группы поездки (Sprint 15 / блок 6, FE-423).
// Владелец без группы видит «Создать Telegram-группу»; когда группа включена —
// все (владелец/участники) видят «Пригласить в Telegram» (invite-link → open) и
// «Открыть группу». Все ссылки открываются только через openExternalUrl.
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import Button from '@/components/ui/Button';
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
  const { data: group, isLoading } = useTripTelegramGroup(tripId);
  const create = useCreateTripTelegramGroup(tripId);
  const invite = useFetchTripInviteLink(tripId);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleCreate = () => {
    setActionError(null);
    create.mutate(undefined, {
      onError: () =>
        setActionError('Не удалось создать группу. Попробуйте ещё раз позже.'),
    });
  };

  const handleInvite = () => {
    setActionError(null);
    invite.mutate(undefined, {
      onSuccess: (link) => {
        void openExternalUrl(link.url);
      },
      onError: () =>
        setActionError('Не удалось получить ссылку-приглашение. Попробуйте позже.'),
    });
  };

  const handleOpenGroup = () => {
    if (group?.groupUrl) void openExternalUrl(group.groupUrl);
  };

  if (isLoading) {
    return (
      <View style={styles.card} testID="trip-telegram-loading">
        <ActivityIndicator color={colors.primaryDark} />
      </View>
    );
  }

  const enabled = group?.enabled ?? false;

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
