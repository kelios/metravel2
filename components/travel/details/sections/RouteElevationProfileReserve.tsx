import React from 'react'
import { View } from 'react-native'

// Observed first-frame cards reach 547px on mobile, including their margin.
// Surplus belongs to the surrounding measured flow's stable-shrink rule.
const PROFILE_RESERVE_HEIGHT = 560

export function getRouteElevationProfilesReserveHeight(count: unknown): number {
  return typeof count === 'number' && Number.isSafeInteger(count) && count > 0
    ? count * PROFILE_RESERVE_HEIGHT
    : 0
}

export function RouteElevationProfileReserve({ count }: { count: unknown }) {
  const height = getRouteElevationProfilesReserveHeight(count)
  if (!height) return null
  return (
    <View
      testID="route-elevation-profiles-reserve"
      style={{ height }}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    />
  )
}
