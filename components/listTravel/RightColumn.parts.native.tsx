import { memo } from 'react';
import { ActivityIndicator, View } from 'react-native'

import RecommendationsTabsBase from './RecommendationsTabs'
import { RECOMMENDATIONS_TOTAL_HEIGHT } from '@/components/listTravel/rightColumnModel'

export const RecommendationsTabs = memo(RecommendationsTabsBase)

// #2895: popular routes under an empty site search; native ships one bundle, no lazy chunk.
export { default as SearchEmptyPopularRoutes } from '@/components/home/HomePopularRoutesSection'

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
