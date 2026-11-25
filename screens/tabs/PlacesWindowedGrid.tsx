import React, {
  createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from 'react'
import {
  Platform, ScrollView, StyleSheet, View,
  type LayoutChangeEvent, type ScrollViewInstance, type ScrollViewProps,
} from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { CatalogPlace } from '@/utils/placesCatalog'
import { PlaceCard } from './PlacesScreen.parts'

const gap = DESIGN_TOKENS.spacing.md
const overscanRows = 2
const initialViewport = { y: 0, height: 800 }
const ScrollViewport = createContext(initialViewport)
const anchorStyleId = 'places-catalog-scroll-anchor'
// Long enough for the browser to restore focus after Back, short enough that a
// later programmatic scroll in the same visit is not pinned.
const returnScrollHoldMs = 800
const returnScrollCorrections = 8

type ScrollHost = ScrollViewInstance & { getScrollableNode?: () => unknown }

function scrollableNode(host: ScrollHost | null): HTMLElement | null {
  const node = host?.getScrollableNode?.() ?? host
  return node && typeof (node as HTMLElement).scrollTop === 'number' ? node as HTMLElement : null
}

function ensureScrollAnchorOptOut() {
  if (typeof document === 'undefined' || document.getElementById(anchorStyleId)) return
  const style = document.createElement('style')
  style.id = anchorStyleId
  // Descendants stay eligible anchors unless the opt-out covers them too.
  // A virtual spacer resize must not drag scrollTop.
  style.textContent = '[data-testid="places-catalog-scroll"],[data-testid="places-catalog-scroll"] *{overflow-anchor:none}'
  document.head.appendChild(style)
}

// Only the grid consumes scroll ticks. The sidebar, controls and banners stay
// in the original single scroll container and need no scroll-driven renders.
export function PlacesCatalogScrollView({
  active = true, children, onScroll, ...props
}: ScrollViewProps & { active?: boolean }) {
  const scrollRef = useRef<ScrollHost | null>(null)
  const offsetRef = useRef(0)
  const savedOffsetRef = useRef<number | null>(null)
  const holdOffsetRef = useRef<number | null>(null)
  const holdCorrectionsRef = useRef(0)
  const activeRef = useRef(active)
  activeRef.current = active
  const [viewport, setViewport] = useState(initialViewport)
  const measure = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout
    if (height > 0) setViewport(prev => prev.height === height ? prev : { ...prev, height })
  }, [])
  const scroll: NonNullable<ScrollViewProps['onScroll']> = event => {
    // display:none on the inactive screen can emit a zero offset before the
    // return hold is armed. Keep the last offset from the visible visit.
    if (!activeRef.current) return
    const { contentOffset, layoutMeasurement } = event.nativeEvent
    const y = contentOffset.y
    const held = holdOffsetRef.current
    if (held != null && Math.abs(y - held) > 1) {
      holdCorrectionsRef.current += 1
      if (holdCorrectionsRef.current > returnScrollCorrections) {
        holdOffsetRef.current = null
      } else {
        const node = scrollableNode(scrollRef.current)
        if (node) node.scrollTop = held
        return
      }
    }
    offsetRef.current = y
    if (layoutMeasurement.height > 0) setViewport({ y, height: layoutMeasurement.height })
    onScroll?.(event)
  }
  useEffect(() => {
    if (Platform.OS === 'web') ensureScrollAnchorOptOut()
  }, [])
  useLayoutEffect(() => {
    if (Platform.OS !== 'web') return
    if (!active) {
      savedOffsetRef.current = offsetRef.current
      holdOffsetRef.current = null
      return
    }
    const saved = savedOffsetRef.current
    if (saved == null) return
    holdOffsetRef.current = saved
    holdCorrectionsRef.current = 0
    const node = scrollableNode(scrollRef.current)
    const restore = () => {
      const held = holdOffsetRef.current
      const current = scrollableNode(scrollRef.current)
      if (held == null || !current || Math.abs(current.scrollTop - held) <= 1) return
      holdCorrectionsRef.current += 1
      if (holdCorrectionsRef.current > returnScrollCorrections) {
        holdOffsetRef.current = null
        return
      }
      current.scrollTop = held
      requestAnimationFrame(() => {
        const latest = scrollableNode(scrollRef.current)
        if (holdOffsetRef.current === held && latest && Math.abs(latest.scrollTop - held) <= 1) {
          holdOffsetRef.current = null
        }
      })
    }
    restore()
    const release = () => { holdOffsetRef.current = null }
    node?.addEventListener('scroll', restore)
    node?.addEventListener('wheel', release, { passive: true })
    node?.addEventListener('touchmove', release, { passive: true })
    node?.addEventListener('pointerdown', release)
    node?.addEventListener('keydown', release)
    const timer = setTimeout(release, returnScrollHoldMs)
    return () => {
      clearTimeout(timer)
      release()
      node?.removeEventListener('scroll', restore)
      node?.removeEventListener('wheel', release)
      node?.removeEventListener('touchmove', release)
      node?.removeEventListener('pointerdown', release)
      node?.removeEventListener('keydown', release)
    }
  }, [active])
  return (
    <ScrollView
      {...props}
      ref={scrollRef}
      onLayout={measure}
      onScroll={scroll}
      scrollEventThrottle={32}
    >
      <ScrollViewport.Provider value={viewport}>{children}</ScrollViewport.Provider>
    </ScrollView>
  )
}

