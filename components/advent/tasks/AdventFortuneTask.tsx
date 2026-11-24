import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { Animated, Easing, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import Button from '@/components/ui/Button'
import type { AdventPaperPalette } from '@/constants/adventVisuals'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useAuth } from '@/context/AuthContext'
import { ANIMATION_NATIVE_DRIVER, useReduceMotion } from '@/hooks/useReduceMotion'
import { translate as i18nT } from '@/i18n'
import type { AdventFortuneGame } from '@/types/advent'
import { adventFortuneIndex } from '@/utils/advent/adventGames'
import AdventCelebration from '../AdventCelebration'
import AdventGameShare, { type AdventGameShareContext } from './AdventGameShare'
import AdventSparkles from '../AdventSparkles'
import { useAdventPaper } from '../useAdventPaper'

type Props = {
  game: AdventFortuneGame
  /** Год и день дверцы: вместе с аккаунтом задают «своё» предсказание. */
  seed: string
  xp?: number
  onComplete: () => void
  share: AdventGameShareContext
}

const FLIP_MS = 260

/**
 * Рождественское гадание (#3487): человек тянет карточку из колоды и получает
 * доброе предсказание. Оно своё у каждого аккаунта и не меняется при повторном
 * открытии — как настоящее гадание, а не лотерея.
 */
function AdventFortuneTask({ game, seed, xp, onComplete, share }: Props) {
  const paper = useAdventPaper()
  const styles = useMemo(() => createStyles(paper), [paper])
  const reduceMotion = useReduceMotion()
  const { userId } = useAuth((auth) => ({ userId: auth.userId }))
  const fortune = game.items[adventFortuneIndex(`${userId ?? 'guest'}:${seed}`, game.items.length)] ?? ''
  const [revealed, setRevealed] = useState(false)
  const flip = useRef(new Animated.Value(1)).current

  const draw = useCallback(() => {
    if (revealed) return
    const show = () => {
      setRevealed(true)
      onComplete()
    }
    if (reduceMotion) {
      show()
      return
    }
    Animated.timing(flip, { toValue: 0, duration: FLIP_MS, easing: Easing.in(Easing.quad), useNativeDriver: ANIMATION_NATIVE_DRIVER }).start(() => {
      show()
      Animated.timing(flip, { toValue: 1, duration: FLIP_MS, easing: Easing.out(Easing.quad), useNativeDriver: ANIMATION_NATIVE_DRIVER }).start()
    })
  }, [revealed, reduceMotion, flip, onComplete])

  return (
    <View style={styles.wrap} testID="advent-fortune">
      <Animated.View style={[styles.card, revealed && styles.cardOpen, { transform: [{ scaleX: flip }] }]}>
        {revealed ? (
          <>
            <AdventSparkles burstKey={fortune} count={14} radius={80} color={paper.gold} />
            <Feather name="star" size={22} color={paper.gold} />
            <Text style={styles.caption}>{i18nT('adventStatic:game.fortune.yours')}</Text>
            <Text style={styles.fortune} accessibilityLiveRegion="polite" testID="advent-fortune-text">
              {fortune}
            </Text>
          </>
        ) : (
          <>
            <Feather name="moon" size={28} color={paper.gold} />
            <Text style={styles.closed}>{i18nT('adventStatic:game.fortune.closed')}</Text>
          </>
        )}
      </Animated.View>
      {revealed ? (
        <>
          <AdventCelebration testID="advent-fortune-celebration" text={i18nT('adventStatic:game.fortune.done')} xp={xp} />
          <AdventGameShare
            {...share}
            kind="fortune"
            title={fortune}
            subtitle={i18nT('adventStatic:game.fortune.shareSubtitle')}
            shareLabel={i18nT('adventStatic:game.fortune.share')}
            shareText={i18nT('adventStatic:game.fortune.shareText')}
            filename={`metravel-predskazanie-${share.year}.png`}
            testIDPrefix="advent-fortune"
          />
        </>
      ) : (
        <Button
          labelNumberOfLines={2}
          style={styles.button}
          label={i18nT('adventStatic:game.fortune.draw')}
          icon={<Feather name="star" size={16} color={paper.paper} />}
          onPress={draw}
          testID="advent-fortune-draw"
        />
      )}
    </View>
  )
}

const createStyles = (paper: AdventPaperPalette) =>
  StyleSheet.create({
    wrap: { gap: DESIGN_TOKENS.spacing.sm },
    button: { maxWidth: '100%' },
    card: {
      minHeight: 150,
      alignItems: 'center',
      justifyContent: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
      paddingVertical: DESIGN_TOKENS.spacing.md,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.sm,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: paper.gold,
      backgroundColor: paper.tag,
    },
    cardOpen: { borderStyle: 'solid', backgroundColor: paper.paper },
    closed: { fontSize: 14, lineHeight: 20, textAlign: 'center', color: paper.inkMuted },
    caption: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase', color: paper.inkMuted },
    fortune: { fontSize: 18, lineHeight: 26, fontWeight: '600', textAlign: 'center', color: paper.ink },
  })

export default memo(AdventFortuneTask)
