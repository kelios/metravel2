import { memo, useEffect, useMemo, useRef } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'

import { ADVENT_ART_COLORS } from '@/constants/adventVisuals'
import { ANIMATION_NATIVE_DRIVER, useReduceMotion } from '@/hooks/useReduceMotion'

type Props = {
  /** Смена ключа запускает новую вспышку. */
  burstKey: string | number
  count?: number
  /** Дальность разлёта в px. */
  radius?: number
  duration?: number
  color?: string
}

/**
 * Искры-снежинки праздничного отклика адвента (#3482): ромбики разлетаются из
 * центра и гаснут. Декор: не ловит касания и скрыт от скринридера. При
 * «уменьшить движение» ничего не рисует — отклик несёт текст рядом.
 */
function AdventSparkles({ burstKey, count = 10, radius = 56, duration = 900, color = ADVENT_ART_COLORS.sparkle }: Props) {
  const reduceMotion = useReduceMotion()
  const progress = useRef(new Animated.Value(0)).current
  const sparks = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => {
        const angle = (index / count) * Math.PI * 2 + (index % 2 ? 0.35 : 0)
        const distance = radius * (index % 3 === 0 ? 1 : index % 3 === 1 ? 0.72 : 0.86)
        return { dx: Math.cos(angle) * distance, dy: Math.sin(angle) * distance, size: index % 3 === 0 ? 8 : 6 }
      }),
    [count, radius],
  )

  useEffect(() => {
    if (reduceMotion) return
    progress.setValue(0)
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: ANIMATION_NATIVE_DRIVER,
    })
    animation.start()
    return () => animation.stop()
  }, [burstKey, duration, progress, reduceMotion])

  if (reduceMotion) return null

  const opacity = progress.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 0.8, 0] })
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      style={styles.layer}
      testID="advent-sparkles"
    >
      {sparks.map((spark, index) => (
        <Animated.View
          key={index}
          style={[
            styles.spark,
            {
              width: spark.size,
              height: spark.size,
              marginLeft: -spark.size / 2,
              marginTop: -spark.size / 2,
              backgroundColor: color,
              opacity,
              transform: [
                { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, spark.dx] }) },
                { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, spark.dy] }) },
                { rotate: '45deg' },
                { scale: progress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.2, 1.1, 0.6] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, overflow: 'visible' },
  spark: { position: 'absolute', left: '50%', top: '50%', borderRadius: 1 },
})

export default memo(AdventSparkles)
