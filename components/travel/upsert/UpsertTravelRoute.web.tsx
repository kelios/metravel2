import React, { Suspense, useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import TravelFormErrorBoundary from '@/components/travel/TravelFormErrorBoundary';

type LazyUpsertTravel = React.LazyExoticComponent<React.ComponentType>;

const createLazyUpsertTravel = (): LazyUpsertTravel =>
  React.lazy(() => import('@/components/travel/UpsertTravel'));

const LoadingFallback = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" />
    <Text style={styles.loadingText}>Загрузка...</Text>
  </View>
);

export default function UpsertTravelRoute() {
  const [retryKey, setRetryKey] = useState(0);
  const [UpsertTravel, setUpsertTravel] = useState<LazyUpsertTravel>(createLazyUpsertTravel);

  const handleRetry = useCallback(() => {
    setUpsertTravel(createLazyUpsertTravel());
    setRetryKey((value) => value + 1);
  }, []);

  return (
    <TravelFormErrorBoundary key={retryKey} onRetry={handleRetry}>
      <Suspense fallback={<LoadingFallback />}>
        <UpsertTravel />
      </Suspense>
    </TravelFormErrorBoundary>
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
