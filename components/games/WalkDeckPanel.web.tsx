import { useRef, useState } from 'react'
import { StyleSheet, View, type ViewInstance } from 'react-native'

import Button from '@/components/ui/Button'
import { Body, Heading } from '@/components/ui/Typography'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { WALK_DECK_TITLES } from '@/data/walkGames/deckTitles'
import { useThemedColors } from '@/hooks/useTheme'
import { formatInteger } from '@/i18n'
import { useTranslation } from '@/i18n/LocaleProvider'
import GamesPdfButton from './GamesPdfButton'
import { useWalkCards, type WalkCard, type WalkDeck } from './gamesMedia'
import { advanceWalkRound, startWalkRound } from './walkRound'

const { radii, spacing } = DESIGN_TOKENS

function WalkRoundPanel({ cards, goal, onBack }: { cards: WalkCard[]; goal: number; onBack: () => void }) {
  const { t } = useTranslation()
  const colors = useThemedColors()
  const [round, setRound] = useState(() => startWalkRound(cards.length - 1))
  const cardRef = useRef<ViewInstance>(null)
  function advance(action: Parameters<typeof advanceWalkRound>[1]) {
    const next = advanceWalkRound(round, action, goal)
    if (next.phase !== round.phase) cardRef.current?.focus()
    setRound(next)
  }
  const card = cards[round.phase === 'cards' ? round.order[round.cursor] : cards.length - 1]
  const progress = t('gamesStatic:progress', {
    done: formatInteger(round.completed),
    goal: formatInteger(goal),
  })

  return (
    <>
      <View ref={cardRef} tabIndex={-1} aria-live="polite" aria-atomic style={[styles.card, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <Body variant="small" muted>{round.phase === 'finale' ? t('gamesStatic:finale') : progress}</Body>
        {round.phase === 'done' ? (
          <Heading level={4}>{t('gamesStatic:doneTitle')}</Heading>
        ) : (
          <>
            <Heading level={4} lang="ru">{card.title}</Heading>
            <Body variant="large" lang="ru">{card.body}</Body>
          </>
        )}
      </View>
      <View style={styles.actions}>
        {round.phase === 'cards' && <>
          <Button label={t('gamesStatic:complete')} onPress={() => advance('complete')} />
          <Button label={t('gamesStatic:skip')} variant="outline" onPress={() => advance('skip')} />
          <Button label={t('gamesStatic:earlyFinish')} variant="ghost" onPress={() => advance('finish')} />
        </>}
        {round.phase === 'finale' && <Button label={t('gamesStatic:done')} onPress={() => advance('finish')} />}
        {round.phase === 'done' && <>
          <Button label={t('gamesStatic:replay')} onPress={() => {
            cardRef.current?.focus()
            setRound(startWalkRound(cards.length - 1))
          }} />
          <Button label={t('gamesStatic:back')} variant="outline" onPress={onBack} />
        </>}
      </View>
    </>
  )
}

function WalkSession({ deck, onBack }: { deck: WalkDeck; onBack: () => void }) {
  const { t } = useTranslation()
  const { data, isError, isFetching, refetch } = useWalkCards(deck)

  if (data) return <WalkRoundPanel cards={data} goal={deck.id === 'kids' ? 5 : 6} onBack={onBack} />

  return (
    <>
      {isError
        ? <Body accessibilityRole="alert">{t('gamesStatic:walkLoadError')}</Body>
        : <Body aria-live="polite">{t('gamesStatic:walkLoading')}</Body>}
      <View style={styles.actions}>
        {isError && <Button label={t('gamesStatic:retry')} loading={isFetching} onPress={() => { void refetch() }} />}
        <Button label={t('gamesStatic:back')} variant="outline" onPress={onBack} />
      </View>
    </>
  )
}

export default function WalkDeckPanel({ deck }: { deck: WalkDeck }) {
  const { t } = useTranslation()
  const colors = useThemedColors()
  const [sessionDeck, setSessionDeck] = useState<WalkDeck | null>(null)
  const deckRef = useRef<ViewInstance>(null)
  const kids = deck.id === 'kids'

  function changeSession(next: WalkDeck | null) {
    deckRef.current?.focus()
    setSessionDeck(next)
  }

  return (
    <View ref={deckRef} tabIndex={-1} style={[styles.deck, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Body variant="small" muted>{kids ? t('gamesStatic:kids') : t('gamesStatic:adults')}</Body>
      <Heading level={3} lang="ru">{WALK_DECK_TITLES[deck.id]}</Heading>
      {sessionDeck ? (
        <WalkSession deck={sessionDeck} onBack={() => changeSession(null)} />
      ) : (
        <>
          <Body variant="small" muted>{kids ? t('gamesStatic:kidsMeta') : t('gamesStatic:adultsMeta')}</Body>
          <Body>{kids ? t('gamesStatic:kidsRules') : t('gamesStatic:adultsRules')}</Body>
          <View style={styles.actions}>
            <Button label={t('gamesStatic:play')} onPress={() => changeSession(deck)} />
            <GamesPdfButton url={deck.pdfUrl} label={t('gamesStatic:pdf')} variant="outline" />
          </View>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  deck: { flexGrow: 1, flexBasis: 340, minWidth: 0, gap: spacing.sm, borderRadius: radii.lg, borderWidth: 1, padding: spacing.md },
  card: { gap: spacing.sm, borderRadius: radii.md, borderWidth: 1, padding: spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
})
