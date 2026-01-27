import { Suspense, lazy } from 'react'
import { Platform } from 'react-native'
import { TravelDetailPageSkeleton } from '@/components/travel/TravelDetailPageSkeleton'

const TravelDetailsWebLazy = lazy(() => import('@/components/travel/details/TravelDetailsContainer'))

export default function TravelDetailsScreen() {
  if (Platform.OS !== 'web') {
    const TravelDetailsNative = require('@/components/travel/details/TravelDetailsContainer').default
    return <TravelDetailsNative />
  }

  return (
    <Suspense fallback={<TravelDetailPageSkeleton />}>
      <TravelDetailsWebLazy />
    </Suspense>
  )
}
