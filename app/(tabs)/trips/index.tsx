import React, { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';

import TripsPageSeo from '@/components/trips/TripsPageSeo';

const PublicTripsCatalog = React.lazy(
  () => import('@/components/trips/PublicTripsCatalog'),
);

export default function TripsScreen() {
  return (
    <>
      <TripsPageSeo
        canonicalPath="/trips"
        fallbackTitle="catalog"
      />
      <Suspense
        fallback={
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator />
          </View>
        }
      >
        <PublicTripsCatalog />
      </Suspense>
    </>
  );
}
