import { memo, useCallback, useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import Button from '@/components/ui/Button'
import { formatInteger } from '@/i18n/format'
import { translate as i18nT } from '@/i18n'
import type { AdventPickGame } from '@/types/advent'
import { adventPickVerdict, type AdventPickVerdict } from '@/utils/advent/adventGames'
import AdventCelebration from '../AdventCelebration'
import { useAdventPaper } from '../useAdventPaper'
import { createAdventGameStyles } from './adventGameStyles'

type Props = {
  game: AdventPickGame
  xp?: number
  onComplete: () => void
}

/**
 * «Собери рюкзак» (#3487): выбрать все нужные вещи без лишних. Проверка
 * подсказывает мягко: сколько нужного не хватает и почему лишнее — лишнее.
 */
function AdventPickTask({ game, xp, onComplete }: Props) {
  const paper = useAdventPaper()
  const styles = useMemo(() => createAdventGameStyles(paper), [paper])
  const [selected, setSelected] = useState<ReadonlySet<number>>(() => new Set())
  const [verdict, setVerdict] = useState<AdventPickVerdict | null>(null)
  const needed = useMemo(() => game.items.filter((item) => item.correct).length, [game.items])

  const toggle = useCallback((index: number) => {
    setVerdict((previous) => (previous?.solved ? previous : null))
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])

  const check = useCallback(() => {
    const next = adventPickVerdict(game.items, selected)
    setVerdict(next)
    if (next.solved) onComplete()
  }, [game.items, selected, onComplete])

  const solved = verdict?.solved === true

  return (
    <View style={styles.wrap} testID="advent-pick">
      <Text style={styles.lead}>{i18nT('adventStatic:game.pick.lead', { value1: formatInteger(needed) })}</Text>
      <View style={styles.grid}>
        {game.items.map((item, index) => {
          const isOn = selected.has(index)
          const isExtra = !!verdict && verdict.extra.includes(index)
          return (
            <Pressable
              key={index}
              disabled={solved}
              onPress={() => toggle(index)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isOn, disabled: solved }}
              aria-checked={isOn}
              accessibilityLabel={item.label}
              style={[styles.card, isOn && styles.cardSelected, isExtra && { borderColor: paper.gold }, solved && isOn && styles.cardDone]}
              testID={`advent-pick-item-${index}`}
            >
              <Feather name={isOn ? 'check-square' : 'square'} size={18} color={isOn ? paper.gold : paper.inkMuted} />
              <Text style={styles.cardText}>{item.label}</Text>
            </Pressable>
          )
        })}
      </View>
      {verdict && !verdict.solved ? (
        <View style={styles.soft} accessibilityLiveRegion="polite" testID="advent-pick-feedback">
          <Text style={styles.softTitle}>{i18nT('adventStatic:game.pick.almost')}</Text>
          {verdict.missing > 0 ? (
            <Text style={styles.softText}>{i18nT('adventStatic:game.pick.missing', { value1: formatInteger(verdict.missing) })}</Text>
          ) : null}
          {verdict.extra.map((index) => {
            const item = game.items[index]
            if (!item) return null
            return (
              <Text key={index} style={styles.softText}>
                {item.hint ? i18nT('adventStatic:game.pick.extraHint', { value1: item.label, value2: item.hint }) : i18nT('adventStatic:game.pick.extra', { value1: item.label })}
              </Text>
            )
          })}
        </View>
      ) : null}
      {solved ? (
        <AdventCelebration testID="advent-pick-celebration" text={i18nT('adventStatic:game.pick.done')} xp={xp} />
      ) : (
        <Button labelNumberOfLines={2} style={styles.button} label={i18nT('adventStatic:game.pick.check')} onPress={check} disabled={selected.size === 0} testID="advent-pick-check" />
      )}
    </View>
  )
}

export default memo(AdventPickTask)
