import React, { Suspense, useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { MapPageSkeleton } from '@/components/MapPage/MapPageSkeleton'
import { ensureLeafletCss } from '@/utils/ensureLeafletCss'
import { useResponsive } from '@/hooks/useResponsive'

const WEB_SR_ONLY_STYLE = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  borderWidth: 0,
} as const

// Keep the tab route module tiny so it doesn't pull map dependencies into the entry bundle.
const MapScreenImpl = React.lazy(() => import('@/screens/tabs/MapScreen'))

export default function MapScreen() {
  const [hydrated, setHydrated] = useState(Platform.OS !== 'web')
  const { isHydrated: isResponsiveHydrated = true } = useResponsive()
  const canMountContent = hydrated && isResponsiveHydrated
  const title = 'Карта путешествий и маршрутов по Беларуси | MeTravel'

  useEffect(() => {
    if (Platform.OS !== 'web') return
    ensureLeafletCss()
    setHydrated(true)
  }, [])

  if (!canMountContent) {
    return (
      <>
        {Platform.OS === 'web' && <h1 style={WEB_SR_ONLY_STYLE as any}>{title}</h1>}
        <MapPageSkeleton />
      </>
    )
  }

  return (
    <>
      {Platform.OS === 'web' && <h1 style={WEB_SR_ONLY_STYLE as any}>{title}</h1>}
      <Suspense fallback={<MapPageSkeleton />}>
        <MapScreenImpl />
      </Suspense>
    </>
  )
}
