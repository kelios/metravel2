import { useCallback, useEffect, useMemo, useState } from 'react'
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
  scrollRef: RefObject<unknown>
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

  const isDocumentScrollEl = useCallback((node: unknown): boolean => {
    try {
      if (typeof document === 'undefined') return true
      const scrollingEl = document.scrollingElement || document.documentElement || document.body
      return node === window || node === document || node === document.body || node === document.documentElement || node === scrollingEl
    } catch {
      return true
    }
  }, [])

  const isScrollableEl = useCallback((node: HTMLElement): boolean => {
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
  }, [isDocumentScrollEl])

  const findScrollableContainer = useCallback((start: HTMLElement): HTMLElement | null => {
    let cur: HTMLElement | null = start
    let hops = 0
    while (cur && hops < 10) {
      if (isScrollableEl(cur)) return cur
      cur = cur.parentElement
      hops += 1
    }
    return null
  }, [isScrollableEl])

  const readScrollNode = useCallback((): HTMLElement | null => {
    const scrollViewRef = scrollRef.current as unknown as Record<string, unknown> | null
    const node: HTMLElement | null =
      (typeof scrollViewRef?.getScrollableNode === 'function' && (scrollViewRef.getScrollableNode as () => HTMLElement | null)()) ||
      (scrollViewRef?._scrollNode as HTMLElement | null) ||
      (scrollViewRef?._innerViewNode as HTMLElement | null) ||
      (scrollViewRef?._nativeNode as HTMLElement | null) ||
      (scrollViewRef?._domNode as HTMLElement | null) ||
      null

    if (node && typeof node === 'object' && typeof (node as HTMLElement).getBoundingClientRect === 'function') {
      return node
    }

    if (typeof document !== 'undefined') {
      try {
        const byTestId = document.querySelector<HTMLElement>('[data-testid="travel-details-scroll"]')
        if (byTestId && typeof byTestId.getBoundingClientRect === 'function') {
          return byTestId
        }
      } catch {
        // noop
      }
    }

    return null
  }, [scrollRef])

  const resetWebScrollTop = useCallback(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
      return false
    }

    const safeReset = (node: unknown): boolean => {
      if (!node) return false
      let changed = false

      try {
        if (typeof (node as { scrollTo?: unknown }).scrollTo === 'function') {
          ;(node as { scrollTo: (options: Record<string, unknown>) => void }).scrollTo({ top: 0, left: 0, behavior: 'auto' })
          changed = true
        }
      } catch {
        // noop
      }

      try {
        if (typeof (node as { scrollTo?: unknown }).scrollTo === 'function') {
          ;(node as { scrollTo: (options: Record<string, unknown>) => void }).scrollTo({ x: 0, y: 0, animated: false })
          changed = true
        }
      } catch {
        // noop
      }

      try {
        if (typeof (node as { scrollTop?: unknown }).scrollTop === 'number') {
          ;(node as { scrollTop: number }).scrollTop = 0
          changed = true
        }
      } catch {
        // noop
      }

      return changed
    }

    const scrollNode = readScrollNode()
    const scrollContainer = scrollNode ? findScrollableContainer(scrollNode) || scrollNode : null

    if (scrollContainer) {
      safeReset(scrollContainer)
    }

    const scrollingEl = document.scrollingElement || document.documentElement || document.body
    safeReset(scrollingEl)

    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    } catch {
      try {
        window.scrollTo(0, 0)
      } catch {
        // noop
      }
    }

    return Boolean(scrollContainer)
  }, [findScrollableContainer, readScrollNode])

  useEffect(() => {
    if (Platform.OS !== 'web') return

    let cancelled = false
    let attempts = 0
    let rafId: number | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const tick = () => {
      if (cancelled) return
      attempts += 1

      const node = readScrollNode()
      if (node) {
        const next = findScrollableContainer(node) || null
        if (next) {
          setScrollRootEl((prev) => (prev === next ? prev : next))
          return
        }

        // Fallback: treat the node itself as scroll root if it can scroll by size
        try {
          const canScrollBySize = (node.scrollHeight || 0) > (node.clientHeight || 0) + 1
          if (canScrollBySize) {
            setScrollRootEl((prev) => (prev === node ? prev : node))
            return
          }
        } catch {
          // noop
        }
      }

      if (attempts >= 20) return

      // If we can't find a dedicated scroll container yet, fall back to document scroll for now.
      setScrollRootEl((prev) => (prev === null ? prev : null))

      const raf =
        (typeof window !== 'undefined' && window.requestAnimationFrame) ||
        (typeof globalThis !== 'undefined' && (globalThis as unknown as { requestAnimationFrame?: typeof requestAnimationFrame }).requestAnimationFrame)

      if (typeof raf === 'function') {
        rafId = raf(() => tick())
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
  }, [findScrollableContainer, readScrollNode, scrollRef, slug])

  const handleSectionOpen = useCallback(
    (key: string) => {
      startTransition(() => setForceOpenKey(key))
    },
    [startTransition]
  )

  useEffect(() => {
    if (!forceOpenKey) return

    // When sections mount lazily, the first scrollTo can miss.
    // Retry with small intervals until DOM/layout is ready.
    const timeouts: Array<ReturnType<typeof setTimeout>> = []
    const MAX_ATTEMPTS = 6
    const INTERVAL_MS = 150

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
        ? (e: Event) => handleSectionOpen((e as CustomEvent)?.detail?.key ?? '')
        : (key: string) => handleSectionOpen(key)

    if (Platform.OS === 'web') {
      window.addEventListener('open-section', handler as EventListener, { passive: true })
      return () => window.removeEventListener('open-section', handler as EventListener)
    }
    const sub = DeviceEventEmitter.addListener('open-section', handler)
    return () => sub.remove()
  }, [handleSectionOpen])

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return

    const resolveHashSectionKey = (rawHash: string): string | null => {
      const normalized = String(rawHash || '').replace(/^#/, '').trim().toLowerCase()
      if (!normalized) return null

      const matchedKey = Object.keys(anchors).find((key) => key.toLowerCase() === normalized)
      return matchedKey ?? null
    }

    const openSectionFromHash = () => {
      const nextKey = resolveHashSectionKey(window.location.hash)
      if (!nextKey) return
      handleSectionOpen(nextKey)
    }

    const initialTimer = setTimeout(openSectionFromHash, 0)
    window.addEventListener('hashchange', openSectionFromHash)

    return () => {
      clearTimeout(initialTimer)
      window.removeEventListener('hashchange', openSectionFromHash)
    }
  }, [anchors, handleSectionOpen, slug])

  // Assign data-section-key attributes for Intersection Observer wiring.
  useEffect(() => {
    if (Platform.OS !== 'web') return

    let cancelled = false
    let intervalId: ReturnType<typeof setInterval> | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const sectionKeys = Object.keys(anchors)
    const applied = new Set<string>()

    const applyOnce = (key: string) => {
      if (applied.has(key)) return
      const ref = anchors[key as keyof typeof anchors]
      if (!ref?.current) return

      try {
        const refCurrent = ref.current as unknown as Record<string, unknown> | null
        const domNode = (refCurrent?._nativeNode || refCurrent?._domNode || ref.current) as HTMLElement | null
        if (!domNode || typeof domNode.setAttribute !== 'function') return

        const existing = typeof domNode.getAttribute === 'function' ? domNode.getAttribute('data-section-key') : null
        if (!existing) {
          domNode.setAttribute('data-section-key', key)
        }
        applied.add(key)
      } catch {
        // ignore
      }
    }

    const tick = () => {
      if (cancelled) return
      sectionKeys.forEach((k) => applyOnce(k))

      if (applied.size >= sectionKeys.length) {
        if (intervalId) clearInterval(intervalId)
        intervalId = null
      }
    }

    // First attempt immediately.
    tick()

    // Retry for a while to catch lazy-mounted sections.
    intervalId = setInterval(tick, 500)
    timeoutId = setTimeout(() => {
      if (intervalId) clearInterval(intervalId)
      intervalId = null
    }, 4000)

    return () => {
      cancelled = true
      if (intervalId) clearInterval(intervalId)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [anchors, headerOffset, slug])

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false })
    // Default active section is gallery for initial render.
    setActiveSection('gallery')
    if (Platform.OS === 'web') {
      let cancelled = false
      const timers: Array<ReturnType<typeof setTimeout>> = []
      const attempts = [0, 32, 96, 180, 320]

      attempts.forEach((delay) => {
        timers.push(setTimeout(() => {
          if (cancelled) return
          resetWebScrollTop()
        }, delay))
      })

      return () => {
        cancelled = true
        timers.forEach((timer) => clearTimeout(timer))
      }
    }
  }, [resetWebScrollTop, scrollRef, setActiveSection, slug])

  return useMemo(() => ({
    anchors,
    scrollTo,
    scrollRef,
    activeSection,
    setActiveSection,
    forceOpenKey,
  }), [anchors, scrollTo, scrollRef, activeSection, setActiveSection, forceOpenKey])
}
