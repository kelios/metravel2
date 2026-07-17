import { useCallback, useEffect, useRef } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'

import { trackContentScrollDepth } from '@/utils/growthFunnelAnalytics'

const SCROLL_DEPTH_THRESHOLDS = [25, 50, 75] as const

type UseContentScrollAnalyticsParams = {
  source: string
  contentType: 'article' | 'travel'
  contentId?: string | number | null
}

export function useContentScrollAnalytics({
  source,
  contentType,
  contentId,
}: UseContentScrollAnalyticsParams) {
  const reachedRef = useRef(new Set<number>())
  const normalizedContentId = contentId == null ? '' : String(contentId)

  useEffect(() => {
    reachedRef.current.clear()
  }, [normalizedContentId])

  return useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent
    const contentHeight = contentSize?.height ?? 0
    const viewportHeight = layoutMeasurement?.height ?? 0
    if (contentHeight <= viewportHeight || contentHeight <= 0) return

    const progress = Math.min(100, ((contentOffset.y + viewportHeight) / contentHeight) * 100)
    for (const depth of SCROLL_DEPTH_THRESHOLDS) {
      if (progress < depth || reachedRef.current.has(depth)) continue
      reachedRef.current.add(depth)
      trackContentScrollDepth({ source, contentType, contentId: normalizedContentId, depth })
    }
  }, [contentType, normalizedContentId, source])
}
