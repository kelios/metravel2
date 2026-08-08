import React, { Suspense } from 'react'
import { ActivityIndicator, View } from 'react-native'

import { useWebHydrationGate } from '@/hooks/useWebHydrationGate'

const UpsertTravelRoute = React.lazy(() =>
  import('@/components/travel/upsert/UpsertTravelRoute')
)

function UpsertTravelRouteFallback() {
  return (
    <View
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      accessibilityRole="progressbar"
    >
      <ActivityIndicator />
    </View>
  )
}

export default function LazyUpsertTravelRoute() {
  const hydrationReady = useWebHydrationGate()

  if (!hydrationReady) return <UpsertTravelRouteFallback />

  return (
    <Suspense fallback={<UpsertTravelRouteFallback />}>
      <UpsertTravelRoute />
    </Suspense>
  )
}
