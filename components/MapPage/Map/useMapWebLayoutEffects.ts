import { useEffect, useState } from 'react'
import { Platform, type View } from 'react-native'

const MAP_LAYOUT_INVALIDATE_EVENT = 'metravel:map-layout-invalidate'

type UseMapWebLayoutEffectsArgs = {
  wrapperRef: React.MutableRefObject<View | null>
  mapRef: React.MutableRefObject<any>
  mapInstance: any
  setMapInstance: (map: any) => void
  mode: string
  mapContainerId: string
  leafletBaseLayerRef: React.MutableRefObject<any>
  canRenderMap: boolean
  setShowInitialLoader: (value: boolean) => void
}

export function useMapWebLayoutEffects({
  wrapperRef,
  mapRef,
  mapInstance,
  setMapInstance,
  mode,
  mapContainerId,
  leafletBaseLayerRef,
  canRenderMap,
  setShowInitialLoader,
}: UseMapWebLayoutEffectsArgs) {
  const [mapPaneWidth, setMapPaneWidth] = useState(0)

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return

    const wrapperEl = wrapperRef.current as unknown as HTMLElement | null
    if (!(wrapperEl instanceof HTMLElement)) return

    const updateWidth = () => {
      setMapPaneWidth(wrapperEl.clientWidth || 0)
    }

    updateWidth()

    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateWidth()
      })
      resizeObserver.observe(wrapperEl)
    }

    window.addEventListener('resize', updateWidth)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', updateWidth)
    }
  }, [wrapperRef])

  useEffect(() => {
    if (!mapRef.current) return
    if (mapInstance && mapInstance === mapRef.current) return
    setMapInstance(mapRef.current)
  }, [mapInstance, mapRef, setMapInstance])

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (!mapRef.current) return

    const map = mapRef.current
    const raf = requestAnimationFrame(() => {
      try {
        map.invalidateSize?.()
      } catch {
        // noop
      }

      try {
        const baseLayer = leafletBaseLayerRef.current
        if (baseLayer && !map.hasLayer?.(baseLayer)) {
          baseLayer.addTo?.(map)
        }
      } catch {
        // noop
      }
    })

    return () => {
      cancelAnimationFrame(raf)
    }
  }, [leafletBaseLayerRef, mode, mapRef])

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    if (!mapRef.current) return

    const map = mapRef.current

    const safeInvalidate = () => {
      try {
        map.invalidateSize?.({ animate: false } as any)
      } catch {
        // noop
      }
    }

    let rafId: number | null = null
    const scheduleInvalidate = () => {
      if (rafId != null) {
        cancelAnimationFrame(rafId)
      }
      rafId = requestAnimationFrame(() => safeInvalidate())
    }

    const t1 = setTimeout(scheduleInvalidate, 50)
    const t2 = setTimeout(scheduleInvalidate, 250)
    const t3 = setTimeout(scheduleInvalidate, 1000)

    const element = document.getElementById(mapContainerId)
    let resizeObserver: ResizeObserver | null = null

    const canUseWindow = typeof window.addEventListener === 'function'
    const onWindowResize = () => scheduleInvalidate()
    const onMapLayoutInvalidate = () => scheduleInvalidate()

    if (canUseWindow) {
      try {
        window.addEventListener(MAP_LAYOUT_INVALIDATE_EVENT, onMapLayoutInvalidate as EventListener)
      } catch {
        // noop
      }
    }

    if (element && typeof (window as any).ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => scheduleInvalidate())
      try {
        resizeObserver.observe(element)
        if (element.parentElement) resizeObserver.observe(element.parentElement)
      } catch {
        // noop
      }
    } else if (canUseWindow) {
      try {
        window.addEventListener('resize', onWindowResize, { passive: true } as any)
      } catch {
        // noop
      }
    }

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      try {
        resizeObserver?.disconnect()
      } catch {
        // noop
      }
      if (canUseWindow) {
        try {
          window.removeEventListener('resize', onWindowResize as any)
          window.removeEventListener(MAP_LAYOUT_INVALIDATE_EVENT, onMapLayoutInvalidate as EventListener)
        } catch {
          // noop
        }
      }
      if (rafId != null) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [mapContainerId, mapInstance, mapRef])

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    if (!mapRef.current) return
    if (typeof IntersectionObserver === 'undefined') return

    const map = mapRef.current
    const element = document.getElementById(mapContainerId)
    if (!element) return

    let wasHidden = false

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && wasHidden) {
            requestAnimationFrame(() => {
              try {
                map.invalidateSize?.({ animate: false } as any)
              } catch {
                // noop
              }
              try {
                const markerPane = map.getPane?.('markerPane') as HTMLElement | undefined
                if (markerPane) {
                  markerPane.style.willChange = 'transform'
                  requestAnimationFrame(() => {
                    try {
                      markerPane.style.willChange = ''
                    } catch {
                      // noop
                    }
                  })
                }
              } catch {
                // noop
              }
            })
          }
          wasHidden = !entry.isIntersecting
        }
      },
      { threshold: 0.01 }
    )

    observer.observe(element)

    return () => {
      try {
        observer.disconnect()
      } catch {
        // noop
      }
    }
  }, [mapContainerId, mapInstance, mapRef])

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') return

    const invalidate = () => {
      const map = mapRef.current
      if (!map) return
      requestAnimationFrame(() => {
        try {
          map.invalidateSize?.({ animate: false } as any)
        } catch {
          // noop
        }
      })
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') invalidate()
    }

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) invalidate()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pageshow', onPageShow)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [mapRef])

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') return
    if (!mapRef.current) return

    const map = mapRef.current
    const element = document.getElementById(mapContainerId)
    if (!element) return

    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const hasZeroSizedMap = () => {
      try {
        const size = typeof map.getSize === 'function' ? map.getSize() : null
        if (!size || !Number.isFinite(size.x) || !Number.isFinite(size.y) || size.x <= 0 || size.y <= 0) {
          return true
        }
      } catch {
        return true
      }

      const tilePane = element.querySelector('.leaflet-tile-pane') as HTMLElement | null
      const markerPane = element.querySelector('.leaflet-marker-pane') as HTMLElement | null
      const tileRect = tilePane?.getBoundingClientRect?.()
      const markerRect = markerPane?.getBoundingClientRect?.()

      const tileZero = tileRect ? tileRect.width <= 0 || tileRect.height <= 0 : false
      const markerZero = markerRect ? markerRect.width <= 0 || markerRect.height <= 0 : false

      return tileZero || markerZero
    }

    const attemptInvalidate = (attempt: number) => {
      if (cancelled) return

      try {
        map.invalidateSize?.({ animate: false, pan: false } as any)
      } catch {
        // noop
      }

      if (!hasZeroSizedMap()) return
      if (attempt >= 14) return

      timeoutId = setTimeout(() => {
        requestAnimationFrame(() => attemptInvalidate(attempt + 1))
      }, attempt < 4 ? 90 : 180)
    }

    if (hasZeroSizedMap()) {
      requestAnimationFrame(() => attemptInvalidate(0))
    }

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [mapContainerId, mapInstance, mapRef])

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (!canRenderMap) return
    setShowInitialLoader(false)
  }, [canRenderMap, setShowInitialLoader])

  return { mapPaneWidth }
}
