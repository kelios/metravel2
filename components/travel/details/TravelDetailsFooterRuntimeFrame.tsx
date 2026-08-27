import React from 'react'
import { View, type LayoutChangeEvent } from 'react-native'

import type { Travel } from '@/types/types'

import { TravelDetailsFooterSection } from './sections/TravelDetailsFooterSection'

type TravelDetailsFooterRuntimeFrameProps = {
  isMobile: boolean
  onRuntimeFrameLayout: (event: LayoutChangeEvent) => void
  travel: Travel
}

export default function TravelDetailsFooterRuntimeFrame({
  isMobile,
  onRuntimeFrameLayout,
  travel,
}: TravelDetailsFooterRuntimeFrameProps) {
  return (
    <View
      testID="travel-details-footer-resolved-frame"
      onLayout={onRuntimeFrameLayout}
      collapsable={false}
    >
      <TravelDetailsFooterSection travel={travel} isMobile={isMobile} />
    </View>
  )
}
