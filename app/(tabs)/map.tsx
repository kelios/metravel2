import React, { Suspense, useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { MapPageSkeleton } from '@/components/MapPage/MapPageSkeleton'
import { ensureLeafletCss } from '@/utils/ensureLeafletCss'

// Keep the tab route module tiny so it doesn't pull map dependencies into the entry bundle.
const MapScreenImpl = React.lazy(() => import('@/screens/tabs/MapScreen'))

export default function MapScreen() {
  const [hydrated, setHydrated] = useState(Platform.OS !== 'web')

  useEffect(() => {
    if (Platform.OS !== 'web') return
    ensureLeafletCss()
    setHydrated(true)
  }, [])

  if (!hydrated) {
    return <MapPageSkeleton />
  }

  return (
    <Suspense fallback={<MapPageSkeleton />}>
      <MapScreenImpl />
    </Suspense>
  )
}
