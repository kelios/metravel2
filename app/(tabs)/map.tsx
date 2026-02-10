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
    // Defer hydration to let main thread finish parsing before heavy render
    if ('requestIdleCallback' in window) {
      const id = (window as any).requestIdleCallback(() => setHydrated(true), { timeout: 800 })
      return () => (window as any).cancelIdleCallback(id)
    }
    const t = setTimeout(() => setHydrated(true), 50)
    return () => clearTimeout(t)
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
