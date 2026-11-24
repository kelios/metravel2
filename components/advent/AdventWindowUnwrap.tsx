import { memo, useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native'

import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { ADVENT_ART_COLORS, ADVENT_FROST_OPACITY, ADVENT_VISUAL_ASSETS } from '@/constants/adventVisuals'
import { ANIMATION_NATIVE_DRIVER } from '@/hooks/useReduceMotion'
import AdventSparkles from './AdventSparkles'
import { ADVENT_WINDOW_GLASS } from './adventHouseLayout'

/** Длительность распаковки окна до появления листа (#3482: 0,8–1 с). */
export const ADVENT_UNWRAP_MS = 900
const MELT_MS = 560

type Props = { day: number; placement: ViewStyle }

/**
 * Момент «распаковки» окна на фасаде (#3482): морозный узор тает, комната
 * разгорается, разлетаются искры, и окно приближается к зрителю — следом
 * открывается лист с той же комнатой в шапке. Чистый декор поверх окна:
 * состояние дверцы уже записано, касания проходят сквозь слой.
 * Экран монтирует его только при разрешённом движении.
 */
function AdventWindowUnwrap({ day, placement }: Props) {
  const melt = useRef(new Animated.Value(0)).current
  const approach = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.timing(melt, { toValue: 1, duration: MELT_MS, easing: Easing.out(Easing.quad), useNativeDriver: ANIMATION_NATIVE_DRIVER }),
      Animated.timing(approach, {
        toValue: 1,
        duration: ADVENT_UNWRAP_MS - MELT_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: ANIMATION_NATIVE_DRIVER,
      }),
    ])
    animation.start()
    return () => animation.stop()
  }, [melt, approach])

  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      testID={`advent-window-unwrap-${day}`}
      style={[
        placement,
        styles.layer,
        {
          opacity: approach.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.9, 0] }),
          transform: [{ scale: approach.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
        },
      ]}
    >
      <View style={[ADVENT_WINDOW_GLASS, styles.glass]}>
        <Animated.View style={[styles.fill, styles.glow, { opacity: melt }]} />
        <Animated.View
          style={[
            styles.fill,
            {
              opacity: melt.interpolate({ inputRange: [0, 1], outputRange: [ADVENT_FROST_OPACITY, 0] }),
              transform: [{ scale: melt.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) }],
            },
          ]}
        >
          <ImageCardMedia
            source={ADVENT_VISUAL_ASSETS.frost[(day - 1) % ADVENT_VISUAL_ASSETS.frost.length]}
            alt=""
            fit="cover"
            borderRadius={0}
            showLoadingIndicator={false}
            transition={0}
            showImmediately
            placeholderColor="#00000000"
            style={styles.image}
          />
        </Animated.View>
      </View>
      <AdventSparkles burstKey={day} count={12} radius={64} duration={MELT_MS + 200} />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  layer: { zIndex: 2, overflow: 'visible' },
  glass: { overflow: 'hidden', borderRadius: 1 },
  fill: { ...StyleSheet.absoluteFill },
  glow: { backgroundColor: ADVENT_ART_COLORS.unwrapGlow },
  image: { width: '100%', height: '100%', backgroundColor: 'transparent' },
})

export default memo(AdventWindowUnwrap)
