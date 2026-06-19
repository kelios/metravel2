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
  }, [leafletBaseLayerRef, mode, mapRef, mapInstance])

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

    // A single deferred pass after layout settles replaces the previous
    // 50/250/1000ms cascade. scheduleInvalidate already coalesces onto one rAF,
    // so any resize/observer event during this window collapses into one call.
    const t1 = setTimeout(scheduleInvalidate, 250)

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

    // Prefer ResizeObserver (already rAF-coalesced via scheduleInvalidate) and
    // avoid attaching a duplicate window 'resize' listener that would invalidate
    // the same map twice per resize.
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

  // In-app browsers (Threads/Instagram WebView on iOS) collapse/expand a native
  // toolbar that changes the visual viewport WITHOUT firing window 'resize' or
  // resizing the map DOM element (height is dvh-pinned and lags). Leaflet then
  // keeps tiles sized to the stale viewport => grey gaps. visualViewport is the
  // only reliable signal here, so re-run invalidateSize on its resize/scroll.
  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (typeof window === 'undefined') return
    const vv = window.visualViewport
    if (!vv || !mapRef.current) return

    const map = mapRef.current
    let rafId: number | null = null
    const onViewportChange = () => {
      if (rafId != null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        try {
          map.invalidateSize?.({ animate: false } as any)
        } catch {
          // noop
        }
      })
    }

    try {
      vv.addEventListener('resize', onViewportChange)
      vv.addEventListener('scroll', onViewportChange)
    } catch {
      // noop
    }

    return () => {
      try {
        vv.removeEventListener('resize', onViewportChange)
        vv.removeEventListener('scroll', onViewportChange)
      } catch {
        // noop
      }
      if (rafId != null) cancelAnimationFrame(rafId)
    }
  }, [mapRef, mapInstance])

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
    let resizeObserver: ResizeObserver | null = null

    // Cheap, layout-read-free check: Leaflet's own cached size. Avoids forced
    // synchronous layout (getBoundingClientRect) on the hot retry path.
    const hasZeroSizedMap = () => {
      try {
        const size = typeof map.getSize === 'function' ? map.getSize() : null
        if (!size || !Number.isFinite(size.x) || !Number.isFinite(size.y) || size.x <= 0 || size.y <= 0) {
          return true
        }
      } catch {
        return true
      }
      return false
    }

    const invalidate = () => {
      try {
        map.invalidateSize?.({ animate: false, pan: false } as any)
      } catch {
        // noop
      }
    }

    const stop = () => {
      cancelled = true
      try {
        resizeObserver?.disconnect()
      } catch {
        // noop
      }
      resizeObserver = null
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }

    // Bounded fallback for environments without ResizeObserver, or if the
    // container is still collapsed after observation. Far fewer attempts than
    // the previous 14-step busy loop and no per-attempt layout reads.
    const attemptInvalidate = (attempt: number) => {
      if (cancelled) return
      invalidate()
      if (!hasZeroSizedMap()) {
        stop()
        return
      }
      if (attempt >= 5) return
      timeoutId = setTimeout(() => {
        requestAnimationFrame(() => attemptInvalidate(attempt + 1))
      }, 120)
    }

    if (hasZeroSizedMap()) {
      // Prefer reacting to the container actually gaining a size instead of
      // polling: a single invalidate when ResizeObserver reports the element.
      if (typeof (window as any).ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          if (cancelled) return
          invalidate()
          if (!hasZeroSizedMap()) stop()
        })
        try {
          resizeObserver.observe(element)
        } catch {
          // noop
        }
      }
      requestAnimationFrame(() => attemptInvalidate(0))
    }

    return () => {
      stop()
    }
  }, [mapContainerId, mapInstance, mapRef])

  // Self-healing for in-app browsers (Threads/Instagram WebView on iOS) where the
  // toolbar settles the layout AFTER Leaflet caches its size, but NO resize /
  // visualViewport / ResizeObserver event fires to trigger re-measure. The
  // zero-size guard above only catches size <= 0; here we catch the "non-zero but
  // STALE" case: Leaflet's cached getSize() smaller than the real container =>
  // tiles render for the small area and the rest stays grey. An event-independent
  // bounded cascade compares cached size to the actual box and forces invalidate
  // on mismatch, so the map heals itself without any user interaction.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') return
    if (!mapRef.current) return

    let cancelled = false
    const timers: Array<ReturnType<typeof setTimeout>> = []

    const healIfStale = () => {
      if (cancelled) return
      const map = mapRef.current
      if (!map) return
      const element = document.getElementById(mapContainerId)
      if (!element) return
      try {
        const cached = typeof map.getSize === 'function' ? map.getSize() : null
        const rect = element.getBoundingClientRect()
        if (!cached || rect.width <= 0 || rect.height <= 0) return
        // >2px mismatch on either axis means Leaflet's panes are sized to a stale
        // viewport. Re-measure so missing tiles load across the full container.
        if (Math.abs(cached.x - rect.width) > 2 || Math.abs(cached.y - rect.height) > 2) {
          map.invalidateSize?.({ animate: false, pan: false } as any)
        }
      } catch {
        // noop
      }
    }

    // Spread across the window in which an in-app browser's chrome settles.
    for (const delay of [150, 400, 900, 1600, 2800]) {
      timers.push(setTimeout(() => requestAnimationFrame(healIfStale), delay))
    }

    return () => {
      cancelled = true
      for (const t of timers) clearTimeout(t)
    }
  }, [mapContainerId, mapInstance, mapRef])

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (!canRenderMap) return
    setShowInitialLoader(false)
  }, [canRenderMap, setShowInitialLoader])

  return { mapPaneWidth }
}
