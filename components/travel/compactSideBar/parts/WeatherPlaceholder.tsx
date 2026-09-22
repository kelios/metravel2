import { memo } from 'react'
import { View } from 'react-native'

import { SectionSkeleton } from '@/components/ui/SectionSkeleton'

import { weatherPlaceholderStyle } from '../styles'

export const WeatherPlaceholder = memo(function WeatherPlaceholder() {
  return (
    <View style={weatherPlaceholderStyle}>
      <SectionSkeleton lines={2} height={18} />
      <View style={{ height: 14 }} />
      <SectionSkeleton lines={3} height={56} />
    </View>
  )
})