function focusRowKey(relatedTarget: unknown): string | null {
  const node = relatedTarget as { closest?: (selector: string) => { getAttribute(name: string): string | null } | null } | null
  return node?.closest?.('[data-places-row]')?.getAttribute('data-places-row') ?? null
}

const placeKey = (place: CatalogPlace) =>
  place.placeId == null ? `point:${place.id}` : `place:${place.placeId}`

type RowMeasurements = { width: number; columns: number; heights: Map<string, number> }

// A one-pixel width change (scrollbar, sticky sidebar, display:none → contents)
// must not throw away measured rows. Those rows are unmounted above the
// viewport, so the next frame would substitute the 550px estimate and scroll
// anchoring would move the catalog (desktop 6500 → 5821, #3460).
export function rememberRowHeight(
  prev: RowMeasurements,
  row: { width: number; columns: number; key: string; height: number },
): RowMeasurements {
  const cached = prev.columns === row.columns ? prev.heights : undefined
  if (cached?.get(row.key) === row.height && prev.width === row.width) return prev
  const heights = new Map(cached)
  heights.set(row.key, row.height)
  return { width: row.width, columns: row.columns, heights }
}

// offsets includes a final sentinel for the bottom of the last row.
function rowAt(offsets: number[], y: number) {
  let low = 0
  let high = Math.max(0, offsets.length - 2)
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if (offsets[mid] <= y) low = mid
    else high = mid - 1
  }
  return low
}

type GridProps = Pick<React.ComponentProps<typeof PlaceCard>, 'styles' | 'onOpenMap' | 'onOpenTravel'> & {
  places: CatalogPlace[]
  columns: number
  parentTop: number
  firstScreenCount: number
  footer: React.ReactNode
}

