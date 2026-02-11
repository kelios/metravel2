import { Platform } from 'react-native'
import TravelDetailsContainer from '@/components/travel/details/TravelDetailsContainer'
import { TravelDetailPageSkeleton } from '@/components/travel/TravelDetailPageSkeleton'
import { useResponsive } from '@/hooks/useResponsive'

export default function TravelDetailsScreen() {
  const { isHydrated: isResponsiveHydrated = true } = useResponsive()

  if (Platform.OS === 'web' && !isResponsiveHydrated) {
    return <TravelDetailPageSkeleton />
  }

  if (Platform.OS !== 'web') {
    const TravelDetailsNative = require('@/components/travel/details/TravelDetailsContainer').default
    return <TravelDetailsNative />
  }

  return <TravelDetailsContainer />
}
