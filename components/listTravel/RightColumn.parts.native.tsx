import { memo } from 'react';
import { ActivityIndicator, View } from 'react-native'

import RecommendationsTabsBase from './RecommendationsTabs'
import { SkeletonLoader, TravelCardSkeleton } from '@/components/ui/SkeletonLoader'
import { RECOMMENDATIONS_TOTAL_HEIGHT } from '@/components/listTravel/rightColumnModel'

export const RecommendationsTabs = memo(RecommendationsTabsBase)

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
