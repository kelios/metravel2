import React, { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import PublicTripDetail from '@/components/trips/PublicTripDetail';
import { useHydrationReady } from '@/hooks/useHydrationReady';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

export default function TripDetailScreen() {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ id?: string }>();
  const hydrationReady = useHydrationReady();
  const tripId = hydrationReady ? Number(params.id) : Number.NaN;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.inner}>
        {Number.isFinite(tripId) ? (
          <PublicTripDetail tripId={tripId} />
        ) : (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        )}
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
