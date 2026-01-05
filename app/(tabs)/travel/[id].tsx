import React, { Suspense } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';

const UpsertTravel = React.lazy(() => import('@/components/travel/UpsertTravel'));

const LoadingFallback = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" />
    <Text style={styles.loadingText}>Загрузка...</Text>
  </View>
);

export default function EditTravelScreen() {
   const isFocused = useIsFocused();
   const shouldRender = Platform.OS === 'web' || isFocused;

  return (
    <Suspense fallback={<LoadingFallback />}>
      {shouldRender ? <UpsertTravel /> : null}
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
