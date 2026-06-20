import React, { Suspense, useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

const MyApplicationsList = React.lazy(
  () => import('@/components/trips/MyApplicationsList'),
);
const TripNotificationsList = React.lazy(
  () => import('@/components/trips/TripNotificationsList'),
);

export default function MyTripsScreen() {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.inner}>
        <Text style={styles.h1}>Мои поездки</Text>

        <Text style={styles.section}>Уведомления</Text>
        <Suspense fallback={<ActivityIndicator />}>
          <TripNotificationsList />
        </Suspense>

        <Text style={styles.section}>Мои заявки</Text>
        <Suspense fallback={<ActivityIndicator />}>
          <MyApplicationsList />
        </Suspense>
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, alignItems: 'center' },
    inner: { width: '100%', maxWidth: 760, gap: 12 },
    h1: { fontSize: 26, fontWeight: '800', color: colors.text },
    section: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 8 },
  });
