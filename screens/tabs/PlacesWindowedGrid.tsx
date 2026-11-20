import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import {
  Platform, ScrollView, StyleSheet, View, type LayoutChangeEvent, type ScrollViewProps,
} from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { CatalogPlace } from '@/utils/placesCatalog'
import { PlaceCard } from './PlacesScreen.parts'

const gap = DESIGN_TOKENS.spacing.md
const overscanRows = 2
const initialViewport = { y: 0, height: 800 }
const ScrollViewport = createContext(initialViewport)

// Only the grid consumes scroll ticks. The sidebar, controls and banners stay
// in the original single scroll container and need no scroll-driven renders.
export function PlacesCatalogScrollView({ children, onScroll, ...props }: ScrollViewProps) {
  const [viewport, setViewport] = useState(initialViewport)
  const measure = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout
    if (height > 0) setViewport(prev => prev.height === height ? prev : { ...prev, height })
  }, [])
  const scroll: NonNullable<ScrollViewProps['onScroll']> = event => {
    const { contentOffset, layoutMeasurement } = event.nativeEvent
    if (layoutMeasurement.height > 0) setViewport({ y: contentOffset.y, height: layoutMeasurement.height })
    onScroll?.(event)
  }
  return (
    <ScrollView {...props} onLayout={measure} onScroll={scroll} scrollEventThrottle={32}>
      <ScrollViewport.Provider value={viewport}>{children}</ScrollViewport.Provider>
    </ScrollView>
  )
}

const placeKey = (place: CatalogPlace) =>
  place.placeId == null ? `point:${place.id}` : `place:${place.placeId}`

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

  const [measurements, setMeasurements] = useState(() => ({
    width: layout.width, columns: perRow, heights: new Map<string, number>(),
  }))
  const heights = measurements.width === layout.width && measurements.columns === perRow
    ? measurements.heights : undefined
  const measureRow = (key: string, event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    if (height <= 0 || width <= 0) return
    setMeasurements(prev => {
      const cached = prev.width === width && prev.columns === perRow ? prev.heights : undefined
      if (cached?.get(key) === height) return prev
      return { width, columns: perRow, heights: new Map(cached).set(key, height) }
    })
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
        {...(Platform.OS === 'web' ? { onFocus: () => setFocused(row.key), onBlur: () => setFocused(null) } : {})}
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
