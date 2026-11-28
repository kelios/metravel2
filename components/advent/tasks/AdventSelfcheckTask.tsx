import { memo, useCallback, useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import Button from '@/components/ui/Button'
import { formatInteger } from '@/i18n/format'
import { translate as i18nT } from '@/i18n'
import type { AdventSelfcheckGame } from '@/types/advent'
import { adventSelfcheckTier } from '@/utils/advent/adventGames'
import AdventCelebration from '../AdventCelebration'
import AdventGameShare, { type AdventGameShareContext } from './AdventGameShare'
import { useAdventPaper } from '../useAdventPaper'
import AdventTitleMedal from './AdventTitleMedal'
import { createAdventGameStyles } from './adventGameStyles'

type Props = {
  game: AdventSelfcheckGame
  xp?: number
  onComplete: () => void
  onOpenLink: (link: string) => void
  share: AdventGameShareContext
}

/**
 * Тест «Настоящий ли вы путешественник?» (#3487): человек отмечает, что с ним
 * было, и получает звание с медалью. Обидных итогов нет — каждое звание
 * засчитывает дверцу и зовёт к следующему окну.
 */
function AdventSelfcheckTask({ game, xp, onComplete, onOpenLink, share }: Props) {
  const paper = useAdventPaper()
  const styles = useMemo(() => createAdventGameStyles(paper), [paper])
  const [checked, setChecked] = useState<ReadonlySet<number>>(() => new Set())
  const [submitted, setSubmitted] = useState(false)
  const tier = useMemo(() => (submitted ? adventSelfcheckTier(game, checked.size) : null), [submitted, game, checked])

  const toggle = useCallback((index: number) => {
    setChecked((previous) => {
      const next = new Set(previous)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])

  const submit = useCallback(() => {
    setSubmitted(true)
    onComplete()
  }, [onComplete])

  if (tier) {
    return (
      <View style={styles.wrap} testID="advent-selfcheck-result">
        <AdventTitleMedal title={tier.title} caption={i18nT('adventStatic:game.selfcheck.yourTitle')} />
        <Text style={styles.softText}>{tier.text}</Text>
        {tier.link ? (
          <Button
            labelNumberOfLines={2}
            style={styles.button}
            label={tier.linkLabel ?? i18nT('adventStatic:sheet.openLink')}
            variant="outline"
            size="sm"
            onPress={() => onOpenLink(tier.link as string)}
            testID="advent-selfcheck-link"
          />
        ) : null}
        <AdventCelebration testID="advent-selfcheck-celebration" text={i18nT('adventStatic:game.selfcheck.done')} xp={xp} />
        <AdventGameShare
          {...share}
          kind="title"
          titleRank={game.tiers.filter((candidate) => candidate.min < tier.min).length}
          title={tier.title}
          subtitle={i18nT('adventStatic:game.selfcheck.shareSubtitle')}
          shareLabel={i18nT('adventStatic:game.selfcheck.share')}
          shareText={i18nT('adventStatic:game.selfcheck.shareText', { value1: tier.title })}
          filename={`metravel-zvanie-${share.year}.png`}
          testIDPrefix="advent-selfcheck"
        />
      </View>
    )
  }

  return (
    <View style={styles.wrap} testID="advent-selfcheck">
      <Text style={styles.lead}>{i18nT('adventStatic:game.selfcheck.lead')}</Text>
      <View style={styles.grid}>
        {game.items.map((item, index) => {
          const isOn = checked.has(index)
          return (
            <Pressable
              key={index}
              onPress={() => toggle(index)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isOn }}
              // accessibilityState не маппится в aria в RN Web — дублируем, как ConsentCheckbox.
              aria-checked={isOn}
              accessibilityLabel={item}
              style={[styles.card, isOn && styles.cardSelected]}
              testID={`advent-selfcheck-item-${index}`}
            >
              <Feather name={isOn ? 'check-square' : 'square'} size={18} color={isOn ? paper.gold : paper.inkMuted} />
              <Text style={styles.cardText}>{item}</Text>
            </Pressable>
          )
        })}
      </View>
      <Text style={styles.meta} accessibilityLiveRegion="polite">
        {i18nT('adventStatic:game.selfcheck.counter', { value1: formatInteger(checked.size), value2: formatInteger(game.items.length) })}
      </Text>
      <Button labelNumberOfLines={2} style={styles.button} label={i18nT('adventStatic:game.selfcheck.submit')} onPress={submit} testID="advent-selfcheck-submit" />
    </View>
  )
}

export default memo(AdventSelfcheckTask)
