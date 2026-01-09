import React, { Suspense } from 'react'
import { Platform, View } from 'react-native'
import { useThemedColors } from '@/hooks/useTheme'

const TravelDetailsLazy = React.lazy(() => import('@/components/travel/details/TravelDetailsContainer'))

export default function TravelDetailsScreen() {
  const colors = useThemedColors()

  if (Platform.OS !== 'web') {
    const TravelDetailsNative = require('@/components/travel/details/TravelDetailsContainer').default
    return <TravelDetailsNative />
  }

  return (
    <Suspense
      fallback={<View style={{ flex: 1, backgroundColor: colors.background }} />}
    >
      <TravelDetailsLazy />
    </Suspense>
  )
}
