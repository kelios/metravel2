import React from 'react'
import { View, type LayoutChangeEvent } from 'react-native'

import ContributionBanner from '@/components/common/ContributionBanner'
import { isPlaceRequestsPilotEnabled } from '@/utils/placeRequestsConfig'
import type { Travel } from '@/types/types'

import { TravelDetailsFooterSection } from './sections/TravelDetailsFooterSection'

type TravelDetailsFooterRuntimeFrameProps = {
  isMobile: boolean
  onRuntimeFrameLayout: (event: LayoutChangeEvent) => void
  travel: Travel
}

const CONTRIBUTION_REGIONS = new Map([
  ['vitebsk-za-1-den-chto-posmotret-i-kuda-skhodit', 'vitebsk'],
  ['benitsa-zabroshennye-podzemelia-i-staryi-khram', 'grodno'],
])

export default function TravelDetailsFooterRuntimeFrame({
  isMobile,
  onRuntimeFrameLayout,
  travel,
}: TravelDetailsFooterRuntimeFrameProps) {
  const region = isPlaceRequestsPilotEnabled() ? CONTRIBUTION_REGIONS.get(travel.slug) : undefined
  return (
    <View
      testID="travel-details-footer-resolved-frame"
      onLayout={onRuntimeFrameLayout}
      collapsable={false}
    >
      <TravelDetailsFooterSection travel={travel} isMobile={isMobile} />
      {region ? <ContributionBanner density="compact" campaign={{ source: 'related_travel', region }} /> : null}
    </View>
  )
}
