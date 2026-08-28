import { StyleSheet } from 'react-native'

import { createRouteElevationProfileStyles } from '@/components/travel/details/sections/RouteElevationProfile.styles'
import type { ThemedColors } from '@/hooks/useTheme'

const colors = new Proxy({}, { get: (_target, key) => String(key) }) as ThemedColors

describe('planned-trip elevation compact layout contract', () => {
  it('keeps key-point cards in a horizontal wrapping row', () => {
    const styles = createRouteElevationProfileStyles(colors)
    const compactGrid = StyleSheet.flatten([
      styles.pointCardsGrid,
      styles.pointCardsGridCompact,
    ])
    const compactCard = StyleSheet.flatten([
      styles.pointCard,
      styles.pointCardCompact,
    ])

    expect(compactGrid.flexDirection).toBe('row')
    expect(compactGrid.flexWrap).toBe('wrap')
    expect(compactGrid.width).toBe('100%')
    expect(compactCard.minWidth).toBe(0)
    expect(compactCard.flexBasis).toBe('30%')
  })
})
