import React, { lazy } from 'react'

export type WeeklyHighlightsComponent = React.ComponentType<{
  showHeader?: boolean
  enabled?: boolean
  forceVisible?: boolean
  onVisibilityChange?: (visible: boolean) => void
}>

export type PersonalizedRecommendationsComponent = React.ComponentType<{
  showHeader?: boolean
  onlyRecommendations?: boolean
  forceVisible?: boolean
  onVisibilityChange?: (visible: boolean) => void
}>

export const PersonalizedRecommendations = lazy(async () => {
  const m: any = await import('@/components/travel/PersonalizedRecommendations')
  return {
    default: (m?.default ?? m?.PersonalizedRecommendations) as PersonalizedRecommendationsComponent,
  }
})

export const WeeklyHighlights = lazy(async () => {
  const m: any = await import('@/components/travel/WeeklyHighlights')
  return { default: (m?.default ?? m?.WeeklyHighlights) as WeeklyHighlightsComponent }
})
