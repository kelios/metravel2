import { useCallback, useEffect, useMemo, useState } from 'react'

import { useProgressiveLoad } from '@/hooks/useProgressiveLoading'
import type { Travel } from '@/types/types'

export type InsightKey = 'recommendation' | 'plus' | 'minus'

type UseTravelDetailsContentSectionModelArgs = {
  forceOpenKey: string | null
  isMobile: boolean
  moderation: unknown
  publish: unknown
  travel: Travel
}

export function useTravelDetailsContentSectionModel({
  forceOpenKey,
  isMobile,
  moderation,
  publish,
  travel,
}: UseTravelDetailsContentSectionModelArgs) {
  const shouldRenderDescriptionSection = useMemo(() => {
    const desc = typeof travel.description === 'string' ? travel.description.trim() : ''
    const isDraft = publish === false || moderation === false
    return Boolean(desc) || isDraft
  }, [moderation, publish, travel.description])

  const hasRecommendation = Boolean(travel.recommendation?.trim())
  const hasPlus = Boolean(travel.plus?.trim())
  const hasMinus = Boolean(travel.minus?.trim())

  const insightConfigs = useMemo(
    () =>
      [
        hasRecommendation && {
          key: 'recommendation' as InsightKey,
          label: 'Советы',
          charCount: (travel.recommendation || '').replace(/<[^>]*>/g, '').length,
        },
        hasPlus && {
          key: 'plus' as InsightKey,
          label: 'Понравилось',
          charCount: (travel.plus || '').replace(/<[^>]*>/g, '').length,
        },
        hasMinus && {
          key: 'minus' as InsightKey,
          label: 'Не зашло',
          charCount: (travel.minus || '').replace(/<[^>]*>/g, '').length,
        },
      ].filter(Boolean) as Array<{ key: InsightKey; label: string; charCount: number }>,
    [hasRecommendation, hasPlus, hasMinus, travel.recommendation, travel.plus, travel.minus]
  )

  const readingTimeLabel = useMemo(() => {
    if (!travel.description) return ''
    const wordCount = travel.description.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length
    const minutes = Math.max(1, Math.ceil(wordCount / 200))
    return ` · ~${minutes} мин чтения`
  }, [travel.description])

  const shouldUseMobileInsights = isMobile && insightConfigs.length > 0
  const hasInsights = hasRecommendation || hasPlus || hasMinus
  const [mobileInsightKey, setMobileInsightKey] = useState<InsightKey | null>(() =>
    shouldUseMobileInsights ? insightConfigs[0]?.key ?? null : null
  )

  const { shouldLoad: shouldLoadVideo, setElementRef: setVideoRef } = useProgressiveLoad({
    priority: 'low',
    rootMargin: '220px',
    threshold: 0.05,
    fallbackDelay: 1000,
    enabled: Boolean(travel.youtube_link),
  })
  const { setElementRef: setInsightsRef } = useProgressiveLoad({
    priority: 'low',
    rootMargin: '260px',
    threshold: 0.05,
    fallbackDelay: 1000,
    enabled: hasInsights,
  })

  const defaultInsightKey = shouldUseMobileInsights ? insightConfigs[0]?.key ?? null : null

  useEffect(() => {
    if (!shouldUseMobileInsights) {
      setMobileInsightKey(null)
      return
    }

    if (
      forceOpenKey &&
      (forceOpenKey === 'recommendation' || forceOpenKey === 'plus' || forceOpenKey === 'minus')
    ) {
      setMobileInsightKey(forceOpenKey as InsightKey)
      return
    }

    setMobileInsightKey((prev) => prev ?? defaultInsightKey)
  }, [defaultInsightKey, forceOpenKey, shouldUseMobileInsights])

  const buildInsightControl = useCallback(
    (key: InsightKey) =>
      shouldUseMobileInsights
        ? {
            open: mobileInsightKey === key,
            onToggle: () => setMobileInsightKey((prev) => (prev === key ? null : key)),
          }
        : {},
    [mobileInsightKey, shouldUseMobileInsights]
  )

  return {
    buildInsightControl,
    hasInsights,
    hasMinus,
    hasPlus,
    hasRecommendation,
    insightConfigs,
    mobileInsightKey,
    readingTimeLabel,
    setInsightsRef,
    setMobileInsightKey,
    setVideoRef,
    shouldLoadVideo,
    shouldRenderDescriptionSection,
    shouldUseMobileInsights,
  }
}
