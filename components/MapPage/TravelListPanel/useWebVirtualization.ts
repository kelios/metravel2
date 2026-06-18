import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { findNodeHandle } from 'react-native'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'

import {
  computeVirtualWindowVariable,
  IS_WEB,
  LOAD_MORE_THRESHOLD_RATIO,
  WEB_DEFAULT_VIEWPORT_HEIGHT,
  WEB_ESTIMATED_ITEM_HEIGHT_PX,
  WEB_LIST_OVERSCAN_ITEMS,
} from './helpers'

type UseWebVirtualizationArgs = {
  itemKeys: string[]
  hasMore: boolean
  onLoadMore?: () => void
}

// Resolve the actual scrollable DOM node behind an RN Web ScrollView ref. The
// ref's current may be the RN component instance, the host node, or a wrapper —
// we normalise to an HTMLElement so we can read clientHeight/scrollTop and
// observe size changes.
function isHTMLElement(value: unknown): value is HTMLElement {
  return typeof HTMLElement !== 'undefined' && value != null && value instanceof HTMLElement
}

function resolveScrollNode(ref: unknown): HTMLElement | null {
  if (!IS_WEB || typeof document === 'undefined') return null
  const candidate = ref as any
  if (!candidate) return null
  if (isHTMLElement(candidate)) return candidate
  const node = candidate?.getScrollableNode?.() ?? candidate?.getNode?.() ?? candidate
  if (isHTMLElement(node)) return node
  const handle = findNodeHandle(candidate as never)
  return isHTMLElement(handle) ? handle : null
}

export function useWebVirtualization({ itemKeys, hasMore, onLoadMore }: UseWebVirtualizationArgs) {
  const webScrollRafRef = useRef<number | null>(null)
  const [webScrollY, setWebScrollY] = useState(0)
  const [webViewportH, setWebViewportH] = useState(0)
  const itemHeightsRef = useRef<Map<string, number>>(new Map())
  const [heightsVersion, setHeightsVersion] = useState(0)
  const scrollRef = useRef<unknown>(null)

  const recordItemHeight = useCallback((key: string, h: number) => {
    if (!h) return
    const prev = itemHeightsRef.current.get(key)
    if (prev != null && Math.abs(prev - h) < 1) return
    itemHeightsRef.current.set(key, h)
    setHeightsVersion((v) => v + 1)
  }, [])

  const setViewportHeight = useCallback((height: number) => {
    if (!height) return
    setWebViewportH((prev) => (Math.abs(prev - height) < 1 ? prev : height))
  }, [])

  // Re-read the live container size and scroll position. Called on mount, on
  // ResizeObserver fires, and a few rAF ticks after mount — this is what
  // guarantees the virtual window is computed against the REAL sheet height
  // even when the container only reaches its final size after the list has
  // mounted (snap=half, filters→list transition). Without it the first window
  // is computed against a stale/zero height and items render offscreen until a
  // manual scroll forces a recompute.
  const syncFromNode = useCallback(() => {
    const node = resolveScrollNode(scrollRef.current)
    if (!node) return
    const h = node.clientHeight
    if (h) setViewportHeight(h)
    setWebScrollY((prev) => (Math.abs(prev - node.scrollTop) < 1 ? prev : node.scrollTop))
  }, [setViewportHeight])

  // Attach a ResizeObserver to the scroll container so any height change
  // (sheet snap, keyboard, orientation) re-syncs the viewport height and the
  // virtual window recomputes immediately.
  const setScrollRef = useCallback(
    (instance: unknown) => {
      scrollRef.current = instance
      if (!IS_WEB) return
      const node = resolveScrollNode(instance)
      if (!node) return
      const RO = (globalThis as any)?.ResizeObserver as
        | undefined
        | (new (cb: () => void) => { observe: (el: Element) => void; disconnect: () => void })
      if (RO) {
        const observer = new RO(() => syncFromNode())
        observer.observe(node)
        ;(node as any).__mvListRO?.disconnect?.()
        ;(node as any).__mvListRO = observer
      }
      syncFromNode()
    },
    [syncFromNode],
  )

  // Belt-and-suspenders: re-sync over the first few frames after mount AND
  // whenever the item set changes (filters→list, new query). The container can
  // grow asynchronously after layout, so a single onLayout measurement is not
  // enough. itemKeys.length in deps re-runs the catch-up sync on content swap.
  useEffect(() => {
    if (!IS_WEB) return
    const raf = (globalThis as any)?.requestAnimationFrame as
      | undefined
      | ((cb: () => void) => number)
    const caf = (globalThis as any)?.cancelAnimationFrame as undefined | ((id: number) => void)
    syncFromNode()
    if (typeof raf !== 'function') return
    const ids: number[] = []
    let count = 0
    const tick = () => {
      syncFromNode()
      count += 1
      if (count < 4) ids.push(raf(tick))
    }
    ids.push(raf(tick))
    return () => {
      if (typeof caf === 'function') ids.forEach((id) => caf(id))
    }
  }, [syncFromNode, itemKeys.length])

  const webScrollHandler = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent
      const raf = (globalThis as any)?.requestAnimationFrame as
        | undefined
        | ((cb: () => void) => number)
      const caf = (globalThis as any)?.cancelAnimationFrame as
        | undefined
        | ((id: number) => void)

      const apply = () => {
        setWebScrollY(contentOffset.y)
        if (layoutMeasurement.height) setWebViewportH(layoutMeasurement.height)
      }

      if (typeof raf === 'function') {
        if (webScrollRafRef.current != null && typeof caf === 'function') {
          caf(webScrollRafRef.current)
        }
        webScrollRafRef.current = raf(apply)
      } else {
        apply()
      }

      if (!hasMore || !onLoadMore) return
      const distanceFromEnd =
        contentSize.height - layoutMeasurement.height - contentOffset.y
      if (distanceFromEnd < layoutMeasurement.height * LOAD_MORE_THRESHOLD_RATIO) {
        onLoadMore()
      }
    },
    [hasMore, onLoadMore],
  )

  const webWindow = useMemo(
    () =>
      computeVirtualWindowVariable(
        webScrollY,
        webViewportH || WEB_DEFAULT_VIEWPORT_HEIGHT,
        itemKeys.length,
        (i) =>
          itemHeightsRef.current.get(itemKeys[i]) ?? WEB_ESTIMATED_ITEM_HEIGHT_PX,
        WEB_LIST_OVERSCAN_ITEMS,
      ),
    // heightsVersion intentionally included: bumped when a row reports a new
    // measured height so the window recomputes against real offsets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [webScrollY, webViewportH, itemKeys, heightsVersion],
  )

  return {
    webWindow,
    webScrollHandler,
    recordItemHeight,
    setViewportHeight,
    setScrollRef,
  }
}
