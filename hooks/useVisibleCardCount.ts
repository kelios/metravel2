import { useCallback, useMemo, useState } from 'react'
import type { LayoutChangeEvent } from 'react-native'

type Options = {
  itemCount: number
  itemWidth: number
  gap?: number
  min?: number
  max?: number
}

export function useVisibleCardCount({
  itemCount,
  itemWidth,
  gap = 16,
  min = 1,
  max,
}: Options) {
  const [containerWidth, setContainerWidth] = useState(0)

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = Number(event.nativeEvent.layout.width || 0)
    setContainerWidth((current) => (Math.abs(current - nextWidth) < 1 ? current : nextWidth))
  }, [])

  const visibleCount = useMemo(() => {
    if (itemCount <= 0) return 0
    const maxItems = Math.max(min, max ?? itemCount)
    if (containerWidth <= 0 || itemWidth <= 0) return Math.min(itemCount, maxItems)

    const fit = Math.floor((containerWidth + gap) / (itemWidth + gap))
    return Math.min(itemCount, maxItems, Math.max(min, fit))
  }, [containerWidth, gap, itemCount, itemWidth, max, min])

  return { onLayout, visibleCount }
}
