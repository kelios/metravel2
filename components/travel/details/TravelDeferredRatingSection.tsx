import React, { memo } from 'react'
import { View } from 'react-native'

import TravelRatingSection from '@/components/travel/TravelRatingSection'
import type { Travel } from '@/types/types'

import { useTravelDetailsStyles } from './TravelDetailsStyles'
import { translate as i18nT } from '@/i18n'


const TravelDeferredRatingSection: React.FC<{ travel: Travel }> = memo(function TravelDeferredRatingSection({ travel }) {
  const styles = useTravelDetailsStyles()

  if (!travel?.id) return null

  return (
    <View
      testID="travel-details-rating"
      role="region"
      accessibilityLabel={i18nT('travel:components.travel.details.TravelDeferredRatingSection.reyting_puteshestviya_b462e62b')}
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
