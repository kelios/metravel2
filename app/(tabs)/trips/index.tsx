import React, { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';

const PublicTripsCatalog = React.lazy(
  () => import('@/components/trips/PublicTripsCatalog'),
);

export default function TripsScreen() {
  return (
    <Suspense
      fallback={
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      }
    >
      <PublicTripsCatalog />
    </Suspense>
  );
}
