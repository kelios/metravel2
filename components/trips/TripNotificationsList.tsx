// components/trips/TripNotificationsList.tsx
// UI нотификаций о заявках (#415): новая заявка (организатору) и смена статуса
// заявки (участнику). Интегрируется в раздел «Мои поездки».
import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';

import type { TripNotification } from '@/api/publicTrips';
import { useTripNotifications } from '@/hooks/usePublicTripsApi';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n'


const ICON: Record<TripNotification['kind'], keyof typeof Feather.glyphMap> = {
  new_application: 'user-plus',
  status_change: 'bell',
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const day = 24 * 60 * 60 * 1000;
  if (diff < 60 * 60 * 1000) return i18nT('trips:components.trips.TripNotificationsList.tolko_chto_efbf164e');
  if (diff < day) return i18nT('trips:components.trips.TripNotificationsList.value1_ch_nazad_8fcf483e', { value1: Math.floor(diff / (60 * 60 * 1000)) });
  return i18nT('trips:components.trips.TripNotificationsList.value1_dn_nazad_01c7bb11', { value1: Math.floor(diff / day) });
}

function TripNotificationsList() {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { data, isLoading, isError } = useTripNotifications();

  if (isLoading) {
    return (
      <View style={styles.center} testID="trip-notifications-loading">
        <ActivityIndicator color={colors.primaryDark} />
      </View>
    );
  }
  if (isError) {
    return <Text style={styles.empty}>{i18nT('trips:components.trips.TripNotificationsList.ne_udalos_zagruzit_uvedomleniya_e227aca0')}</Text>;
  }

  const notifications = data ?? [];
  if (notifications.length === 0) {
    return (
      <Text style={styles.empty} testID="trip-notifications-empty">
        {i18nT('trips:components.trips.TripNotificationsList.uvedomleniy_poka_net_ee139f4f')}</Text>
    );
  }

  return (
    <View style={styles.wrap} testID="trip-notifications-list">
      {notifications.map((n) => (
        <Pressable
          key={n.id}
          style={[styles.row, !n.read && styles.rowUnread]}
          onPress={() => router.push(`/trips/${n.tripId}`)}
          testID={`trip-notification-${n.id}`}
        >
          <View style={styles.iconWrap}>
            <Feather name={ICON[n.kind]} size={16} color={colors.primaryDark} />
          </View>
          <View style={styles.body}>
            <Text style={styles.message}>{n.message}</Text>
            <Text style={styles.time}>{relativeTime(n.createdAt)}</Text>
          </View>
          {!n.read ? <View style={styles.unreadDot} /> : null}
        </Pressable>
      ))}
    </View>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    wrap: { gap: 8 },
    center: { paddingVertical: 24, alignItems: 'center' },
    empty: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    rowUnread: { backgroundColor: colors.backgroundSecondary, borderColor: colors.primary },
    iconWrap: {
      width: 34,
      height: 34,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundSecondary,
    },
    body: { flex: 1, gap: 2 },
    message: { fontSize: 14, lineHeight: 19, color: colors.text },
    time: { fontSize: 12, color: colors.textMuted },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
  });

export default React.memo(TripNotificationsList);
