import React, { Suspense } from 'react'
import { Platform, Text, View } from 'react-native'

import { PointListSkeleton } from '@/components/travel/TravelDetailSkeletons'
import PointList from '@/components/travel/PointList'
import type { Travel } from '@/types/types'

import type { AnchorsMap } from '../TravelDetailsTypes'
import { useTravelDetailsStyles } from '../TravelDetailsStyles'

const SECTION_CONTENT_MARGIN_STYLE = { marginTop: 12 } as const

const PointListFallback = () => {
  const styles = useTravelDetailsStyles()
  return (
    <View style={styles.fallback}>
      <PointListSkeleton />
    </View>
  )
}

export const TravelPointsBlock: React.FC<{
  anchors: AnchorsMap
  handlePointCardPress: (point: any) => void
  styles: any
  travel: Travel
}> = ({ anchors, handlePointCardPress, styles, travel }) => {
  if (!travel.travelAddress || (travel.travelAddress as any[]).length <= 0) return null

  return (
    <View
      ref={anchors.points}
      testID="travel-details-points"
      style={[styles.sectionContainer, styles.contentStable, styles.webDeferredSection]}
      collapsable={false}
      accessibilityLabel="Координаты мест"
      {...(Platform.OS === 'web'
        ? { 'data-testid': 'travel-details-points', 'data-section-key': 'points' }
        : {})}
    >
      <Text style={styles.sectionHeaderText}>Координаты мест</Text>
      <View style={SECTION_CONTENT_MARGIN_STYLE}>
        <Suspense fallback={<PointListFallback />}>
          <PointList
            points={travel.travelAddress as any}
            baseUrl={travel.url}
            travelName={travel.name}
            onPointCardPress={handlePointCardPress}
          />
        </Suspense>
      </View>
    </View>
  )
}

export default React.memo(TravelPointsBlock)
