import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, InteractionManager, Platform } from 'react-native'

import { useTdTrace } from '@/hooks/useTdTrace'

type IdleCapableWindow = Window & {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions,
  ) => number
  cancelIdleCallback?: (handle: number) => void
}

function runWhenBrowserIdle(callback: () => void, fallbackMs = 250): () => void {
  if (typeof window === 'undefined') {
    callback()
    return () => {}
  }

  const idleWindow = window as IdleCapableWindow
  let cancelled = false
  let timeoutId: ReturnType<typeof setTimeout> | null = setTimeout(() => {
    if (!cancelled) callback()
  }, fallbackMs)
  let idleId: number | null = null

  if (typeof idleWindow.requestIdleCallback === 'function') {
    idleId = idleWindow.requestIdleCallback(
      () => {
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
        if (!cancelled) callback()
      },
      { timeout: fallbackMs },
    )
  }

  return () => {
    cancelled = true
    if (timeoutId) clearTimeout(timeoutId)
    if (idleId !== null && typeof idleWindow.cancelIdleCallback === 'function') {
      try {
        idleWindow.cancelIdleCallback(idleId)
      } catch {
        // noop
      }
    }
  }
}

const TRAVEL_DEFERRED_SECTION_KEYS = [
  'map',
  'sidebar',
  'comments',
  'footer',
  'author',
  'rating',
] as const

type TravelDeferredSectionKey = (typeof TRAVEL_DEFERRED_SECTION_KEYS)[number]
type TravelDeferredLoadState = Record<TravelDeferredSectionKey, boolean>
type TravelDeferredElementState = Record<TravelDeferredSectionKey, Element | null>

const createLoadState = (value: boolean): TravelDeferredLoadState => ({
  author: value,
  comments: value,
  footer: value,
  map: value,
  rating: value,
  sidebar: value,
})

const createElementState = (): TravelDeferredElementState => ({
  author: null,
  comments: null,
  footer: null,
  map: null,
  rating: null,
  sidebar: null,
})

const readElement = (node: unknown): Element | null => {
  if (node && typeof node === 'object' && 'nodeType' in (node as Record<string, unknown>)) {
    return node as Element
  }
  return null
}

export const TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS = {
  author: {
    fallbackDelay: 500,
    priority: 'high' as const,
    rootMargin: '200px',
    threshold: 0.1,
    traceKey: 'deferred:author:visible',
  },
  comments: {
    fallbackDelay: null,
    priority: 'low' as const,
    rootMargin: '200px',
    threshold: 0.1,
    traceKey: 'deferred:comments:visible',
  },
  footer: {
    fallbackDelay: null,
    priority: 'low' as const,
    rootMargin: '200px',
    threshold: 0.1,
    traceKey: 'deferred:footer:visible',
  },
  map: {
    fallbackDelay: null,
    priority: 'low' as const,
    rootMargin: '200px',
    threshold: 0.1,
    traceKey: 'deferred:map:visible',
  },
  rating: {
    fallbackDelay: 600,
    priority: 'high' as const,
    rootMargin: '200px',
    threshold: 0.1,
    traceKey: 'deferred:rating:visible',
  },
  sidebar: {
    fallbackDelay: null,
    priority: 'low' as const,
    rootMargin: '200px',
    threshold: 0.1,
    traceKey: 'deferred:sidebar:visible',
  },
} as const

// Native-only staging knobs. On web, loading is driven by browser idle +
// IntersectionObserver (untouched below). On native there is no IntersectionObserver
// over the ScrollView, so heavy sections are revealed by scroll depth instead.

// Cheap below-fold sections: enabled shortly after interactions, no scroll needed.
const NATIVE_EAGER_SECTIONS: TravelDeferredSectionKey[] = ['author', 'rating']

// Heavy sections (Leaflet WebView map, Near/Popular API lists + cards, comments,
// footer) stay unmounted until the user scrolls toward them, revealed in document
// order so the first frame paints only the hero + description.
const NATIVE_SCROLL_GATED_SECTIONS: TravelDeferredSectionKey[] = [
  'map',
  'sidebar',
  'comments',
  'footer',
]

// Reveal the first heavy section once the user scrolls a little; each subsequent
// section unlocks after roughly another viewport of scrolling (lookahead so a
// section is mounted before it reaches the fold).
const NATIVE_SCROLL_GATE_INITIAL = 240
const NATIVE_SCROLL_GATE_STEP_MIN = 480

