import React, { Suspense } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

const UpsertTravel = React.lazy(() => import('@/components/travel/UpsertTravel'));

const LoadingFallback = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" />
    <Text style={styles.loadingText}>Загрузка...</Text>
  </View>
);

export default function NewTravelScreen() {
    const isFocused = useIsFocused();

    return (
        <Suspense fallback={<LoadingFallback />}>
            {isFocused ? <UpsertTravel /> : null}
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