export function PlacesWindowedGrid({ places, columns, parentTop, firstScreenCount, footer, ...cardProps }: GridProps) {
  const { styles } = cardProps
  const viewport = useContext(ScrollViewport)
  const [layout, setLayout] = useState({ y: 0, width: 0 })
  const measureGrid = useCallback((event: LayoutChangeEvent) => {
    const { y, width } = event.nativeEvent.layout
    if (width > 0) setLayout(prev => prev.y === y && prev.width === width ? prev : { y, width })
  }, [])
  // Match the original flex-wrap when the sidebar or a narrow tablet makes
  // fewer cards fit than the viewport breakpoint would suggest.
  const minWidth = Number(StyleSheet.flatten(styles.card)?.minWidth) || 0
  const perRow = layout.width
    ? Math.min(columns, Math.max(1, Math.floor((layout.width + gap) / (minWidth + gap))))
    : columns
  const rows = useMemo(() => {
    const result = []
    for (let i = 0; i < places.length; i += perRow) {
      const items = places.slice(i, i + perRow)
      result.push({ items, key: placeKey(items[0]), measurementKey: items.map(placeKey).join('|') })
    }
    return result
  }, [places, perRow])

  const [measurements, setMeasurements] = useState<RowMeasurements>(() => ({
    width: layout.width, columns: perRow, heights: new Map<string, number>(),
  }))
  const heights = measurements.columns === perRow ? measurements.heights : undefined
  const measureRow = (key: string, event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    if (height <= 0 || width <= 0) return
    setMeasurements(prev => rememberRowHeight(prev, { width, columns: perRow, key, height }))
  }
  const hasFooter = footer != null
  const offsets = useMemo(() => {
    // Unseen rows reserve a typical card height until their natural height is
    // known. Measured rows retain their exact space when scrolled out.
    const estimate = perRow === 1 ? 500 : 550
    const result = [0]
    for (const row of rows) result.push(result[result.length - 1] + (heights?.get(row.measurementKey) ?? estimate) + gap)
    if (rows.length && !hasFooter) result[rows.length] -= gap
    return result
  }, [heights, perRow, rows, hasFooter])

  const top = viewport.y - parentTop - layout.y
  const first = Math.max(0, rowAt(offsets, top) - overscanRows)
  const last = Math.min(rows.length - 1, rowAt(offsets, top + viewport.height) + overscanRows)
  const [focused, setFocused] = useState<string | null>(null)
  const clearFocusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rememberFocus = (key: string) => {
    if (clearFocusTimer.current != null) {
      clearTimeout(clearFocusTimer.current)
      clearFocusTimer.current = null
    }
    setFocused(current => current === key ? current : key)
  }
  // Blur flushes before the next control is focused. Dropping the off-screen
  // row in that handler unmounts the Tab target and focus falls through to body.
  const scheduleFocusClear = () => {
    if (clearFocusTimer.current != null) clearTimeout(clearFocusTimer.current)
    clearFocusTimer.current = setTimeout(() => {
      clearFocusTimer.current = null
      setFocused(null)
    }, 0)
  }
  useEffect(() => () => {
    if (clearFocusTimer.current != null) clearTimeout(clearFocusTimer.current)
  }, [])
  const focusIndex = useMemo(() => focused === null ? -1 : rows.findIndex(row => row.key === focused), [focused, rows])
  const indexes = new Set<number>()
  for (let i = first; i <= last; i++) indexes.add(i)
  if (Platform.OS === 'web' && rows.length) {
    // Tab into the catalog from either end, and keep adjacent tab stops
    // reachable even if the user wheels far away from the focused action.
    indexes.add(0)
    indexes.add(rows.length - 1)
    if (focusIndex >= 0) {
      for (let i = Math.max(0, focusIndex - 1); i <= Math.min(rows.length - 1, focusIndex + 1); i++) indexes.add(i)
    }
  }
  const content: React.ReactNode[] = []
  let cursor = 0
  const spacerTo = (end: number) => {
    if (end > cursor) content.push(<View key={`space-${cursor}`} style={{ height: offsets[end] - offsets[cursor] }} />)
  }
  for (const index of [...indexes].sort((a, b) => a - b)) {
    spacerTo(index)
    const row = rows[index]
    content.push(
      <View
        key={row.key}
        style={[styles.cardsGrid, (index < rows.length - 1 || hasFooter) && { marginBottom: gap }]}
        onLayout={event => measureRow(row.measurementKey, event)}
        {...(Platform.OS === 'web' ? {
          dataSet: { placesRow: row.key },
          onFocus: () => rememberFocus(row.key),
          onBlur: (event: { nativeEvent?: { relatedTarget?: unknown } }) => {
            const next = focusRowKey(event.nativeEvent?.relatedTarget)
            if (next) rememberFocus(next)
            else scheduleFocusClear()
          },
        } : {})}
      >
        {row.items.map((place, i) => (
          <PlaceCard key={placeKey(place)} {...cardProps} place={place} priority={index * perRow + i < firstScreenCount} />
        ))}
      </View>,
    )
    cursor = index + 1
  }
  spacerTo(rows.length)
  return <View testID="places-cards-grid" onLayout={measureGrid}>{content}{footer}</View>
}
