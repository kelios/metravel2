import React from 'react'
import { Platform } from 'react-native'
import TravelDetailsContainer from '@/components/travel/details/TravelDetailsContainer'

export default function TravelDetailsScreen() {
  if (Platform.OS !== 'web') {
    const TravelDetailsNative = require('@/components/travel/details/TravelDetailsContainer').default
    return <TravelDetailsNative />
  }

  return <TravelDetailsContainer />
}
