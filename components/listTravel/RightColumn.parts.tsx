import React, { memo, lazy } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'

import { SkeletonLoader, TravelCardSkeleton } from '@/components/ui/SkeletonLoader'
import { RECOMMENDATIONS_TOTAL_HEIGHT } from '@/components/listTravel/rightColumnModel'

// Lazy load RecommendationsTabs with proper error boundary
export const RecommendationsTabs = lazy(async () => {
  try {
    return await import('./RecommendationsTabs')
  } catch {
    return {
      default: memo((_props: { forceVisible?: boolean; onVisibilityChange?: (visible: boolean) => void }) => (
        <View style={{ padding: 16, alignItems: 'center' }}>
          <Text>Не удалось загрузить рекомендации</Text>
        </View>
      )),
    } as unknown as typeof import('./RecommendationsTabs')
  }
})

// Simple placeholder for loading state (must match the reserved header height)
export const RecommendationsPlaceholder = () => (
  <View
    style={{
      height: RECOMMENDATIONS_TOTAL_HEIGHT,
      padding: 16,
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <ActivityIndicator size="small" />
  </View>
)

const FallbackTravelCardSkeleton = () => (
  <SkeletonLoader width="100%" height={320} borderRadius={16} />
)

export const TravelCardSkeletonComponent = TravelCardSkeleton ?? FallbackTravelCardSkeleton
