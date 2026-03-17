import React, { memo } from 'react'
import { View } from 'react-native'

import TravelRatingSection from '@/components/travel/TravelRatingSection'
import type { Travel } from '@/types/types'

import { useTravelDetailsStyles } from './TravelDetailsStyles'

const TravelDeferredRatingSection: React.FC<{ travel: Travel }> = memo(function TravelDeferredRatingSection({ travel }) {
  const styles = useTravelDetailsStyles()

  if (!travel?.id) return null

  return (
    <View
      testID="travel-details-rating"
      accessibilityRole={'region' as any}
      accessibilityLabel="Рейтинг путешествия"
      style={[styles.sectionContainer, styles.contentStable]}
    >
      <TravelRatingSection
        travelId={travel.id}
        initialRating={travel.rating}
        initialCount={travel.rating_count}
        initialUserRating={travel.user_rating}
      />
    </View>
  )
})

export default TravelDeferredRatingSection
