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

    // Стопка задаётся столбцом, а не переносом wrap-ряда по `flexBasis: '100%'`:
    // на iOS (TestFlight 1.0.5 (8)) процентный базис не переносил карточки, все
    // три оставались одним рядом, подпись схлопывалась до «Т…», а высота
    // вылезала за границу чипа. На web та же раскладка всегда была корректной,
    // поэтому контракт фиксирует именно платформонезависимый механизм.
    expect(compactGrid.flexDirection).toBe('column')
    expect(compactGrid.flexWrap).toBe('nowrap')
    expect(compactGrid.width).toBe('100%')
    expect(compactCard.minWidth).toBe(0)
    expect(compactCard.alignSelf).toBe('stretch')
    expect(compactCard.flexGrow).toBe(0)
    expect(compactCard.flexShrink).toBe(0)
    expect(compactCard.flexBasis).toBe('auto')
    expect(compactCard.flexDirection).toBe('row')
    expect(compactHeader.marginBottom).toBe(0)
    expect(compactCaption.flex).toBe(1)
    expect(compactCaption.minWidth).toBe(0)
    expect(compactValue.marginBottom).toBe(0)

    // Ряд метрик обязан уметь сжиматься: в RN `flexShrink` по умолчанию 0, и
    // третья плитка «Перепад» уезжала за правый край карточки на iOS.
    const compactSummaryCard = StyleSheet.flatten([
      styles.summaryCard,
      styles.summaryCardCompact,
    ])
    expect(compactSummaryCard.minWidth).toBe(0)
    expect(compactSummaryCard.flexBasis).toBe(0)
    expect(compactSummaryCard.flexShrink).toBe(1)
  })
})
