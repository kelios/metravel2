import React from 'react'
import { Platform, View } from 'react-native'

export default function TravelDetailsScreen() {
  if (Platform.OS !== 'web') {
    const TravelDetailsNative = require('@/components/travel/details/TravelDetailsContainer').default
    return <TravelDetailsNative />
  }

  const TravelDetailsLazy = React.lazy(() => import('@/components/travel/details/TravelDetailsContainer'))
  return (
    <React.Suspense fallback={<View />}>
      <TravelDetailsLazy />
    </React.Suspense>
  )
}
