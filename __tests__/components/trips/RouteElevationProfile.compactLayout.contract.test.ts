import { StyleSheet } from 'react-native'

import { createRouteElevationProfileStyles } from '@/components/travel/details/sections/RouteElevationProfile.styles'
import type { ThemedColors } from '@/hooks/useTheme'

const colors = new Proxy({}, { get: (_target, key) => String(key) }) as ThemedColors

describe('planned-trip elevation compact layout contract', () => {
  it('stacks key-point cards while keeping each compact card in one readable row', () => {
    const styles = createRouteElevationProfileStyles(colors)
    const compactGrid = StyleSheet.flatten([
      styles.pointCardsGrid,
      styles.pointCardsGridCompact,
    ])
    const compactCard = StyleSheet.flatten([
      styles.pointCard,
      styles.pointCardCompact,
    ])
    const compactHeader = StyleSheet.flatten([
      styles.pointCardHeader,
      styles.pointCardHeaderCompact,
    ])
    const compactCaption = StyleSheet.flatten([
      styles.pointCardCaption,
      styles.pointCardCaptionCompact,
    ])
    const compactValue = StyleSheet.flatten([
      styles.pointCardValue,
      styles.pointCardValueCompact,
    ])

    expect(compactGrid.flexDirection).toBe('row')
    expect(compactGrid.flexWrap).toBe('wrap')
    expect(compactGrid.width).toBe('100%')
    expect(compactCard.minWidth).toBe(0)
    expect(compactCard.flexBasis).toBe('100%')
    expect(compactCard.flexDirection).toBe('row')
    expect(compactHeader.marginBottom).toBe(0)
    expect(compactCaption.flex).toBe(1)
    expect(compactCaption.minWidth).toBe(0)
    expect(compactValue.marginBottom).toBe(0)
  })
})
