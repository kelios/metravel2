import { memo, useEffect, useMemo, useRef } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import type { AdventPaperPalette } from '@/constants/adventVisuals'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { ANIMATION_NATIVE_DRIVER, useReduceMotion } from '@/hooks/useReduceMotion'
import AdventSparkles from '../AdventSparkles'
import { useAdventPaper } from '../useAdventPaper'

type Props = {
  title: string
  caption: string
}

/** Медаль-звание теста (#3487): золотой круг с лентой и званием, «выпрыгивает» с искрами. */
function AdventTitleMedal({ title, caption }: Props) {
  const paper = useAdventPaper()
  const styles = useMemo(() => createStyles(paper), [paper])
  const reduceMotion = useReduceMotion()
  const pop = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current

  useEffect(() => {
    if (reduceMotion) {
      pop.setValue(1)
      return
    }
    const animation = Animated.spring(pop, { toValue: 1, friction: 4, tension: 90, useNativeDriver: ANIMATION_NATIVE_DRIVER })
    animation.start()
    return () => animation.stop()
  }, [pop, reduceMotion])

  return (
    <View style={styles.wrap} accessible accessibilityLabel={`${caption}: ${title}`} testID="advent-title-medal">
      <Animated.View
        style={[
          styles.medal,
          {
            opacity: pop,
            transform: [
              { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
              { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '0deg'] }) },
            ],
          },
        ]}
      >
        <AdventSparkles burstKey={title} count={14} radius={64} color={paper.gold} />
        <View style={styles.ring}>
          <Feather name="award" size={34} color={paper.gold} />
        </View>
      </Animated.View>
      <Text style={styles.caption}>{caption}</Text>
      <Text style={styles.title} testID="advent-title-medal-title">
        {title}
      </Text>
    </View>
  )
}

const createStyles = (paper: AdventPaperPalette) =>
  StyleSheet.create({
    wrap: { alignItems: 'center', gap: 4, paddingVertical: DESIGN_TOKENS.spacing.sm },
    medal: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center' },
    ring: {
      width: 76,
      height: 76,
      borderRadius: 38,
      borderWidth: 3,
      borderColor: paper.gold,
      backgroundColor: paper.tag,
      alignItems: 'center',
      justifyContent: 'center',
    },
    caption: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase', color: paper.inkMuted },
    title: { fontSize: 20, lineHeight: 26, fontWeight: '700', textAlign: 'center', color: paper.ink },
  })

export default memo(AdventTitleMedal)
