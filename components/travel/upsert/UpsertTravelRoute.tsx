import React, { Suspense } from 'react';
import { useIsFocused } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

const UpsertTravel = React.lazy(() => Promise.resolve(import('@/components/travel/UpsertTravel')));

const LoadingFallback = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" />
    <Text style={styles.loadingText}>Загрузка...</Text>
  </View>
);

export default function UpsertTravelRoute() {
  const isFocused = useIsFocused();
  if (!isFocused) return null;

  return (
    <Suspense fallback={<LoadingFallback />}>
      <UpsertTravel />
    </Suspense>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
});
