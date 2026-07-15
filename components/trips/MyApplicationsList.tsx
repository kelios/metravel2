// components/trips/MyApplicationsList.tsx
// Список заявок участника со статусами (#414): Новая / На рассмотрении /
// Одобрена / Отклонена / Отменена + возможность отменить активную заявку.
import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import TripStatusBadge from '@/components/trips/TripStatusBadge';
import type { TripApplication } from '@/api/publicTrips';
import { useCancelApplication, useMyTripApplications } from '@/hooks/usePublicTripsApi';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n'


const canCancel = (a: TripApplication) => a.status === 'new' || a.status === 'pending';

function MyApplicationsList() {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { data, isLoading, isError } = useMyTripApplications();
  const cancel = useCancelApplication();

  if (isLoading) {
    return (
      <View style={styles.center} testID="my-applications-loading">
        <ActivityIndicator color={colors.primaryDark} />
      </View>
    );
  }
  if (isError) {
    return <Text style={styles.empty}>{i18nT('trips:components.trips.MyApplicationsList.ne_udalos_zagruzit_vashi_zayavki_7641f02e')}</Text>;
  }

  const applications = data ?? [];
  if (applications.length === 0) {
    return (
      <Text style={styles.empty} testID="my-applications-empty">
        {i18nT('trips:components.trips.MyApplicationsList.vy_esche_ne_podavali_zayavok_naydite_poezdku_466710bc')}</Text>
    );
  }

  return (
    <View style={styles.wrap} testID="my-applications-list">
      {applications.map((a) => (
        <Pressable
          key={a.id}
          style={styles.card}
          onPress={() => router.push(`/trips/${a.tripId}`)}
          testID={`my-application-${a.id}`}
        >
          <View style={styles.row}>
            <Text style={styles.title} numberOfLines={2}>
              {a.tripTitle}
            </Text>
            <TripStatusBadge kind="application" status={a.status} />
          </View>
          <Text style={styles.message} numberOfLines={2}>
            {a.message}
          </Text>
          {canCancel(a) ? (
            <Pressable
              onPress={(e) => {
                e?.stopPropagation?.();
                cancel.mutate(a.id);
              }}
              hitSlop={8}
              accessibilityRole="button"
              testID={`my-application-${a.id}-cancel`}
            >
              <Text style={styles.cancel}>{i18nT('trips:components.trips.MyApplicationsList.otmenit_zayavku_0a313720')}</Text>
            </Pressable>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    wrap: { gap: 10 },
    center: { paddingVertical: 24, alignItems: 'center' },
    empty: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
    card: {
      gap: 6,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    title: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text, lineHeight: 20 },
    message: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
    cancel: { fontSize: 13, fontWeight: '600', color: colors.danger, marginTop: 2 },
  });

export default React.memo(MyApplicationsList);
