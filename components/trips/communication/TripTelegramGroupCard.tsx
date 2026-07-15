// components/trips/communication/TripTelegramGroupCard.tsx
// Карточка Telegram-группы поездки (Sprint 15 / блок 6, FE-423).
// Владелец без группы видит «Создать Telegram-группу» только когда backend
// реально доступен. Если endpoint/invite ещё не готовы, карточка показывает
// disabled fallback и не открывает fake t.me links.
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import Button from '@/components/ui/Button';
import { getTelegramGroupUnavailableReason } from '@/api/tripTelegramGroup';
import {
  useCreateTripTelegramGroup,
  useFetchTripInviteLink,
  useTripTelegramGroup,
} from '@/hooks/useTripTelegramGroupApi';
import { openExternalUrl } from '@/utils/externalLinks';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n'


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
        setActionError(i18nT('trips:components.trips.communication.TripTelegramGroupCard.ne_udalos_sozdat_gruppu_poprobuyte_esche_raz_07b60f21')),
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
            setActionError(i18nT('trips:components.trips.communication.TripTelegramGroupCard.ne_udalos_otkryt_priglashenie_poprobuyte_poz_7261ff13'));
          }
        })();
      },
      onError: () =>
        setActionError(i18nT('trips:components.trips.communication.TripTelegramGroupCard.ne_udalos_poluchit_ssylku_priglashenie_popro_a0cf1e5f')),
    });
  };

  const handleOpenGroup = () => {
    if (!group?.groupUrl) return;
    void (async () => {
      const opened = await openExternalUrl(group.groupUrl as string);
      if (!opened) {
        setActionError(i18nT('trips:components.trips.communication.TripTelegramGroupCard.ne_udalos_otkryt_telegram_gruppu_poprobuyte__de851d4d'));
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
          <Text style={styles.title}>{i18nT('trips:components.trips.communication.TripTelegramGroupCard.telegram_gruppa_poezdki_0442266c')}</Text>
        </View>
        <Text style={styles.hint}>
          {group?.unavailableReason ?? getTelegramGroupUnavailableReason()}
        </Text>
        <Button
          label={i18nT('trips:components.trips.communication.TripTelegramGroupCard.skoro_budet_dostupno_633bd21a')}
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
          <Text style={styles.title}>{i18nT('trips:components.trips.communication.TripTelegramGroupCard.telegram_gruppa_poezdki_0442266c')}</Text>
        </View>
        <Text style={styles.hint}>
          {i18nT('trips:components.trips.communication.TripTelegramGroupCard.sozdayte_chat_dlya_uchastnikov_chtoby_soglas_ed38c215')}</Text>
        <Button
          label={i18nT('trips:components.trips.communication.TripTelegramGroupCard.sozdat_telegram_gruppu_1e2481b5')}
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
        <Text style={styles.title}>{i18nT('trips:components.trips.communication.TripTelegramGroupCard.telegram_gruppa_poezdki_0442266c')}</Text>
      </View>
      <Text style={styles.hint}>
        {i18nT('trips:components.trips.communication.TripTelegramGroupCard.gruppa_sozdana_priglasite_uchastnikov_ili_ot_8f4f92ea')}</Text>
      <View style={styles.actions}>
        <Button
          label={i18nT('trips:components.trips.communication.TripTelegramGroupCard.priglasit_v_telegram_5ac41d6a')}
          onPress={handleInvite}
          loading={invite.isPending}
          disabled={invite.isPending}
          icon={<Feather name="user-plus" size={15} color={colors.textOnPrimary} />}
          fullWidth
          testID="trip-telegram-invite"
        />
        {group?.groupUrl ? (
          <Button
            label={i18nT('trips:components.trips.communication.TripTelegramGroupCard.otkryt_gruppu_88d34fe6')}
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
