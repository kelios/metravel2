import { useCallback, useEffect, useState } from 'react'
import { DeviceEventEmitter, Platform } from 'react-native'
import type { RefObject, TransitionStartFunction } from 'react'

import { useActiveSection } from '@/hooks/useActiveSection'
import { useScrollNavigation } from '@/hooks/useScrollNavigation'
import type { AnchorsMap } from '@/components/travel/details/TravelDetailsTypes'

export interface UseTravelDetailsNavigationArgs {
  headerOffset: number
  slug: string
  startTransition: TransitionStartFunction
}

export interface UseTravelDetailsNavigationReturn {
  anchors: AnchorsMap
  scrollTo: (key: string) => void
  scrollRef: RefObject<any>
  activeSection: string
  setActiveSection: (section: string) => void
  forceOpenKey: string | null
}

export function useTravelDetailsNavigation({
  headerOffset,
  slug,
  startTransition,
}: UseTravelDetailsNavigationArgs): UseTravelDetailsNavigationReturn {
  const { anchors: rawAnchors, scrollTo, scrollRef } = useScrollNavigation()
  const anchors = rawAnchors as AnchorsMap

  const [scrollRootEl, setScrollRootEl] = useState<HTMLElement | null>(null)
  const { activeSection, setActiveSection } = useActiveSection(anchors, headerOffset, scrollRootEl)
  const [forceOpenKey, setForceOpenKey] = useState<string | null>(null)

  useEffect(() => {
    if (Platform.OS !== 'web') return

    let cancelled = false
    let attempts = 0
    let rafId: number | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const isDocumentScrollEl = (node: any): boolean => {
      try {
        if (typeof document === 'undefined') return true
        const docAny = document as any
        const scrollingEl = (document.scrollingElement || docAny.documentElement || docAny.body) as any
        return node === window || node === document || node === docAny.body || node === docAny.documentElement || node === scrollingEl
      } catch {
        return true
      }
    }

    const isScrollableEl = (node: HTMLElement): boolean => {
      try {
        if (typeof window === 'undefined') return false
        if (!node || isDocumentScrollEl(node)) return false
        const style = window.getComputedStyle(node)
        const overflowY = (style?.overflowY || '').toLowerCase()
        const canScrollByStyle = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay'
        const canScrollBySize = (node.scrollHeight || 0) > (node.clientHeight || 0) + 1
        return Boolean(canScrollByStyle && canScrollBySize)
      } catch {
        return false
      }
    }

    const findScrollableContainer = (start: HTMLElement): HTMLElement | null => {
      let cur: HTMLElement | null = start
      let hops = 0
      while (cur && hops < 10) {
        if (isScrollableEl(cur)) return cur
        cur = cur.parentElement
        hops += 1
      }
      return null
    }

    const readNode = (): HTMLElement | null => {
      const scrollViewAny = scrollRef.current as any
      const node: HTMLElement | null =
        (typeof scrollViewAny?.getScrollableNode === 'function' && scrollViewAny.getScrollableNode()) ||
        scrollViewAny?._scrollNode ||
        scrollViewAny?._innerViewNode ||
        scrollViewAny?._nativeNode ||
        scrollViewAny?._domNode ||
        null

      if (node && typeof node === 'object' && typeof (node as any).getBoundingClientRect === 'function') {
        return node
      }

      if (typeof document !== 'undefined') {
        try {
          const byTestId = document.querySelector('[data-testid="travel-details-scroll"]') as any
          if (byTestId && typeof byTestId.getBoundingClientRect === 'function') {
            return byTestId as HTMLElement
          }
        } catch {
          // noop
        }
      }

      return null
    }

    const tick = () => {
      if (cancelled) return
      attempts += 1

      const node = readNode()
      if (node) {
        const next = findScrollableContainer(node) || null
        setScrollRootEl((prev) => (prev === next ? prev : next))
        if (next) return
      }

      if (attempts >= 60) return

      // If we can't find a dedicated scroll container yet, fall back to document scroll for now.
      setScrollRootEl((prev) => (prev === null ? prev : null))

      const raf =
        (typeof window !== 'undefined' && window.requestAnimationFrame) ||
        (typeof globalThis !== 'undefined' && (globalThis as any).requestAnimationFrame)

      if (typeof raf === 'function') {
        rafId = raf(() => tick()) as any
      } else {
        timeoutId = setTimeout(() => tick(), 16)
      }
    }

    tick()

    return () => {
      cancelled = true
      if (rafId != null && typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
        try {
          window.cancelAnimationFrame(rafId)
        } catch {
          // noop
        }
      }
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [scrollRef, slug])

  const handleSectionOpen = useCallback(
    (key: string) => {
      try {
        const dbg = Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).__NAV_DEBUG__
        if (dbg) {
          // eslint-disable-next-line no-console
          console.debug('[nav] open-section received', { key })
        }
      } catch {
        // noop
      }
      startTransition(() => setForceOpenKey(key))
    },
    [startTransition]
  )

  useEffect(() => {
    if (!forceOpenKey) return

    try {
      const dbg = Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).__NAV_DEBUG__
      if (dbg) {
        // eslint-disable-next-line no-console
        console.debug('[nav] forceOpenKey effect', { forceOpenKey })
      }
    } catch {
      // noop
    }

    // When sections mount lazily, the first scrollTo can miss.
    // Retry with small intervals until DOM/layout is ready.
    const timeouts: Array<ReturnType<typeof setTimeout>> = []
    const MAX_ATTEMPTS = 10
    const INTERVAL_MS = 120

    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      timeouts.push(
        setTimeout(() => {
          scrollTo(forceOpenKey)
        }, i * INTERVAL_MS)
      )
    }

    return () => {
      timeouts.forEach((t) => clearTimeout(t))
    }
  }, [forceOpenKey, scrollTo])

  useEffect(() => {
    const handler =
      Platform.OS === 'web'
        ? (e: any) => handleSectionOpen(e?.detail?.key ?? '')
        : (key: string) => handleSectionOpen(key)

    if (Platform.OS === 'web') {
      window.addEventListener('open-section', handler as unknown as EventListener, { passive: true } as any)
      return () => window.removeEventListener('open-section', handler as unknown as EventListener)
    }
    const sub = DeviceEventEmitter.addListener('open-section', handler)
    return () => sub.remove()
  }, [handleSectionOpen])

  // Assign data-section-key attributes for Intersection Observer wiring.
  useEffect(() => {
    if (Platform.OS !== 'web') return

    const setupSectionAttributes = () => {
      Object.keys(anchors).forEach((key) => {
        const ref = anchors[key as keyof typeof anchors]
        if (ref?.current && Platform.OS === 'web') {
          setTimeout(() => {
            try {
              const domNode = ref.current?._nativeNode || ref.current?._domNode || ref.current
              if (domNode && domNode.setAttribute) {
                domNode.setAttribute('data-section-key', key)
              } else if (domNode && typeof domNode === 'object' && 'ownerDocument' in domNode) {
                ;(domNode as HTMLElement).setAttribute('data-section-key', key)
              }
            } catch {
              // ignore
            }
          }, 100)
        }
      })
    }

    setupSectionAttributes()
  }, [anchors, headerOffset, activeSection])

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false })
    // Default active section is gallery for initial render.
    setActiveSection('gallery')
  }, [slug, setActiveSection, scrollRef])

  return {
    anchors,
    scrollTo,
    scrollRef,
    activeSection,
    setActiveSection,
    forceOpenKey,
  }
}
