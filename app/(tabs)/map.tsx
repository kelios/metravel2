import React, { Suspense, useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { MapPageSkeleton } from '@/components/MapPage/MapPageSkeleton'
import { ensureLeafletCss } from '@/src/utils/ensureLeafletCss'

// Keep the tab route module tiny so it doesn't pull map dependencies into the entry bundle.
const MapScreenImpl = React.lazy(() => import('@/src/screens/tabs/MapScreen'))

export default function MapScreen() {
  const [hydrated, setHydrated] = useState(false)
  const [shouldLoadMap, setShouldLoadMap] = useState(false)

  useEffect(() => {
    if (Platform.OS !== 'web') return

    ensureLeafletCss()

    setHydrated(true)

    const load = () => setShouldLoadMap(true)
    try {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        ;(window as any).requestIdleCallback(load, { timeout: 3000 })
      } else {
        setTimeout(load, 1500)
      }
    } catch {
      setTimeout(load, 1500)
    }
  }, [])

  if (Platform.OS === 'web' && (!hydrated || !shouldLoadMap)) {
    return <MapPageSkeleton />
  }

  return (
    <Suspense fallback={<MapPageSkeleton />}>
      <MapScreenImpl />
    </Suspense>
  )
}
