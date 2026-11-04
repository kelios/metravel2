import Feather from '@expo/vector-icons/Feather'
import { useLocalSearchParams, type Href } from 'expo-router'
import { ScrollView, StyleSheet, View } from 'react-native'

import { asBottomDimension, useScrollBottomPadding } from '@/components/layout/bottomChromeInset'
import ResponsiveContainer from '@/components/layout/ResponsiveContainer'
import { useScreenHeader } from '@/components/layout/ScreenHeaderContext'
import Button from '@/components/ui/Button'
import LinkPressable from '@/components/ui/LinkPressable'
import { Body, Heading } from '@/components/ui/Typography'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useHydrationReady } from '@/hooks/useHydrationReady'
import { useThemedColors } from '@/hooks/useTheme'
import { formatInteger } from '@/i18n'
import { useTranslation } from '@/i18n/LocaleProvider'
import GamesPdfButton from './GamesPdfButton'
import RoadQuizScreen from './RoadQuizScreen'
import RoadQuizSection from './RoadQuizSection'
import WalkDeckPanel from './WalkDeckPanel'
import { useGamesMediaManifest } from './gamesMedia'

const { radii, spacing, touchTarget } = DESIGN_TOKENS

export default function WalkGamesScreen() {
  const { t } = useTranslation()
  const colors = useThemedColors()
  const { quiz } = useLocalSearchParams<{ quiz?: string }>()
  const hydrationReady = useHydrationReady()
  const isQuiz = hydrationReady && typeof quiz === 'string' && quiz.length > 0
  const title = t('gamesStatic:title')
  useScreenHeader({ title: isQuiz ? t('gamesStatic:quizTitle') : title })
  const bottom = useScrollBottomPadding(spacing.lg)
  const { data, isError, isPending, refetch } = useGamesMediaManifest()

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: asBottomDimension(bottom) }}>
      <ResponsiveContainer maxWidth={isQuiz ? 800 : 'lg'} style={styles.content}>
        {!isQuiz && (
          <View style={[styles.hero, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}>
            <View aria-hidden style={[styles.compassOuter, { borderColor: colors.primary }]}>
              <View style={[styles.compassInner, { borderColor: colors.primary }]}>
                <Feather name="compass" size={76} color={colors.primaryDark} />
              </View>
            </View>
            <View style={styles.heroText}>
              <Heading level={1}>{title}</Heading>
              <Body>{t('gamesStatic:description')}</Body>
            </View>
          </View>
        )}

        {isPending && <Body aria-live="polite">{isQuiz ? t('gamesStatic:quizLoading') : t('gamesStatic:loading')}</Body>}
        {!data && isError && (
          <View style={styles.group}>
            <Body accessibilityRole="alert">{t('gamesStatic:loadError')}</Body>
            <View style={styles.action}>
              <Button label={t('gamesStatic:retry')} variant="outline" onPress={() => { void refetch() }} />
            </View>
          </View>
        )}

        {data && (isQuiz ? <RoadQuizScreen quiz={data.quizzes.find(topic => topic.id === quiz)} /> : (
          <>
            <RoadQuizSection quizzes={data.quizzes} />
            <View style={[styles.group, styles.divided, { borderColor: colors.border }]}>
              <Heading level={2}>{t('gamesStatic:walkTitle')}</Heading>
              {data.decks.length === 0 && data.routeTasks.length === 0 && <Body muted>{t('gamesStatic:walkEmpty')}</Body>}
              {data.decks.length > 0 && (
                <>
                  <Body muted>{t('gamesStatic:walkNote')}</Body>
                  <View style={styles.decks}>
                    {data.decks.map(deck => <WalkDeckPanel key={deck.id} deck={deck} />)}
                  </View>
                </>
              )}
              {data.routeTasks.length > 0 && (
                <>
                  <Heading level={3}>{t('gamesStatic:routeTasksTitle')}</Heading>
                  <Body muted>{t('gamesStatic:routeTasksNote')}</Body>
                  {data.routeTasks.map(edition => (
                    <LinkPressable
                      key={edition.id}
                      href={`${edition.travelPath}#description` as Href}
                      style={{ ...styles.book, minHeight: touchTarget.minHeight, backgroundColor: colors.surface, borderColor: colors.border }}
                    >
                      <Body lang={edition.locale} style={{ color: colors.primaryText }}>{edition.title}</Body>
                    </LinkPressable>
                  ))}
                </>
              )}
            </View>

            <View style={[styles.group, styles.divided, { borderColor: colors.border }]}>
              <Heading level={2}>{t('gamesStatic:printTitle')}</Heading>
              <Heading level={3}>{t('gamesStatic:coloringTitle')}</Heading>
              <Body muted>{t('gamesStatic:note')}</Body>
              {data.collections.length === 0 && <Body>{t('gamesStatic:empty')}</Body>}
              {data.collections.map(book => (
                <View key={book.id} style={[styles.book, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Heading level={4} lang="ru">{book.title}</Heading>
                  <Body muted>{t('gamesStatic:bookFormat', { count: formatInteger(book.sheetCount) })}</Body>
                  <View style={styles.action}>
                    <GamesPdfButton url={book.pdfUrl} label={t('gamesStatic:downloadBook')} />
                  </View>
                </View>
              ))}
            </View>
          </>
        ))}
      </ResponsiveContainer>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingTop: spacing.md },
  hero: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  heroText: { maxWidth: 540, gap: spacing.xs },
  compassOuter: {
    position: 'absolute',
    right: -28,
    top: -48,
    width: 224,
    height: 224,
    borderRadius: radii.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.3,
  },
  compassInner: {
    width: 168,
    height: 168,
    borderRadius: radii.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  group: { gap: spacing.sm },
  divided: { borderTopWidth: 1, paddingTop: spacing.lg },
  decks: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: spacing.md },
  book: { gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderRadius: radii.lg },
  action: { alignSelf: 'flex-start' },
})
