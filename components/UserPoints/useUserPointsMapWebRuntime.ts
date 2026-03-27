import React from 'react'
import { Platform } from 'react-native'

import { ensureLeafletCss } from '@/utils/ensureLeafletCss'

type UserPointsMapWebMods = {
  L: any
  MapContainer: any
  Marker: any
  Popup: any
  Polyline: any
  useMap: any
  useMapEvents: any
}

export function useUserPointsMapWebRuntime() {
  const [viewportWidth, setViewportWidth] = React.useState<number>(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') return window.innerWidth
    return 1280
  })

  const [mods, setMods] = React.useState<UserPointsMapWebMods | null>(null)

  React.useEffect(() => {
    if (Platform.OS !== 'web') return
    let cancelled = false
    ;(async () => {
      try {
        ensureLeafletCss()
        const { loadLeafletRuntime } = await import('@/utils/loadLeafletRuntime')
        const { L, RL } = await loadLeafletRuntime()
        if (cancelled) return
        setMods({
          L,
          MapContainer: RL.MapContainer,
          Marker: RL.Marker,
          Popup: RL.Popup,
          Polyline: RL.Polyline,
          useMap: RL.useMap,
          useMapEvents: RL.useMapEvents,
        })
      } catch {
        if (!cancelled) setMods(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return
    const onResize = () => setViewportWidth(window.innerWidth)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return {
    mods,
    viewportWidth,
    isCompactPopup: viewportWidth <= 900,
    isNarrowPopup: viewportWidth <= 390,
    isTinyPopup: viewportWidth <= 360,
  }
}
