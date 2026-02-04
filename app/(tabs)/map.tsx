import React, { Suspense, useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { MapPageSkeleton } from '@/components/MapPage/MapPageSkeleton'

// Keep the tab route module tiny so it doesn't pull map dependencies into the entry bundle.
const MapScreenImpl = React.lazy(() => import('@/src/screens/tabs/MapScreen'))

export default function MapScreen() {
  const [hydrated, setHydrated] = useState(false)
  const [shouldLoadMap, setShouldLoadMap] = useState(false)

  useEffect(() => {
    if (Platform.OS !== 'web') return

    try {
      const id = 'metravel-leaflet-css'
      if (typeof document !== 'undefined' && !document.getElementById(id)) {
        const link = document.createElement('link')
        link.id = id
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        link.setAttribute('data-metravel-leaflet-css', 'cdn')
        document.head.appendChild(link)
      }
    } catch {
      // noop
    }

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
