import { memo, useEffect, useRef, useState } from 'react'
import { Animated, Easing, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { ANIMATION_NATIVE_DRIVER, useReduceMotion } from '@/hooks/useReduceMotion'
import { formatInteger } from '@/i18n/format'
import { translate as i18nT } from '@/i18n'
import AdventSparkles from './AdventSparkles'
import { useAdventPaper } from './useAdventPaper'

type Props = {
  text: string
  /** Начисленные XP — счётчик бежит от нуля; без XP строка не рисуется. */
  xp?: number
  testID?: string
}

const COUNT_MS = 700

/**
 * Праздничный отклик решённого задания (#3482): искры, тёплая строка и бегущий
 * счётчик XP. Остаётся на виду, пока открыт лист, — сам ответ не исчезает.
 */
function AdventCelebration({ text, xp, testID = 'advent-task-celebration' }: Props) {
  const paper = useAdventPaper()
  const reduceMotion = useReduceMotion()
  const pop = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current
  const [shownXp, setShownXp] = useState(reduceMotion ? xp ?? 0 : 0)

  useEffect(() => {
    if (reduceMotion) {
      pop.setValue(1)
      setShownXp(xp ?? 0)
      return
    }
    const animation = Animated.spring(pop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: ANIMATION_NATIVE_DRIVER })
    animation.start()
    if (!xp) return () => animation.stop()
    const counter = new Animated.Value(0)
    const id = counter.addListener(({ value }) => setShownXp(Math.round(value)))
    const count = Animated.timing(counter, { toValue: xp, duration: COUNT_MS, easing: Easing.out(Easing.quad), useNativeDriver: false })
    count.start()
    return () => {
      animation.stop()
      count.stop()
      counter.removeListener(id)
    }
  }, [pop, reduceMotion, xp])

  return (
    <Animated.View
      style={[
        styles.wrap,
        { backgroundColor: paper.tag, borderColor: paper.gold, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] },
      ]}
      accessibilityLiveRegion="polite"
      testID={testID}
    >
      <AdventSparkles burstKey={text} count={12} radius={72} color={paper.gold} />
      <View style={[styles.star, { backgroundColor: paper.gold }]}>
        <Feather name="star" size={18} color={paper.paper} />
      </View>
      <View style={styles.textCol}>
        <Text style={[styles.text, { color: paper.ink }]}>{text}</Text>
        {xp ? (
          <Text style={[styles.xp, { color: paper.gold }]} testID={`${testID}-xp`}>
            {i18nT('adventStatic:sheet.rewardXp', { value1: formatInteger(shownXp) })}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    padding: DESIGN_TOKENS.spacing.sm,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
  },
  star: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  textCol: { flex: 1, minWidth: 0, gap: 2 },
  text: { fontSize: 15, lineHeight: 21, fontWeight: '700' },
  xp: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
})

export default memo(AdventCelebration)