type UseTravelDeferredSectionsModelArgs = {
  travelId?: number
  scrollY?: Animated.Value
  settledScrollOffsetY?: number
  viewportHeight?: number
}

export function useTravelDeferredSectionsModel({
  travelId,
  scrollY,
  settledScrollOffsetY,
  viewportHeight = 0,
}: UseTravelDeferredSectionsModelArgs) {
  // On web the heavy travel tree (incl. the Leaflet map) must not mount in the same
  // synchronous commit as an SPA navigation, or the main thread freezes and the skeleton
  // overlay stays up (white screen). Start `false` on web and flip to `true` on browser idle,
  // and reset to `false` during render whenever travelId changes so a cached SPA swap behaves
  // like a fresh mount. Native flips `true` after interactions (below) but no longer mounts
  // every section eagerly — heavy sections are scroll-gated.
  const [canRenderHeavy, setCanRenderHeavy] = useState(Platform.OS !== 'web')
  const [prevTravelId, setPrevTravelId] = useState(travelId)
  if (travelId !== prevTravelId) {
    setPrevTravelId(travelId)
    if (Platform.OS === 'web') setCanRenderHeavy(false)
  }
  const tdTrace = useTdTrace()
  // Native no longer mounts every heavy section on the first frame: start all
  // sections unloaded and reveal them in stages (see native effects below) so the
  // hero + description paint first and the Leaflet WebView map / related lists do
  // not block the initial commit.
  const [loadedSections, setLoadedSections] = useState<TravelDeferredLoadState>(() =>
    createLoadState(false),
  )
  const [sectionElements, setSectionElements] = useState<TravelDeferredElementState>(() =>
    createElementState(),
  )
  const tracedSectionsRef = useRef<Set<TravelDeferredSectionKey>>(new Set())

  const markSectionLoaded = useCallback((sectionKey: TravelDeferredSectionKey) => {
    setLoadedSections((current) => {
      if (current[sectionKey]) return current
      return { ...current, [sectionKey]: true }
    })
  }, [])

  const setSectionRef = useCallback((sectionKey: TravelDeferredSectionKey, node: unknown) => {
    const nextElement = readElement(node)
    setSectionElements((current) => {
      if (current[sectionKey] === nextElement) return current
      return { ...current, [sectionKey]: nextElement }
    })
  }, [])

  const setMapRef = useCallback((node: unknown) => setSectionRef('map', node), [setSectionRef])
  const setSidebarRef = useCallback((node: unknown) => setSectionRef('sidebar', node), [setSectionRef])
  const setCommentsRef = useCallback((node: unknown) => setSectionRef('comments', node), [setSectionRef])
  const setFooterRef = useCallback((node: unknown) => setSectionRef('footer', node), [setSectionRef])
  const setAuthorSectionRef = useCallback((node: unknown) => setSectionRef('author', node), [setSectionRef])
  const setRatingRef = useCallback((node: unknown) => setSectionRef('rating', node), [setSectionRef])

  useEffect(() => {
    tdTrace('deferred:mount', { travelId })
    return () => tdTrace('deferred:unmount', { travelId })
  }, [tdTrace, travelId])

  useEffect(() => {
    if (Platform.OS === 'web') return
    const task = InteractionManager.runAfterInteractions(() => setCanRenderHeavy(true))
    return () => task.cancel()
  }, [])

  useEffect(() => {
    if (Platform.OS !== 'web') {
      // Native: reset to fully unloaded so a reused hook instance (SPA-style travel
      // swap) behaves like a fresh mount and re-stages from scratch.
      tracedSectionsRef.current.clear()
      setLoadedSections(createLoadState(false))
      return
    }
    if (!canRenderHeavy) {
      tracedSectionsRef.current.clear()
      setLoadedSections(createLoadState(false))
    }
  }, [canRenderHeavy, travelId])

  // Native stage 1: once interactions settle, reveal the cheap below-fold sections
  // (author, rating) without requiring a scroll.
  useEffect(() => {
    if (Platform.OS === 'web') return
    if (!canRenderHeavy) return
    NATIVE_EAGER_SECTIONS.forEach((sectionKey) => markSectionLoaded(sectionKey))
  }, [canRenderHeavy, markSectionLoaded])

  // Native stage 2: mount heavy scroll-gated sections (map WebView, related lists,
  // comments, footer) progressively as scroll depth increases. Without a scroll
  // source, fall back to loading them so content is never stranded.
  useEffect(() => {
    if (Platform.OS === 'web') return
    if (!canRenderHeavy) return
    const step = Math.max(NATIVE_SCROLL_GATE_STEP_MIN, viewportHeight * 0.75)
    const evaluate = (offsetY: number) => {
      NATIVE_SCROLL_GATED_SECTIONS.forEach((sectionKey, index) => {
        const threshold = NATIVE_SCROLL_GATE_INITIAL + index * step
        if (offsetY >= threshold) markSectionLoaded(sectionKey)
      })
    }

    if (Number.isFinite(settledScrollOffsetY)) {
      evaluate(settledScrollOffsetY as number)
      return
    }
    if (!scrollY) {
      NATIVE_SCROLL_GATED_SECTIONS.forEach((sectionKey) => markSectionLoaded(sectionKey))
      return
    }

    evaluate((scrollY as unknown as { __getValue?: () => number }).__getValue?.() ?? 0)
    const id = scrollY.addListener(({ value }) => evaluate(value))
    return () => scrollY.removeListener(id)
  }, [canRenderHeavy, markSectionLoaded, scrollY, settledScrollOffsetY, viewportHeight])

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (canRenderHeavy) return
    const cleanup = runWhenBrowserIdle(() => setCanRenderHeavy(true), 250)
    return cleanup
  }, [canRenderHeavy, travelId])

  useEffect(() => {
    if (canRenderHeavy) tdTrace('deferred:heavy:enabled')
  }, [canRenderHeavy, tdTrace])

  const shouldFallbackAuthor = !loadedSections.author
  const shouldFallbackRating = !loadedSections.rating

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (!canRenderHeavy) return

    const timers: Array<ReturnType<typeof setTimeout>> = []
    if (shouldFallbackAuthor) {
      timers.push(
        setTimeout(
          () => markSectionLoaded('author'),
          TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS.author.fallbackDelay,
        ),
      )
    }
    if (shouldFallbackRating) {
      timers.push(
        setTimeout(
          () => markSectionLoaded('rating'),
          TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS.rating.fallbackDelay,
        ),
      )
    }

    return () => {
      timers.forEach(clearTimeout)
    }
  }, [
    canRenderHeavy,
    markSectionLoaded,
    shouldFallbackAuthor,
    shouldFallbackRating,
  ])

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (!canRenderHeavy) return
    if (typeof window === 'undefined' || typeof window.IntersectionObserver !== 'function') return

    const entries = TRAVEL_DEFERRED_SECTION_KEYS
      .map((sectionKey) => ({
        element: sectionElements[sectionKey],
        sectionKey,
      }))
      .filter((entry): entry is { element: Element; sectionKey: TravelDeferredSectionKey } => !!entry.element)

    if (!entries.length) return

    const sectionByElement = new Map<Element, TravelDeferredSectionKey>()
    const observer = new window.IntersectionObserver(
      (observerEntries) => {
        for (const entry of observerEntries) {
          if (!entry.isIntersecting && entry.intersectionRatio <= 0) continue
          const sectionKey = sectionByElement.get(entry.target)
          if (!sectionKey) continue
          markSectionLoaded(sectionKey)
          observer.unobserve(entry.target)
        }
      },
      {
        root: null,
        rootMargin: '200px',
        threshold: 0.1,
      },
    )

    for (const { element, sectionKey } of entries) {
      sectionByElement.set(element, sectionKey)
      observer.observe(element)
    }

    return () => observer.disconnect()
  }, [canRenderHeavy, markSectionLoaded, sectionElements])

  useEffect(() => {
    for (const sectionKey of TRAVEL_DEFERRED_SECTION_KEYS) {
      if (!loadedSections[sectionKey]) continue
      if (tracedSectionsRef.current.has(sectionKey)) continue
      tracedSectionsRef.current.add(sectionKey)
      tdTrace(TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS[sectionKey].traceKey)
    }
  }, [loadedSections, tdTrace])

  return {
    canRenderHeavy,
    setAuthorSectionRef,
    setCommentsRef,
    setFooterRef,
    setMapRef,
    setRatingRef,
    setSidebarRef,
    shouldLoadAuthorSection: loadedSections.author,
    shouldLoadComments: loadedSections.comments,
    shouldLoadFooter: loadedSections.footer,
    shouldLoadMap: loadedSections.map,
    shouldLoadRating: loadedSections.rating,
    shouldLoadSidebar: loadedSections.sidebar,
  }
}
