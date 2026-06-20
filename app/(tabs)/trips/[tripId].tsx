import React, { Suspense, useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

const PublicTripDetail = React.lazy(
  () => import('@/components/trips/PublicTripDetail'),
);

export default function TripDetailScreen() {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ tripId?: string }>();
  const tripId = Number(params.tripId);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.inner}>
        <Suspense
          fallback={
            <View style={styles.center}>
              <ActivityIndicator />
            </View>
          }
        >
          {Number.isFinite(tripId) ? <PublicTripDetail tripId={tripId} /> : null}
        </Suspense>
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, alignItems: 'center' },
    inner: { width: '100%', maxWidth: 760 },
    center: { paddingVertical: 48, alignItems: 'center' },
  });
