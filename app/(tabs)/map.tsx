import React, { Suspense, useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { MapPageSkeleton } from '@/components/MapPage/MapPageSkeleton'

// Keep the tab route module tiny so it doesn't pull map dependencies into the entry bundle.
const MapScreenImpl = React.lazy(() => import('@/src/screens/tabs/MapScreen'))

export default function MapScreen() {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (Platform.OS !== 'web') return
    setHydrated(true)
  }, [])

  if (Platform.OS === 'web' && !hydrated) {
    return null
  }

  return (
    <Suspense fallback={<MapPageSkeleton />}>
      <MapScreenImpl />
    </Suspense>
  )
}
