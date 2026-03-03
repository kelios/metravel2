import React, { Suspense } from 'react'
import { Platform } from 'react-native'
import { TravelDetailPageSkeleton } from '@/components/travel/TravelDetailPageSkeleton'

// Keep the route module tiny — lazy-load the heavy TravelDetailsContainer
// to avoid pulling ~785-line component + all its deps into the entry bundle.
const TravelDetailsContainerLazy = React.lazy(
  () => import('@/components/travel/details/TravelDetailsContainer')
)

export default function TravelDetailsScreen() {
  if (Platform.OS !== 'web') {
    const TravelDetailsNative = require('@/components/travel/details/TravelDetailsContainer').default
    return <TravelDetailsNative />
  }

  return (
    <Suspense fallback={<TravelDetailPageSkeleton />}>
      <TravelDetailsContainerLazy />
    </Suspense>
  )
}
