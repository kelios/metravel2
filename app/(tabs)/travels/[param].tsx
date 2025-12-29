import React, { Suspense, lazy } from 'react'
import { ActivityIndicator, Platform, View } from 'react-native'

const LazyTravelDetails = lazy(() => import('@/components/travel/details/TravelDetailsContainer'))

export default function TravelDetailsScreen() {
  if (Platform.OS !== 'web') {
    const TravelDetailsNative = require('@/components/travel/details/TravelDetailsContainer').default
    return <TravelDetailsNative />
  }

  return (
    <Suspense
      fallback={(
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" />
        </View>
      )}
    >
      <LazyTravelDetails />
    </Suspense>
  )
}
