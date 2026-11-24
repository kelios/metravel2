import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Pressable, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { formatInteger } from '@/i18n/format'
import { translate as i18nT } from '@/i18n'
import { ANIMATION_NATIVE_DRIVER, useReduceMotion } from '@/hooks/useReduceMotion'
import type { AdventMatchGame } from '@/types/advent'
import { adventMatchOrder } from '@/utils/advent/adventGames'
import AdventCelebration from '../AdventCelebration'
import { useAdventPaper } from '../useAdventPaper'
import { createAdventGameStyles } from './adventGameStyles'

type Props = {
  game: AdventMatchGame
  xp?: number
  onComplete: () => void
}

type Feedback = { kind: 'fact'; text: string } | { kind: 'miss' } | null

/**
 * Игра «пары» (#3487): тап по карточке слева, затем по паре справа. Верная пара
 * гаснет и показывает факт, промах мягко качает карточку. Все пары — зачёт.
 */
function AdventMatchTask({ game, xp, onComplete }: Props) {
  const paper = useAdventPaper()
  const styles = useMemo(() => createAdventGameStyles(paper), [paper])
  const reduceMotion = useReduceMotion()
  const order = useMemo(() => adventMatchOrder(game.pairs.length), [game.pairs.length])
  const [active, setActive] = useState<number | null>(null)
  const [matched, setMatched] = useState<ReadonlySet<number>>(() => new Set())
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [missRight, setMissRight] = useState<number | null>(null)
  const shake = useRef(new Animated.Value(0)).current
  const completed = useRef(false)

  const solved = matched.size === game.pairs.length && game.pairs.length > 0

  useEffect(() => {
    if (!solved || completed.current) return
    completed.current = true
    onComplete()
  }, [solved, onComplete])

  const nudge = useCallback(() => {
    if (reduceMotion) return
    shake.setValue(0)
    Animated.sequence(
      [6, -6, 4, -3, 0].map((toValue) => Animated.timing(shake, { toValue, duration: 60, useNativeDriver: ANIMATION_NATIVE_DRIVER })),
    ).start()
  }, [reduceMotion, shake])

  const pickRight = useCallback(
    (pairIndex: number) => {
      if (active === null || matched.has(pairIndex)) return
      if (pairIndex === active) {
        setMatched((previous) => new Set(previous).add(pairIndex))
        const fact = game.pairs[pairIndex]?.fact
        setFeedback(fact ? { kind: 'fact', text: fact } : null)
        setActive(null)
        setMissRight(null)
        return
      }
      setMissRight(pairIndex)
      setFeedback({ kind: 'miss' })
      nudge()
    },
    [active, matched, game.pairs, nudge],
  )

  return (
    <View style={styles.wrap} testID="advent-match">
      <Text style={styles.lead}>{i18nT('adventStatic:game.match.lead')}</Text>
      <View style={styles.columns}>
        <View style={styles.column}>
          {game.pairs.map((pair, index) => {
            const done = matched.has(index)
            const isActive = active === index
            return (
              <Pressable
                key={index}
                disabled={done}
                onPress={() => {
                  setActive(index)
                  setMissRight(null)
                  if (feedback?.kind === 'miss') setFeedback(null)
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive, disabled: done }}
                aria-pressed={isActive}
                style={[styles.card, styles.cardInColumn, isActive && styles.cardSelected, done && styles.cardDone]}
                testID={`advent-match-left-${index}`}
              >
                <Text style={styles.cardText}>{pair.left}</Text>
                {done ? <Feather name="check" size={16} color={paper.success} /> : null}
              </Pressable>
            )
          })}
        </View>
        <View style={styles.column}>
          {order.map((pairIndex) => {
            const pair = game.pairs[pairIndex]
            if (!pair) return null
            const done = matched.has(pairIndex)
            const missed = missRight === pairIndex
            // Обёртка есть всегда: иначе промах менял дерево и карточка теряла фокус клавиатуры.
            return (
              <Animated.View key={pairIndex} style={missed ? { transform: [{ translateX: shake }] } : undefined}>
                <Pressable
                  disabled={done || active === null}
                  onPress={() => pickRight(pairIndex)}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: done || active === null }}
                  style={[styles.card, styles.cardInColumn, done && styles.cardDone, missed && { borderColor: paper.gold }]}
                  testID={`advent-match-right-${pairIndex}`}
                >
                  <Text style={styles.cardText}>{pair.right}</Text>
                  {done ? <Feather name="check" size={16} color={paper.success} /> : null}
                </Pressable>
              </Animated.View>
            )
          })}
        </View>
      </View>
      <Text style={styles.meta} accessibilityLiveRegion="polite">
        {i18nT('adventStatic:game.match.counter', { value1: formatInteger(matched.size), value2: formatInteger(game.pairs.length) })}
      </Text>
      {feedback?.kind === 'fact' ? (
        <View style={styles.soft} testID="advent-match-fact">
          <Text style={styles.softTitle}>{i18nT('adventStatic:game.match.factTitle')}</Text>
          <Text style={styles.softText}>{feedback.text}</Text>
        </View>
      ) : null}
      {feedback?.kind === 'miss' ? (
        <View style={styles.soft} accessibilityLiveRegion="polite" testID="advent-match-miss">
          <Text style={styles.softText}>{i18nT('adventStatic:game.match.miss')}</Text>
        </View>
      ) : null}
      {solved ? <AdventCelebration testID="advent-match-celebration" text={i18nT('adventStatic:game.match.done')} xp={xp} /> : null}
    </View>
  )
}

export default memo(AdventMatchTask)
